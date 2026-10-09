-- 0053_more_features.sql
--  1. Reminders before an agreed job (the evening before + about an hour before), sent by pg_cron
--  2. "Foreslå nytt tidspunkt" on an avtale: one side proposes, the other accepts or declines
--  3. "Be om hjelp igjen": a finished avtale becomes a new oppdrag that only that helper sees
--  4. Repeating oppdrag: the poster is nudged when the next round is due
--  5. Price guidance from earlier tilbud in the same category
--  6. App-icon badge count for push
--  7. Foresatt (guardian) linked to a youth account is told about its avtaler
--  8. Spam limits on new oppdrag + a word filter on public text
--  9. Waiting list for kommuner outside the launch area

-- ---------------------------------------------------------------------------
-- 3. oppdrag sent to one helper (and 4. which avtale it repeats)
-- ---------------------------------------------------------------------------
alter table listings add column if not exists invited_profile_id uuid references profiles(id) on delete set null;
alter table listings add column if not exists repeat_of uuid references proposals(id) on delete set null;
create index if not exists listings_invited_idx on listings (invited_profile_id) where invited_profile_id is not null;

-- An oppdrag sent to one helper is only visible to that helper, its owner and admins.
drop policy if exists p_listings_read on listings;
create policy p_listings_read on listings for select to authenticated
  using (
    ((status <> 'REMOVED' and not admin_hidden)
      and (invited_profile_id is null or invited_profile_id = auth.uid()))
    or owner_id = auth.uid()
    or is_admin()
  );

-- ...and only that helper can give a tilbud on it.
create or replace function proposals_respect_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_invited uuid;
begin
  select invited_profile_id into v_invited from listings where id = new.listing_id;
  if v_invited is not null and new.from_profile_id <> v_invited then
    raise exception 'Dette oppdraget er sendt til en bestemt nabo.';
  end if;
  return new;
end $$;
drop trigger if exists t_proposals_respect_invite on proposals;
create trigger t_proposals_respect_invite before insert on proposals
  for each row execute function proposals_respect_invite();

-- Saved-search alerts are for public oppdrag only.
drop trigger if exists t_listings_saved_search_alerts on listings;
create trigger t_listings_saved_search_alerts after insert or update of status on listings
  for each row when (new.invited_profile_id is null) execute function notify_saved_searches();

create or replace function request_help_again(p_proposal_id uuid, p_when text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  p proposals;
  l listings;
  v_new uuid := gen_random_uuid();
  v_existing uuid;
  v_name text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_when text := nullif(trim(coalesce(p_when, '')), '');
begin
  select * into p from proposals where id = p_proposal_id;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me is distinct from p.to_profile_id then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  select * into l from listings where id = p.listing_id;
  if l.status::text not in ('COMPLETED','REVIEWED') then
    raise exception 'Du kan be om hjelp igjen når oppdraget er fullført.';
  end if;
  if exists (select 1 from profiles where id = p.from_profile_id and (deleted_at is not null or suspended_at is not null)) then
    raise exception 'Denne naboen er ikke lenger på MinNabo.';
  end if;
  if exists (select 1 from blocks b
              where (b.by_profile_id = v_me and b.blocked_profile_id = p.from_profile_id)
                 or (b.by_profile_id = p.from_profile_id and b.blocked_profile_id = v_me)) then
    raise exception 'Du kan ikke sende forespørsler til denne personen.';
  end if;

  -- asked already and still open → the same oppdrag
  select id into v_existing from listings
   where repeat_of = p.id and invited_profile_id = p.from_profile_id
     and status::text in ('PUBLISHED','RECEIVING_OFFERS','ACTIVE')
   limit 1;
  if v_existing is not null then return v_existing; end if;

  insert into listings
    select (jsonb_populate_record(null::listings, to_jsonb(l) || jsonb_build_object(
      'id', v_new, 'status', 'PUBLISHED', 'created_at', now(), 'updated_at', now(),
      'edited_at', null, 'admin_hidden', false,
      'invited_profile_id', p.from_profile_id, 'repeat_of', p.id))).*;

  insert into task_details
    select (jsonb_populate_record(null::task_details, to_jsonb(t) || jsonb_build_object(
      'listing_id', v_new,
      'scheduled_text', v_when,
      'description', coalesce(v_note, t.description)))).*
      from task_details t where t.listing_id = l.id;

  insert into listing_images
    select (jsonb_populate_record(null::listing_images, to_jsonb(i) || jsonb_build_object(
      'id', gen_random_uuid(), 'listing_id', v_new))).*
      from listing_images i where i.listing_id = l.id;

  select split_part(display_name, ' ', 1) into v_name from profiles where id = v_me;
  insert into notifications (profile_id, kind, title, body, route)
    values (p.from_profile_id, 'NEW_MATCH'::text::notification_kind,
            coalesce(v_name, 'En nabo') || ' ber om hjelp igjen',
            '«' || l.title || '» – bare du har fått denne forespørselen.',
            '/oppdrag/' || v_new);
  return v_new;
end $$;
grant execute on function request_help_again(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Foreslå nytt tidspunkt
-- ---------------------------------------------------------------------------
create table if not exists agreement_time_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references agreement_snapshots(proposal_id) on delete cascade,
  proposed_by uuid not null references profiles(id) on delete cascade,
  scheduled_at timestamptz not null,
  scheduled_text text not null,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','DECLINED','WITHDRAWN')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create unique index if not exists agreement_time_one_pending
  on agreement_time_proposals (proposal_id) where status = 'PENDING';
alter table agreement_time_proposals enable row level security;
drop policy if exists p_time_prop_read on agreement_time_proposals;
create policy p_time_prop_read on agreement_time_proposals for select to authenticated
  using (exists (select 1 from proposals p where p.id = proposal_id
                  and auth.uid() in (p.from_profile_id, p.to_profile_id)));

create or replace function propose_agreement_time(p_proposal_id uuid, p_scheduled_at timestamptz, p_scheduled_text text)
returns agreement_time_proposals language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  p proposals; a agreement_snapshots; r agreement_time_proposals;
  v_other uuid; v_title text; v_status text; v_name text;
  v_text text := nullif(trim(coalesce(p_scheduled_text, '')), '');
begin
  select * into p from proposals where id = p_proposal_id;
  if not found or v_me is null or v_me not in (p.from_profile_id, p.to_profile_id) then
    raise exception 'Ikke tilgang.' using errcode = '42501';
  end if;
  select * into a from agreement_snapshots where proposal_id = p.id;
  if not found or a.cancelled_at is not null or p.status::text <> 'ACCEPTED' then
    raise exception 'Avtalen gjelder ikke lenger.';
  end if;
  select title, status::text into v_title, v_status from listings where id = p.listing_id;
  if v_status in ('COMPLETED','REVIEWED') then raise exception 'Oppdraget er allerede fullført.'; end if;
  if p_scheduled_at is null or p_scheduled_at <= now() or v_text is null then
    raise exception 'Velg et tidspunkt fram i tid.';
  end if;

  -- a new proposal replaces the open one (mine is withdrawn, theirs is answered with this)
  update agreement_time_proposals
     set status = case when proposed_by = v_me then 'WITHDRAWN' else 'DECLINED' end, responded_at = now()
   where proposal_id = p.id and status = 'PENDING';

  insert into agreement_time_proposals (proposal_id, proposed_by, scheduled_at, scheduled_text)
    values (p.id, v_me, p_scheduled_at, v_text) returning * into r;

  v_other := case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end;
  select split_part(display_name, ' ', 1) into v_name from profiles where id = v_me;
  insert into notifications (profile_id, kind, title, body, route)
    values (v_other, 'AGREED_TIME', 'Forslag om nytt tidspunkt',
            coalesce(v_name, 'Den andre') || ' foreslår ' || v_text || ' for «' || coalesce(v_title, 'oppdraget') || '».',
            '/avtale/' || p.id);
  return r;
end $$;
grant execute on function propose_agreement_time(uuid, timestamptz, text) to authenticated;

-- p_answer: 'ACCEPT' | 'DECLINE' (the other person) or 'WITHDRAW' (the one who proposed)
create or replace function respond_agreement_time(p_id uuid, p_answer text)
returns agreement_time_proposals language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  r agreement_time_proposals; p proposals; a agreement_snapshots;
  v_title text; v_name text;
begin
  select * into r from agreement_time_proposals where id = p_id for update;
  if not found then raise exception 'Fant ikke forslaget.'; end if;
  select * into p from proposals where id = r.proposal_id;
  if v_me is null or v_me not in (p.from_profile_id, p.to_profile_id) then
    raise exception 'Ikke tilgang.' using errcode = '42501';
  end if;
  if r.status <> 'PENDING' then raise exception 'Forslaget er allerede besvart.'; end if;
  select title into v_title from listings where id = p.listing_id;
  select split_part(display_name, ' ', 1) into v_name from profiles where id = v_me;

  if p_answer = 'WITHDRAW' then
    if r.proposed_by <> v_me then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
    update agreement_time_proposals set status = 'WITHDRAWN', responded_at = now() where id = r.id returning * into r;
    return r;
  end if;

  if r.proposed_by = v_me then raise exception 'Den andre må svare på forslaget.'; end if;

  if p_answer = 'ACCEPT' then
    select * into a from agreement_snapshots where proposal_id = p.id;
    if a.cancelled_at is not null or p.status::text <> 'ACCEPTED' then raise exception 'Avtalen gjelder ikke lenger.'; end if;
    if r.scheduled_at <= now() then raise exception 'Tidspunktet har passert. Foreslå et nytt.'; end if;
    update agreement_snapshots set scheduled_at = r.scheduled_at, scheduled_text = r.scheduled_text
     where proposal_id = p.id;
    update agreement_time_proposals set status = 'ACCEPTED', responded_at = now() where id = r.id returning * into r;
    insert into notifications (profile_id, kind, title, body, route)
      values (r.proposed_by, 'AGREED_TIME', 'Nytt tidspunkt avtalt',
              coalesce(v_name, 'Den andre') || ' godtok ' || r.scheduled_text || ' for «' || coalesce(v_title, 'oppdraget') || '».',
              '/avtale/' || p.id);
    insert into messages (conversation_id, author_id, kind, text)
      values (p.conversation_id, v_me, 'SYSTEM', 'Nytt tidspunkt avtalt: ' || r.scheduled_text);
  elsif p_answer = 'DECLINE' then
    update agreement_time_proposals set status = 'DECLINED', responded_at = now() where id = r.id returning * into r;
    insert into notifications (profile_id, kind, title, body, route)
      values (r.proposed_by, 'AGREED_TIME', 'Tidspunktet passet ikke',
              coalesce(v_name, 'Den andre') || ' kan ikke ' || r.scheduled_text || '. Avtalen står som før.',
              '/avtale/' || p.id);
  else
    raise exception 'Ukjent svar.';
  end if;
  return r;
end $$;
grant execute on function respond_agreement_time(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 1 + 4. Reminders (pg_cron, every 10 minutes)
-- ---------------------------------------------------------------------------
create table if not exists agreement_reminders (
  proposal_id uuid not null references agreement_snapshots(proposal_id) on delete cascade,
  kind text not null check (kind in ('EVE','HOUR','REPEAT')),
  -- the time the reminder was about: a moved avtale gets new reminders
  for_time timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (proposal_id, kind, for_time)
);
alter table agreement_reminders enable row level security;

create or replace function send_agreement_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare
  a record;
  v_n int := 0;
  v_now_local timestamp := now() at time zone 'Europe/Oslo';
  v_local timestamp;
  v_clock text;
  v_days int;
begin
  -- the evening before + about an hour before
  for a in
    select s.proposal_id, s.scheduled_at, p.from_profile_id, p.to_profile_id, l.title
      from agreement_snapshots s
      join proposals p on p.id = s.proposal_id
      join listings l on l.id = s.listing_id
     where s.cancelled_at is null and p.status::text = 'ACCEPTED'
       and s.scheduled_at is not null
       and s.scheduled_at > now() + interval '10 minutes'
       and s.scheduled_at < now() + interval '36 hours'
  loop
    v_local := a.scheduled_at at time zone 'Europe/Oslo';
    v_clock := to_char(v_local, 'HH24:MI');

    if a.scheduled_at <= now() + interval '65 minutes' then
      insert into agreement_reminders (proposal_id, kind, for_time)
        values (a.proposal_id, 'HOUR', a.scheduled_at) on conflict do nothing;
      if found then
        insert into notifications (profile_id, kind, title, body, route)
          select x, 'AGREED_TIME', 'Snart tid for oppdraget',
                 '«' || a.title || '» starter kl. ' || v_clock || '.', '/avtale/' || a.proposal_id
            from unnest(array[a.from_profile_id, a.to_profile_id]) x;
        v_n := v_n + 1;
      end if;
    elsif v_local::date = v_now_local::date + 1 and extract(hour from v_now_local) >= 18 then
      insert into agreement_reminders (proposal_id, kind, for_time)
        values (a.proposal_id, 'EVE', a.scheduled_at) on conflict do nothing;
      if found then
        insert into notifications (profile_id, kind, title, body, route)
          select x, 'AGREED_TIME', 'Husk avtalen i morgen',
                 '«' || a.title || '» i morgen kl. ' || v_clock || '.', '/avtale/' || a.proposal_id
            from unnest(array[a.from_profile_id, a.to_profile_id]) x;
        v_n := v_n + 1;
      end if;
    end if;
  end loop;

  -- a repeating oppdrag: two days before the next round is due, the poster is asked
  for a in
    select s.proposal_id, p.to_profile_id, p.from_profile_id, l.title, t.recurrence::text as recurrence,
           max(c.confirmed_at) as done_at,
           (select split_part(display_name, ' ', 1) from profiles where id = p.from_profile_id) as helper
      from agreement_snapshots s
      join proposals p on p.id = s.proposal_id
      join listings l on l.id = s.listing_id
      join task_details t on t.listing_id = l.id
      join completion_confirmations c on c.agreement_proposal_id = s.proposal_id
     where t.recurrence is not null and s.cancelled_at is null
       and l.status::text in ('COMPLETED','REVIEWED')
     group by s.proposal_id, p.to_profile_id, p.from_profile_id, l.title, t.recurrence
    having count(*) >= 2 and max(c.confirmed_at) > now() - interval '45 days'
  loop
    v_days := case a.recurrence when 'WEEKLY' then 7 when 'BIWEEKLY' then 14 else 30 end;
    if a.done_at + make_interval(days => v_days - 2) <= now()
       and extract(hour from v_now_local) between 9 and 20
       and not exists (select 1 from listings x where x.repeat_of = a.proposal_id) then
      insert into agreement_reminders (proposal_id, kind, for_time)
        values (a.proposal_id, 'REPEAT', a.done_at) on conflict do nothing;
      if found then
        insert into notifications (profile_id, kind, title, body, route)
          values (a.to_profile_id, 'AGREED_TIME', 'Tid for neste gang?',
                  '«' || a.title || '» ' ||
                  case a.recurrence when 'WEEKLY' then 'gjentas hver uke' when 'BIWEEKLY' then 'gjentas annenhver uke' else 'gjentas hver måned' end ||
                  '. Be ' || coalesce(a.helper, 'naboen') || ' om hjelp igjen.',
                  '/avtale/' || a.proposal_id);
        v_n := v_n + 1;
      end if;
    end if;
  end loop;
  return v_n;
end $$;
revoke execute on function send_agreement_reminders() from public, anon, authenticated;

-- pg_cron runs it. If the extension can't be created here, switch on "pg_cron" under
-- Database → Extensions in the Supabase dashboard and run the last block again.
do $$ begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron could not be enabled (%). Enable it in the dashboard.', sqlerrm;
end $$;
do $$ begin
  begin
    perform cron.unschedule('minnabo-reminders');
  exception when others then null;
  end;
  perform cron.schedule('minnabo-reminders', '*/10 * * * *', 'select public.send_agreement_reminders()');
exception when others then
  raise notice 'Reminders are not scheduled (%).', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Price guidance: the middle half of earlier tilbud in the category
-- ---------------------------------------------------------------------------
create or replace function price_guidance(p_category_slug text)
returns json language sql stable security definer set search_path = public as $$
  with x as (
    select pr.price_amount_minor / 100.0 as kr
      from proposals pr join listings l on l.id = pr.listing_id
     where l.category_slug = p_category_slug
       and pr.price_amount_minor > 0
       and pr.status::text <> 'WITHDRAWN'
       and pr.created_at > now() - interval '18 months'
  )
  select case when count(*) >= 5 then json_build_object(
           'low',  (round(percentile_cont(0.25) within group (order by kr) / 50) * 50)::int,
           'high', (round(percentile_cont(0.75) within group (order by kr) / 50) * 50)::int,
           'sampleSize', count(*))
         end
    from x;
$$;
grant execute on function price_guidance(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. App-icon badge: unread notifications + conversations with something unread
-- ---------------------------------------------------------------------------
create or replace function badge_count(p_profile uuid)
returns int language sql stable security definer set search_path = public as $$
  select (
    (select count(*) from notifications n where n.profile_id = p_profile and not n.read)
    +
    (select count(*) from conversation_participants cp
      where cp.profile_id = p_profile
        and exists (select 1 from messages m
                     where m.conversation_id = cp.conversation_id
                       and m.author_id <> p_profile and m.kind <> 'SYSTEM'
                       and m.created_at > coalesce(cp.last_read_at, 'epoch'::timestamptz)))
  )::int;
$$;
revoke execute on function badge_count(uuid) from public, anon, authenticated;
grant execute on function badge_count(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Foresatt (guardian) for a youth account
-- ---------------------------------------------------------------------------
create table if not exists guardian_links (
  id uuid primary key default gen_random_uuid(),
  youth_id uuid not null references profiles(id) on delete cascade,
  guardian_id uuid references profiles(id) on delete cascade,
  code text unique,
  code_expires_at timestamptz,
  created_at timestamptz not null default now(),
  linked_at timestamptz
);
create index if not exists guardian_links_youth_idx on guardian_links (youth_id);
create index if not exists guardian_links_guardian_idx on guardian_links (guardian_id);
alter table guardian_links enable row level security;

-- The youth makes a code and gives it to a parent.
create or replace function guardian_invite_code() returns text
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_code text;
begin
  if v_me is null or not is_youth(v_me) then
    raise exception 'Bare ungdomskontoer kan invitere en foresatt.';
  end if;
  delete from guardian_links where youth_id = v_me and guardian_id is null;
  loop
    -- 6 characters without the look-alikes (0/O, 1/I)
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from guardian_links where code = v_code);
  end loop;
  insert into guardian_links (youth_id, code, code_expires_at) values (v_me, v_code, now() + interval '7 days');
  return v_code;
end $$;
grant execute on function guardian_invite_code() to authenticated;

-- The parent types the code in.
create or replace function guardian_link(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); g guardian_links; v_name text; v_mine text;
begin
  if v_me is null then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if is_youth(v_me) then raise exception 'En foresatt må være over 18 år.'; end if;
  select * into g from guardian_links
   where code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) and guardian_id is null for update;
  if not found or g.code_expires_at < now() then
    raise exception 'Koden er feil eller har utløpt. Be om en ny kode.';
  end if;
  if g.youth_id = v_me then raise exception 'Du kan ikke være foresatt for deg selv.'; end if;
  if exists (select 1 from guardian_links where youth_id = g.youth_id and guardian_id = v_me) then
    delete from guardian_links where id = g.id;
  else
    update guardian_links set guardian_id = v_me, linked_at = now(), code = null, code_expires_at = null where id = g.id;
  end if;
  select display_name into v_name from profiles where id = g.youth_id;
  select display_name into v_mine from profiles where id = v_me;
  insert into notifications (profile_id, kind, title, body, route)
    values (g.youth_id, 'MODERATION', 'Foresatt koblet til',
            coalesce(v_mine, 'En foresatt') || ' får nå beskjed når du får en avtale.', '/ung');
  return v_name;
end $$;
grant execute on function guardian_link(text) to authenticated;

create or replace function guardian_unlink(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from guardian_links where id = p_id and auth.uid() in (youth_id, guardian_id);
end $$;
grant execute on function guardian_unlink(uuid) to authenticated;

-- What I see: as a youth my foresatte and my open code; as a foresatt the youths I follow.
create or replace function my_guardian_links() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'youth', is_youth(auth.uid()),
    'code', (select json_build_object('code', code, 'expiresAt', code_expires_at) from guardian_links
              where youth_id = auth.uid() and guardian_id is null and code_expires_at > now() limit 1),
    'guardians', coalesce((select json_agg(json_build_object('id', g.id, 'name', p.display_name) order by g.linked_at)
                             from guardian_links g join profiles p on p.id = g.guardian_id
                            where g.youth_id = auth.uid()), '[]'::json),
    'youths', coalesce((select json_agg(json_build_object('id', g.id, 'name', p.display_name, 'age', p.youth_age) order by g.linked_at)
                          from guardian_links g join profiles p on p.id = g.youth_id
                         where g.guardian_id = auth.uid()), '[]'::json));
$$;
grant execute on function my_guardian_links() to authenticated;

-- The foresatt is told who the avtale is with and when – and if it is called off.
create or replace function proposals_notify_guardians() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_youth uuid; v_other uuid; v_yname text; v_oname text; v_title text; v_when text; g record;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status::text <> 'ACCEPTED' and not (old.status::text = 'ACCEPTED' and new.status::text = 'CANCELLED') then
    return new;
  end if;
  if is_youth(new.from_profile_id) then v_youth := new.from_profile_id; v_other := new.to_profile_id;
  elsif is_youth(new.to_profile_id) then v_youth := new.to_profile_id; v_other := new.from_profile_id;
  else return new;
  end if;
  if not exists (select 1 from guardian_links where youth_id = v_youth and guardian_id is not null) then return new; end if;

  select split_part(display_name, ' ', 1) into v_yname from profiles where id = v_youth;
  select display_name into v_oname from profiles where id = v_other;
  select title into v_title from listings where id = new.listing_id;
  v_when := coalesce(nullif(trim(coalesce(new.scheduled_text, '')), ''), 'tid ikke avtalt ennå');

  for g in select guardian_id from guardian_links where youth_id = v_youth and guardian_id is not null loop
    if new.status::text = 'ACCEPTED' then
      insert into notifications (profile_id, kind, title, body, route)
        values (g.guardian_id, 'OFFER_ACCEPTED', coalesce(v_yname, 'Ungdommen') || ' har fått en avtale',
                '«' || coalesce(v_title, 'Oppdrag') || '» med ' || coalesce(v_oname, 'en nabo') || ' · ' || v_when || '.',
                '/innstillinger');
    else
      insert into notifications (profile_id, kind, title, body, route)
        values (g.guardian_id, 'AGREEMENT_CANCELLED', 'Avtalen til ' || coalesce(v_yname, 'ungdommen') || ' er avlyst',
                '«' || coalesce(v_title, 'Oppdrag') || '» med ' || coalesce(v_oname, 'en nabo') || ' blir ikke noe av.',
                '/innstillinger');
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists t_proposals_notify_guardians on proposals;
create trigger t_proposals_notify_guardians after update of status on proposals
  for each row execute function proposals_notify_guardians();

-- ---------------------------------------------------------------------------
-- 8. Spam limits + word filter
-- ---------------------------------------------------------------------------
-- New oppdrag: at most 3 in ten minutes and 8 in a day (tilbud, messages, reports
-- and svar on oppslag already have limits).
create or replace function listings_rate_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_short int; v_day int;
begin
  if auth.uid() is null or is_admin() then return new; end if;
  select count(*) filter (where created_at > now() - interval '10 minutes'),
         count(*) filter (where created_at > now() - interval '24 hours')
    into v_short, v_day from listings where owner_id = new.owner_id;
  if v_short >= 3 then raise exception 'For mange oppdrag på kort tid. Vent litt og prøv igjen.'; end if;
  if v_day >= 8 then raise exception 'Du har lagt ut mange oppdrag i dag. Prøv igjen i morgen.'; end if;
  return new;
end $$;
drop trigger if exists t_listings_rate on listings;
create trigger t_listings_rate before insert on listings
  for each row execute function listings_rate_guard();

create or replace function notices_rate_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_day int;
begin
  if auth.uid() is null or is_admin() then return new; end if;
  select count(*) into v_day from noticeboard_posts
   where author_id = new.author_id and created_at > now() - interval '24 hours';
  if v_day >= 5 then raise exception 'Du har lagt ut mange oppslag i dag. Prøv igjen i morgen.'; end if;
  return new;
end $$;
drop trigger if exists t_notices_rate on noticeboard_posts;
create trigger t_notices_rate before insert on noticeboard_posts
  for each row execute function notices_rate_guard();

-- Words that are never allowed in public text. Admins can add and remove rows.
create table if not exists banned_words (word text primary key check (word = lower(word) and word ~ '^[a-zæøå]+$'));
alter table banned_words enable row level security;
drop policy if exists p_banned_admin on banned_words;
create policy p_banned_admin on banned_words for all to authenticated using (is_admin()) with check (is_admin());
insert into banned_words (word) values
  ('hore'),('horer'),('horunge'),('fitte'),('fittetryne'),('kuk'),('kukk'),('kuksuger'),
  ('neger'),('nigger'),('svarting'),('pakkis'),('mongo'),('mongoloid'),('jødejævel'),
  ('fuck'),('fucking'),('bitch'),('cunt'),('whore'),('slut'),('faggot'),('retard')
on conflict do nothing;

-- whole words only ("skuket" is fine, "kuk" is not)
create or replace function has_banned_word(p_text text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_text is not null and exists (
    select 1 from banned_words b
     where lower(p_text) ~ ('(^|[^a-zæøå0-9])' || b.word || '($|[^a-zæøå0-9])'));
$$;

-- The checked columns are the trigger's arguments.
create or replace function block_banned_words() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_row jsonb := to_jsonb(new);
begin
  -- tg_argv starts at 0
  for i in 0 .. tg_nargs - 1 loop
    if has_banned_word(v_row ->> tg_argv[i]) then
      raise exception 'Teksten inneholder ord som ikke er tillatt på MinNabo.';
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists t_words_listings on listings;
create trigger t_words_listings before insert or update of title on listings
  for each row execute function block_banned_words('title');
drop trigger if exists t_words_task_details on task_details;
create trigger t_words_task_details before insert or update of description on task_details
  for each row execute function block_banned_words('description');
drop trigger if exists t_words_notices on noticeboard_posts;
create trigger t_words_notices before insert or update of title, body on noticeboard_posts
  for each row execute function block_banned_words('title', 'body');
drop trigger if exists t_words_notice_comments on notice_comments;
create trigger t_words_notice_comments before insert or update of body on notice_comments
  for each row execute function block_banned_words('body');
drop trigger if exists t_words_reviews on reviews;
create trigger t_words_reviews before insert or update of comment on reviews
  for each row execute function block_banned_words('comment');
drop trigger if exists t_words_profiles on profiles;
create trigger t_words_profiles before update of display_name, presentation on profiles
  for each row execute function block_banned_words('display_name', 'presentation');

-- ---------------------------------------------------------------------------
-- 9. Waiting list for other kommuner
-- ---------------------------------------------------------------------------
create table if not exists kommune_waitlist (
  profile_id uuid not null references profiles(id) on delete cascade,
  kommune text not null check (length(trim(kommune)) between 2 and 60),
  created_at timestamptz not null default now(),
  primary key (profile_id, kommune)
);
alter table kommune_waitlist enable row level security;
drop policy if exists p_waitlist_own on kommune_waitlist;
create policy p_waitlist_own on kommune_waitlist for all to authenticated
  using (profile_id = auth.uid() or is_admin()) with check (profile_id = auth.uid());

-- Admin: where to launch next.
create or replace function admin_waitlist() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  return coalesce((select json_agg(json_build_object('kommune', kommune, 'count', n) order by n desc, kommune)
                     from (select kommune, count(*) as n from kommune_waitlist group by kommune) x), '[]'::json);
end $$;
grant execute on function admin_waitlist() to authenticated;
