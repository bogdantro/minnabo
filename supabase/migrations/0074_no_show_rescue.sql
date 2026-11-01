-- 0074_no_show_rescue.sql
--  «Hjelperen kom ikke» – when the helper doesn't show up, the owner gets the job done
--  anyway, and the helper is treated fairly.
--
--  Rescue (owner, from the morning of the job day):
--    report_helper_no_show(avtale, Kom ikke | Svarer ikke | Kom for sent, haste?)
--      1. files the report        2. cancels the avtale ("uteblitt")
--      3. opens the oppdrag again  4. optionally makes it a hasteoppdrag for today (0071)
--      5. asks everyone with an open tilbud: «Gjelder tilbudet ditt fortsatt?» –
--         they answer with one tap (confirm_still_available), the owner sees «Kan i dag»
--  Prevention:
--    * «Bekreft at du kommer»: the helper is asked on the job morning (07:00, or 2 hours
--      before an early job); no answer within an hour warns the owner  (run_job_day_checks)
--    * «Jeg er på vei» / «Jeg er framme» as real states the owner sees  (set_helper_status)
--    * silence: the owner wrote and the helper hasn't answered for 2 hours on the job day →
--      the helper is nudged; still nothing an hour later → the owner is offered to switch
--  Fairness:
--    * the helper is told and has 48 hours to explain (explain_no_show). An explained report
--      counts half until MinNabo decides (decide_no_show, from the website's admin).
--    * a report with no answer counts after 48 hours; «Kom for sent» and cancelling yourself
--      within 24 hours of the job count half ("mild")
--    * two full no-shows within 90 days pause new tilbud for 14 days (30 days from three),
--      enforced by a trigger on proposals
--    * a cancelled avtale has no review (submit_review needs a completed job), so nobody
--      writes one in anger – the report is what's recorded
--  Recurring oppdrag: every occurrence is its own oppdrag («Be om hjelp igjen» makes a new
--  one), so switching helper only ever touches this one time.
--  Nothing here has anything to do with payment.

alter type notification_kind add value if not exists 'JOB_DAY';
alter type notification_kind add value if not exists 'NO_SHOW';

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table agreement_snapshots
  add column if not exists helper_confirmed_at timestamptz,
  add column if not exists helper_status text check (helper_status in ('ON_THE_WAY', 'ARRIVED')),
  add column if not exists helper_status_at timestamptz,
  add column if not exists confirm_requested_at timestamptz,
  add column if not exists owner_warned_at timestamptz,
  add column if not exists helper_nudged_at timestamptz,
  add column if not exists owner_silence_warned_at timestamptz;

alter table proposals
  add column if not exists rescue_from uuid references proposals(id) on delete set null,
  add column if not exists rescue_asked_at timestamptz,
  add column if not exists available_today_at timestamptz;

alter table no_show_reports
  add column if not exists reason text not null default 'NO_SHOW'
    check (reason in ('NO_SHOW', 'NO_REPLY', 'LATE', 'HELPER_CANCELLED')),
  add column if not exists weight numeric(3,1) not null default 1 check (weight in (0.5, 1)),
  add column if not exists status text not null default 'PENDING'
    check (status in ('PENDING', 'DISPUTED', 'COUNTED', 'DISMISSED')),
  add column if not exists counts_at timestamptz not null default now() + interval '48 hours',
  add column if not exists explanation text,
  add column if not exists explained_at timestamptz,
  add column if not exists decided_at timestamptz;

-- reports from before this migration were already counted
update no_show_reports set status = 'COUNTED', counts_at = created_at, decided_at = created_at
 where status = 'PENDING' and created_at < now() - interval '1 minute';

-- Reports are only written by the functions below – no more direct inserts
-- (the old policy let anyone report anyone).
drop policy if exists no_show_insert_own on no_show_reports;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
-- 00:00 Oslo time on the day of the job
create or replace function job_day_start(p_at timestamptz) returns timestamptz
language sql immutable as $$
  select date_trunc('day', p_at at time zone 'Europe/Oslo') at time zone 'Europe/Oslo'
$$;

-- what a report weighs right now
create or replace function no_show_weight(n no_show_reports) returns numeric
language sql stable as $$
  select case
    when n.status = 'DISMISSED' then 0
    when n.status = 'COUNTED'   then n.weight
    when n.status = 'DISPUTED'  then least(n.weight, 0.5)
    when n.counts_at <= now()   then n.weight      -- no explanation in time
    else 0 end
$$;

-- «kl. 14:00» in Oslo time
create or replace function oslo_hhmm(p_at timestamptz) returns text
language sql immutable as $$ select to_char(p_at at time zone 'Europe/Oslo', 'HH24:MI') $$;

create or replace function first_name(p_profile uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(split_part(display_name, ' ', 1), ''), 'Naboen') from profiles where id = p_profile
$$;

-- recount the profile's no-show number (shown on the profile)
create or replace function refresh_no_show_count(p_profile uuid) returns void
language sql security definer set search_path = public as $$
  update profiles
     set reliability_no_shows = coalesce((select ceil(sum(no_show_weight(n)))::int
                                            from no_show_reports n where n.reported_id = p_profile), 0)
   where id = p_profile;
$$;

-- the old counter counted every insert; now the weight decides
drop trigger if exists t_no_show_counter on no_show_reports;
create or replace function no_show_recount() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform refresh_no_show_count(new.reported_id);
  return new;
end $$;
drop trigger if exists t_no_show_recount on no_show_reports;
create trigger t_no_show_recount after insert or update on no_show_reports
  for each row execute function no_show_recount();

-- ---------------------------------------------------------------------------
-- 3. Pause after repeated no-shows
-- ---------------------------------------------------------------------------
-- Full no-shows (weight 1) that count, in the last 90 days. 2 → 14 days pause, 3+ → 30 days,
-- counted from the latest one.
create or replace function tilbud_pause_until(p_profile uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  with strikes as (
    select coalesce(n.decided_at, n.counts_at) as at
      from no_show_reports n
     where n.reported_id = p_profile and n.weight >= 1
       and (n.status = 'COUNTED' or (n.status = 'PENDING' and n.counts_at <= now()))
       and coalesce(n.decided_at, n.counts_at) > now() - interval '90 days'
  )
  select case
    when count(*) >= 3 then max(at) + interval '30 days'
    when count(*) = 2  then max(at) + interval '14 days'
  end
  from strikes
  having count(*) >= 2 and max(at) + case when count(*) >= 3 then interval '30 days' else interval '14 days' end > now()
$$;

create or replace function my_tilbud_pause() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('until', tilbud_pause_until(auth.uid()))
$$;
revoke all on function my_tilbud_pause() from public, anon;
grant execute on function my_tilbud_pause() to authenticated;

create or replace function enforce_tilbud_pause() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_until timestamptz := tilbud_pause_until(new.from_profile_id);
begin
  if v_until is not null then
    raise exception 'Du kan gi tilbud igjen %. Du har uteblitt fra to avtaler de siste 90 dagene.',
      to_char(v_until at time zone 'Europe/Oslo', 'DD.MM.YYYY');
  end if;
  return new;
end $$;
drop trigger if exists proposals_tilbud_pause on proposals;
create trigger proposals_tilbud_pause before insert on proposals
  for each row execute function enforce_tilbud_pause();

-- ---------------------------------------------------------------------------
-- 4. Reliability on the profile: half-weight reports count half
-- ---------------------------------------------------------------------------
create or replace function profile_reliability(p_profile_id uuid)
returns json language sql stable security definer set search_path = public as $$
  with mine as (
    select a.proposal_id, a.cancelled_at, a.cancelled_by, a.scheduled_at,
           p.from_profile_id = p_profile_id as is_helper,
           (select count(*) from completion_confirmations c where c.agreement_proposal_id = a.proposal_id) >= 2 as done,
           coalesce((select sum(no_show_weight(n)) from no_show_reports n
                      where n.agreement_proposal_id = a.proposal_id and n.reported_id = p_profile_id), 0) as missed,
           (select w.first_started_at from job_workspaces w where w.proposal_id = a.proposal_id) as started_at
      from agreement_snapshots a
      join proposals p on p.id = a.proposal_id
     where (p.from_profile_id = p_profile_id or p.to_profile_id = p_profile_id)
       and a.agreed_at > now() - interval '12 months'
  ), s as (
    select count(*) filter (where done) as completed,
           count(*) filter (where done or missed > 0) as judged,
           coalesce(sum(least(missed, 1)), 0) as no_shows,
           count(*) filter (where is_helper and scheduled_at is not null and started_at is not null) as timed,
           count(*) filter (where is_helper and scheduled_at is not null and started_at is not null
                              and started_at <= scheduled_at + interval '15 minutes') as on_time,
           count(*) filter (where done or cancelled_by = p_profile_id) as ended,
           count(*) filter (where cancelled_by = p_profile_id) as called_off
      from mine
  )
  select json_build_object(
    'completed', completed,
    'showsUp',   case when judged >= 3 then round(100.0 * (judged - no_shows) / judged)::int end,
    'onTime',    case when timed  >= 3 then round(100.0 * on_time / timed)::int end,
    'completes', case when ended  >= 3 then round(100.0 * (ended - called_off) / ended)::int end)
    from s;
$$;
grant execute on function profile_reliability(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The other tilbud during a rescue get their own message, not "åpent igjen" (0052)
-- ---------------------------------------------------------------------------
create or replace function proposals_notify_others() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text; o record;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status::text <> 'ACCEPTED' and not (old.status::text = 'ACCEPTED' and new.status::text = 'CANCELLED') then
    return new;
  end if;
  -- a rescue (below) writes «Oppdraget er ledig igjen – trengs i dag» itself
  if coalesce(current_setting('minnabo.rescue', true), '') = new.id::text then return new; end if;
  select title into v_title from listings where id = new.listing_id;

  for o in
    select id, from_profile_id from proposals
     where listing_id = new.listing_id and id <> new.id and status in ('SENT','REVISION_PENDING')
  loop
    if new.status::text = 'ACCEPTED' then
      insert into notifications (profile_id, kind, title, body, route)
        values (o.from_profile_id, 'OFFER_CHANGED', 'Oppdraget har fått en avtale',
                '«' || coalesce(v_title, 'Oppdraget') || '» har en avtale med en annen nabo. Tilbudet ditt står på vent.',
                '/tilbud/' || o.id);
    else
      insert into notifications (profile_id, kind, title, body, route)
        values (o.from_profile_id, 'OFFER_CHANGED', 'Oppdraget er åpent igjen',
                'Avtalen på «' || coalesce(v_title, 'oppdraget') || '» ble avlyst. Tilbudet ditt gjelder igjen.',
                '/tilbud/' || o.id);
    end if;
  end loop;
  return new;
end $$;

-- Ask everyone with an open tilbud on the oppdrag whether it still stands (one tap).
create or replace function ask_other_offers(p_from uuid, p_listing uuid) returns int
language plpgsql security definer set search_path = public as $$
declare o record; v_title text; v_n int := 0;
begin
  select title into v_title from listings where id = p_listing;
  for o in
    select id, from_profile_id from proposals
     where listing_id = p_listing and id <> p_from and status in ('SENT','REVISION_PENDING')
  loop
    update proposals set rescue_from = p_from, rescue_asked_at = now(), available_today_at = null where id = o.id;
    perform notify(o.from_profile_id, 'OFFER_CHANGED', 'Oppdraget er ledig igjen',
      '«' || coalesce(v_title, 'Oppdraget') || '» trengs i dag. Gjelder tilbudet ditt fortsatt?',
      '/tilbud/' || o.id || '?ledig=1');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function ask_other_offers(uuid, uuid) from public, anon, authenticated;

-- End of today in Oslo – the haste deadline a rescue gets.
create or replace function end_of_oslo_day() returns timestamptz
language sql stable as $$
  select (date_trunc('day', now() at time zone 'Europe/Oslo') + interval '1 day' - interval '1 millisecond') at time zone 'Europe/Oslo'
$$;

-- ---------------------------------------------------------------------------
-- 6. «Hjelperen kom ikke»
-- ---------------------------------------------------------------------------
create or replace function report_helper_no_show(p_proposal_id uuid, p_reason text, p_make_urgent boolean default true)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid(); p proposals; s agreement_snapshots; v_label text; v_report uuid;
  v_urgent boolean := false; v_others int := 0;
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me is null or v_me <> p.to_profile_id then
    raise exception 'Bare den som la ut oppdraget kan melde fra om dette.' using errcode = '42501';
  end if;
  select * into s from agreement_snapshots where proposal_id = p.id for update;
  if p.status::text <> 'ACCEPTED' or not found or s.cancelled_at is not null then
    raise exception 'Avtalen er ikke aktiv lenger.';
  end if;
  if (select count(*) from completion_confirmations where agreement_proposal_id = p.id) >= 2 then
    raise exception 'Jobben er allerede bekreftet fullført.';
  end if;
  if p_reason not in ('NO_SHOW', 'NO_REPLY', 'LATE') then raise exception 'Velg hva som skjedde.'; end if;
  if s.scheduled_at is not null and now() < job_day_start(s.scheduled_at) then
    raise exception 'Du kan melde fra fra morgenen på jobbdagen.';
  end if;

  v_label := case p_reason when 'NO_SHOW' then 'Hjelperen kom ikke'
                           when 'NO_REPLY' then 'Hjelperen svarte ikke'
                           else 'Hjelperen kom for sent' end;

  insert into no_show_reports (agreement_proposal_id, reporter_id, reported_id, reason, weight, status, counts_at)
    values (p.id, v_me, p.from_profile_id, p_reason, case when p_reason = 'LATE' then 0.5 else 1 end,
            'PENDING', now() + interval '48 hours')
  on conflict (agreement_proposal_id, reporter_id) do nothing
  returning id into v_report;

  -- the avtale is off and the oppdrag is open again
  perform set_config('minnabo.rescue', p.id::text, true);
  update proposals set status = proposal_next(p.status, 'CANCEL', 'RECIPIENT') where id = p.id;
  update agreement_snapshots set cancelled_at = now(), cancel_reason = v_label where proposal_id = p.id;
  update listings set status = 'RECEIVING_OFFERS' where id = p.listing_id;
  insert into messages (conversation_id, author_id, kind, text)
    values (p.conversation_id, v_me, 'SYSTEM', 'Avtalen er avlyst · ' || v_label);

  if v_report is not null then
    perform notify(p.from_profile_id, 'NO_SHOW', 'Avtalen ble avlyst',
      first_name(v_me) || ' meldte: ' || lower(v_label) || '. Stemmer ikke det? Forklar hva som skjedde innen 48 timer.',
      '/uteblitt/' || v_report);
  end if;

  if p_make_urgent then
    begin
      update listings set urgent_until = end_of_oslo_day() where id = p.listing_id;
      v_urgent := true;
    exception when others then
      -- another hasteoppdrag is out already (one at a time) – the rescue still goes on
      v_urgent := false;
    end;
  end if;

  v_others := ask_other_offers(p.id, p.listing_id);
  return json_build_object('urgent', v_urgent, 'others', v_others, 'reportId', v_report);
end $$;
revoke all on function report_helper_no_show(uuid, text, boolean) from public, anon;
grant execute on function report_helper_no_show(uuid, text, boolean) to authenticated;

-- Old app versions call report_no_show from Jobbdag: the owner's report becomes a rescue,
-- anything else is refused (it had no checks at all).
create or replace function report_no_show(p_agreement_proposal_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p proposals;
begin
  select * into p from proposals where id = p_agreement_proposal_id;
  if not found or auth.uid() <> p.to_profile_id or p_profile_id <> p.from_profile_id then
    raise exception 'Oppdater appen for å melde fra om dette.';
  end if;
  perform report_helper_no_show(p_agreement_proposal_id, 'NO_SHOW', false);
end $$;
grant execute on function report_no_show(uuid, uuid) to authenticated;

-- «Ja, jeg kan i dag» – the sender of another tilbud says it still stands.
create or replace function confirm_still_available(p_proposal_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p proposals; v_title text; v_owner uuid;
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found or p.from_profile_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if p.status::text not in ('SENT', 'REVISION_PENDING') then raise exception 'Tilbudet er ikke åpent lenger.'; end if;
  select title, owner_id into v_title, v_owner from listings
   where id = p.listing_id and status in ('PUBLISHED', 'RECEIVING_OFFERS', 'ACTIVE');
  if not found then raise exception 'Oppdraget har allerede fått hjelp.'; end if;
  if p.available_today_at is not null then return; end if;
  update proposals set available_today_at = now() where id = p.id;
  perform notify(v_owner, 'OFFER_CHANGED', first_name(p.from_profile_id) || ' kan i dag',
    first_name(p.from_profile_id) || ' kan ta «' || coalesce(v_title, 'oppdraget') || '» i dag. Godta tilbudet hvis det passer.',
    coalesce('/avtale/' || p.rescue_from || '?redning=1', '/tilbud/' || p.id));
end $$;
revoke all on function confirm_still_available(uuid) from public, anon;
grant execute on function confirm_still_available(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. The helper cancels: the same rescue for the owner; within 24 hours it counts half
-- ---------------------------------------------------------------------------
create or replace function cancel_agreement(p_proposal_id uuid, p_reason text default null)
returns proposals language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_actor text; v_other uuid; v_reason text; s agreement_snapshots;
        v_late boolean;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found then raise exception 'Fant ikke tilbudet.'; end if;
  if not is_participant(p.conversation_id) then raise exception 'Ikke tilgang.'; end if;

  if v_me = p.from_profile_id then v_actor := 'PROPOSER'; v_other := p.to_profile_id;
  elsif v_me = p.to_profile_id then v_actor := 'RECIPIENT'; v_other := p.from_profile_id;
  else raise exception 'Feil rolle for denne handlingen.';
  end if;

  select * into s from agreement_snapshots where proposal_id = p.id;
  -- the helper calls it off close to the job: the owner needs someone else, fast
  v_late := v_actor = 'PROPOSER' and s.scheduled_at is not null and s.scheduled_at < now() + interval '24 hours';
  -- close to the job the other tilbud get «trengs i dag» (below) instead of "åpent igjen" (0052)
  if v_late then perform set_config('minnabo.rescue', p.id::text, true); end if;

  update proposals set status = proposal_next(p.status, 'CANCEL', v_actor)
   where id = p.id returning * into p;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  update agreement_snapshots set cancelled_at = now(), cancel_reason = v_reason
   where proposal_id = p.id;

  -- the oppdrag is open for offers again
  update listings set status = 'RECEIVING_OFFERS' where id = p.listing_id;

  insert into messages (conversation_id, author_id, kind, text)
    values (p.conversation_id, v_me, 'SYSTEM',
            'Avtalen er avlyst' || coalesce(' · ' || v_reason, ''));

  if v_actor = 'PROPOSER' then
    if v_late then
      -- counts half, and the helper's own reason is the explanation
      insert into no_show_reports (agreement_proposal_id, reporter_id, reported_id, reason, weight, status,
                                   counts_at, explanation, explained_at, decided_at)
        values (p.id, v_other, v_me, 'HELPER_CANCELLED', 0.5, 'COUNTED', now(), v_reason, now(), now())
      on conflict (agreement_proposal_id, reporter_id) do nothing;
    end if;
    perform notify(v_other, 'AGREEMENT_CANCELLED', first_name(v_me) || ' kan ikke likevel',
      coalesce('Grunn: ' || lower(v_reason) || '. ', '') || 'Velg en annen nabo, eller gjør det til et hasteoppdrag.',
      '/avtale/' || p.id || '?redning=1');
    if v_late then perform ask_other_offers(p.id, p.listing_id); end if;
  else
    perform notify(v_other, 'AGREEMENT_CANCELLED', 'Avtalen er avlyst',
      coalesce('Grunn: ' || lower(v_reason) || '.', 'Den andre parten har avlyst avtalen.'),
      '/avtale/' || p.id);
  end if;
  return p;
end $$;

-- A rescue may turn the reopened oppdrag into a hasteoppdrag (no new deadline otherwise).
create or replace function make_rescue_urgent(p_proposal_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare p proposals;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found or p.to_profile_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if p.status::text <> 'CANCELLED' then raise exception 'Avtalen er ikke avlyst.'; end if;
  if not exists (select 1 from listings where id = p.listing_id and status in ('PUBLISHED', 'RECEIVING_OFFERS', 'ACTIVE')) then
    raise exception 'Oppdraget har allerede fått hjelp.';
  end if;
  perform set_config('minnabo.rescue', p.id::text, true);
  update listings set urgent_until = end_of_oslo_day() where id = p.listing_id;
  return true;
end $$;
revoke all on function make_rescue_urgent(uuid) from public, anon;
grant execute on function make_rescue_urgent(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. The helper explains; MinNabo decides
-- ---------------------------------------------------------------------------
create or replace function no_show_report(p_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', n.id, 'proposalId', n.agreement_proposal_id, 'reason', n.reason, 'status', n.status,
    'weight', n.weight, 'countsAt', n.counts_at, 'createdAt', n.created_at,
    'explanation', n.explanation, 'explainedAt', n.explained_at,
    'reporterName', first_name(n.reporter_id), 'reportedName', first_name(n.reported_id),
    'iAmReported', n.reported_id = auth.uid(), 'listingTitle', l.title)
    from no_show_reports n
    join proposals p on p.id = n.agreement_proposal_id
    join listings l on l.id = p.listing_id
   where n.id = p_id and auth.uid() in (n.reporter_id, n.reported_id)
$$;
revoke all on function no_show_report(uuid) from public, anon;
grant execute on function no_show_report(uuid) to authenticated;

create or replace function explain_no_show(p_id uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare n no_show_reports; v_text text := btrim(coalesce(p_text, ''));
begin
  select * into n from no_show_reports where id = p_id for update;
  if not found or n.reported_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if n.status <> 'PENDING' then raise exception 'Du har allerede svart på denne.'; end if;
  if n.counts_at <= now() then raise exception 'Fristen på 48 timer er ute.'; end if;
  if length(v_text) < 10 then raise exception 'Skriv litt mer om hva som skjedde.'; end if;
  update no_show_reports set status = 'DISPUTED', explanation = left(v_text, 600), explained_at = now() where id = n.id;
  perform notify(n.reporter_id, 'NO_SHOW', first_name(n.reported_id) || ' har forklart seg',
    'MinNabo ser på saken. Til da teller den bare halvt.', '/uteblitt/' || n.id);
end $$;
revoke all on function explain_no_show(uuid, text) from public, anon;
grant execute on function explain_no_show(uuid, text) to authenticated;

-- For the website's admin: count it fully, or drop it.
create or replace function decide_no_show(p_id uuid, p_counts boolean) returns void
language plpgsql security definer set search_path = public as $$
declare n no_show_reports;
begin
  if not is_admin() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  update no_show_reports set status = case when p_counts then 'COUNTED' else 'DISMISSED' end, decided_at = now()
   where id = p_id returning * into n;
  if not found then raise exception 'Fant ikke saken.'; end if;
  perform notify(n.reported_id, 'NO_SHOW', 'MinNabo har sett på saken',
    case when p_counts then 'Meldingen om at du uteble står ved lag.' else 'Meldingen om at du uteble er fjernet.' end,
    '/uteblitt/' || n.id);
end $$;
revoke all on function decide_no_show(uuid, boolean) from public, anon;
grant execute on function decide_no_show(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. «Bekreft at du kommer», «Jeg er på vei», «Jeg er framme»
-- ---------------------------------------------------------------------------
create or replace function helper_agreement(p_proposal_id uuid) returns proposals
language plpgsql security definer set search_path = public as $$
declare p proposals;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found or p.from_profile_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if p.status::text <> 'ACCEPTED'
     or exists (select 1 from agreement_snapshots where proposal_id = p.id and cancelled_at is not null) then
    raise exception 'Avtalen er ikke aktiv lenger.';
  end if;
  return p;
end $$;
revoke all on function helper_agreement(uuid) from public, anon, authenticated;

create or replace function confirm_attendance(p_proposal_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p proposals := helper_agreement(p_proposal_id); s agreement_snapshots;
begin
  select * into s from agreement_snapshots where proposal_id = p.id for update;
  if s.helper_confirmed_at is not null then return; end if;
  update agreement_snapshots set helper_confirmed_at = now() where proposal_id = p.id;
  insert into messages (conversation_id, author_id, kind, text)
    values (p.conversation_id, p.from_profile_id, 'SYSTEM', first_name(p.from_profile_id) || ' har bekreftet at avtalen står');
  perform notify(p.to_profile_id, 'JOB_DAY', first_name(p.from_profile_id) || ' kommer',
    first_name(p.from_profile_id) || ' har bekreftet avtalen' || coalesce(' kl. ' || oslo_hhmm(s.scheduled_at), '') || '.',
    '/avtale/' || p.id);
end $$;
revoke all on function confirm_attendance(uuid) from public, anon;
grant execute on function confirm_attendance(uuid) to authenticated;

create or replace function set_helper_status(p_proposal_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare p proposals := helper_agreement(p_proposal_id); v_text text;
begin
  if p_status not in ('ON_THE_WAY', 'ARRIVED') then raise exception 'Ugyldig status.'; end if;
  update agreement_snapshots
     set helper_status = p_status, helper_status_at = now(), helper_confirmed_at = coalesce(helper_confirmed_at, now())
   where proposal_id = p.id;
  v_text := first_name(p.from_profile_id) || case p_status when 'ON_THE_WAY' then ' er på vei' else ' er framme' end;
  insert into messages (conversation_id, author_id, kind, text) values (p.conversation_id, p.from_profile_id, 'SYSTEM', v_text);
  perform notify(p.to_profile_id, 'JOB_DAY', v_text, 'kl. ' || oslo_hhmm(now()), '/avtale/' || p.id);
end $$;
revoke all on function set_helper_status(uuid, text) from public, anon;
grant execute on function set_helper_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Job-day checks, every 10 minutes
-- ---------------------------------------------------------------------------
create or replace function run_job_day_checks() returns int
language plpgsql security definer set search_path = public as $$
declare a record; v_n int := 0; v_last record; v_ask timestamptz;
begin
  -- a report nobody explained in 48 hours now counts
  update no_show_reports set status = 'COUNTED', decided_at = counts_at
   where status = 'PENDING' and counts_at <= now();

  for a in
    select s.*, p.id as pid, p.conversation_id, p.from_profile_id as helper, p.to_profile_id as client, l.title
      from agreement_snapshots s
      join proposals p on p.id = s.proposal_id
      join listings l on l.id = p.listing_id
     where p.status::text = 'ACCEPTED' and s.cancelled_at is null and s.scheduled_at is not null
       and s.scheduled_at > now() - interval '6 hours' and s.scheduled_at < now() + interval '30 hours'
       and (select count(*) from completion_confirmations c where c.agreement_proposal_id = p.id) < 2
  loop
    -- the morning of the job (07:00), or 2 hours before a job that starts before 09:00
    v_ask := case when extract(hour from a.scheduled_at at time zone 'Europe/Oslo') >= 9
                  then job_day_start(a.scheduled_at) + interval '7 hours'
                  else a.scheduled_at - interval '2 hours' end;

    if a.helper_confirmed_at is null and a.confirm_requested_at is null and now() >= v_ask and now() < a.scheduled_at then
      perform notify(a.helper, 'JOB_DAY', 'Bekreft at du kommer',
        first_name(a.client) || ' venter på deg i dag kl. ' || oslo_hhmm(a.scheduled_at) || ' («' || a.title || '»). Trykk for å bekrefte.',
        '/avtale/' || a.pid || '?bekreft=1');
      update agreement_snapshots set confirm_requested_at = now() where proposal_id = a.pid;
      v_n := v_n + 1;
    end if;

    if a.helper_confirmed_at is null and a.confirm_requested_at is not null and a.owner_warned_at is null
       and a.confirm_requested_at <= now() - interval '1 hour' then
      perform notify(a.client, 'JOB_DAY', first_name(a.helper) || ' har ikke bekreftet ennå',
        'Jobben er i dag kl. ' || oslo_hhmm(a.scheduled_at) || '. Skriv til ' || first_name(a.helper) ||
        ', eller finn en annen nabo hvis du trenger det.', '/avtale/' || a.pid);
      update agreement_snapshots set owner_warned_at = now() where proposal_id = a.pid;
      v_n := v_n + 1;
    end if;

    -- silence on the job day: the owner wrote last, the helper hasn't answered
    if (a.scheduled_at at time zone 'Europe/Oslo')::date = (now() at time zone 'Europe/Oslo')::date then
      select m.author_id, m.created_at into v_last from messages m
       where m.conversation_id = a.conversation_id and m.kind::text <> 'SYSTEM' and m.created_at >= a.agreed_at
       order by m.created_at desc limit 1;
      if found and v_last.author_id = a.client then
        if a.helper_nudged_at is null and v_last.created_at <= now() - interval '2 hours' then
          perform notify(a.helper, 'JOB_DAY', first_name(a.client) || ' venter på svar',
            first_name(a.client) || ' skrev til deg om dagens jobb for over to timer siden.', '/chat/' || a.conversation_id);
          update agreement_snapshots set helper_nudged_at = now() where proposal_id = a.pid;
          v_n := v_n + 1;
        elsif a.helper_nudged_at is not null and a.owner_silence_warned_at is null
              and a.helper_nudged_at <= now() - interval '1 hour' and v_last.created_at < a.helper_nudged_at then
          perform notify(a.client, 'JOB_DAY', first_name(a.helper) || ' har ikke svart',
            'Vi har minnet ' || first_name(a.helper) || ' på det. Vil du finne en annen nabo?', '/avtale/' || a.pid);
          update agreement_snapshots set owner_silence_warned_at = now() where proposal_id = a.pid;
          v_n := v_n + 1;
        end if;
      end if;
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function run_job_day_checks() from public, anon, authenticated;

do $$ begin
  begin
    perform cron.unschedule('minnabo-job-day');
  exception when others then null;
  end;
  perform cron.schedule('minnabo-job-day', '*/10 * * * *', 'select public.run_job_day_checks()');
exception when others then
  raise notice 'Job-day checks are not scheduled (%). Enable pg_cron and run this block again.', sqlerrm;
end $$;
