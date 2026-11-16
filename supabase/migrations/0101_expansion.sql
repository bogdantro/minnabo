-- 0101_expansion.sql
--  Asked 2026-11-11 («utvid appen»). One migration for the backend of these app features:
--    1. Faste avtaler: an avtale that repeats every 1, 2 or 4 weeks, with a reminder before each visit and
--       one review when it ends (or when its season is over), not one per visit.
--    2. AI: a small usage log so «Skriv oppdraget fra et bilde» and «Vis på norsk» can't be overused.
--    3. (Før- og etterbilder already live in the Jobbdag workspace.)
--    4. «Jeg vil ha den»: a queue on «Gis bort».
--    5. Arrangementer: a type for an event oppslag (dugnad is one kind), «Kommer» / «Kanskje».
--    6. Avstemning on an oppslag.
--    7. «Ting jeg låner ut»: a lending library on the profile, with requests.
--    8. A group chat for the people coming to an arrangement; it closes 7 days after.
--    9. Translation of a chat message («Vis på norsk»), kept on the message.
--   10. Reactions on oppslag.
--   11. Ferdighetsmerker: how many finished jobs a helper has per category.
--   12. Husstand: two adults in one home see each other's oppdrag and avtaler (read only).
--   13. Fordeler for hjelpere: a partner's offer to helpers; the code is only given to someone with a finished job.
--   14. Foresatt i appen: what the youth a foresatt follows has coming up, and «Trygg tur» status.
--  Youth accounts (rule 5): may queue on «Gis bort», answer events, vote, react, borrow and see their own
--  avtale photos; may not lend out, join a household or use the event group chat.

-- ---------------------------------------------------------------------------
-- 1. Faste avtaler
-- ---------------------------------------------------------------------------
alter table agreement_snapshots add column if not exists repeat_every_days int;
alter table agreement_snapshots add column if not exists repeat_until date;
alter table agreement_snapshots add column if not exists repeat_set_by uuid references profiles(id) on delete set null;
alter table agreement_snapshots add column if not exists repeat_ended_at timestamptz;
alter table agreement_snapshots drop constraint if exists agreement_repeat_every_check;
alter table agreement_snapshots add constraint agreement_repeat_every_check check (repeat_every_days is null or repeat_every_days in (7, 14, 28));

create table if not exists agreement_visits (
  proposal_id uuid not null references agreement_snapshots(proposal_id) on delete cascade,
  visit_at timestamptz not null,
  done_at timestamptz not null default now(),
  done_by uuid references profiles(id) on delete set null,
  primary key (proposal_id, visit_at)
);
alter table agreement_visits enable row level security;
drop policy if exists p_agreement_visits_read on agreement_visits;
create policy p_agreement_visits_read on agreement_visits for select to authenticated
  using (exists (select 1 from proposals p where p.id = proposal_id and auth.uid() in (p.from_profile_id, p.to_profile_id)));
revoke insert, update, delete on agreement_visits from anon, authenticated;

-- The next visit of a fast avtale at or after p_from: the first time plus whole steps of the interval.
-- Null when it isn't a fast avtale, it has ended, or the next visit is after repeat_until.
create or replace function next_agreement_visit(p_proposal uuid, p_from timestamptz default now()) returns timestamptz
language sql stable security definer set search_path = public as $$
  select case
    when s.repeat_every_days is null or s.repeat_ended_at is not null or s.scheduled_at is null or s.cancelled_at is not null then null
    else (
      select v from (
        select s.scheduled_at + make_interval(days => s.repeat_every_days * greatest(0,
                 ceil(extract(epoch from (p_from - s.scheduled_at)) / (s.repeat_every_days * 86400.0))::int)) as v
      ) x
      where s.repeat_until is null or (v at time zone 'Europe/Oslo')::date <= s.repeat_until
    )
  end
  from agreement_snapshots s where s.proposal_id = p_proposal;
$$;
revoke all on function next_agreement_visit(uuid, timestamptz) from public, anon;
grant execute on function next_agreement_visit(uuid, timestamptz) to authenticated;

create or replace function set_agreement_repeat(p_proposal uuid, p_every int, p_until date default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; s agreement_snapshots; v_other uuid; v_title text; v_word text;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  select * into p from proposals where id = p_proposal;
  if not found or v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Fant ikke avtalen.'; end if;
  select * into s from agreement_snapshots where proposal_id = p_proposal;
  if not found or p.status::text <> 'ACCEPTED' or s.cancelled_at is not null then raise exception 'Avtalen er ikke aktiv.'; end if;
  if s.scheduled_at is null then raise exception 'Avtal første gang først, så kan den gjentas.'; end if;
  if p_every not in (7, 14, 28) then raise exception 'Velg hver uke, annenhver uke eller hver fjerde uke.'; end if;
  if p_until is not null and p_until < (s.scheduled_at at time zone 'Europe/Oslo')::date then
    raise exception 'Sluttdatoen må være etter første gang.';
  end if;
  update agreement_snapshots set repeat_every_days = p_every, repeat_until = p_until, repeat_set_by = v_me, repeat_ended_at = null
   where proposal_id = p_proposal;
  v_other := case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end;
  select title into v_title from listings where id = p.listing_id;
  v_word := case p_every when 7 then 'hver uke' when 14 then 'annenhver uke' else 'hver fjerde uke' end;
  insert into notifications (profile_id, kind, title, body, route)
    values (v_other, 'AGREED_TIME', coalesce(first_name(v_me), 'Naboen') || ' gjorde avtalen fast',
            '«' || coalesce(v_title, 'Oppdrag') || '» gjentas ' || v_word || '.', '/avtale/' || p_proposal);
end $$;
revoke all on function set_agreement_repeat(uuid, int, date) from public, anon;
grant execute on function set_agreement_repeat(uuid, int, date) to authenticated;

create or replace function end_agreement_repeat(p_proposal uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_other uuid; v_title text;
begin
  select * into p from proposals where id = p_proposal;
  if not found or v_me is null or v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Fant ikke avtalen.'; end if;
  update agreement_snapshots set repeat_ended_at = now()
   where proposal_id = p_proposal and repeat_every_days is not null and repeat_ended_at is null;
  if not found then return; end if;
  v_other := case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end;
  select title into v_title from listings where id = p.listing_id;
  insert into notifications (profile_id, kind, title, body, route)
    values (v_other, 'AGREED_TIME', 'Den faste avtalen er avsluttet',
            '«' || coalesce(v_title, 'Oppdrag') || '». Fullfør og gi en vurdering når siste gang er gjort.', '/avtale/' || p_proposal);
end $$;
revoke all on function end_agreement_repeat(uuid) from public, anon;
grant execute on function end_agreement_repeat(uuid) to authenticated;

-- «Denne gangen er gjort»: one row per visit, so both can see the history.
create or replace function mark_agreement_visit(p_proposal uuid, p_visit_at timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; s agreement_snapshots;
begin
  select * into p from proposals where id = p_proposal;
  if not found or v_me is null or v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Fant ikke avtalen.'; end if;
  select * into s from agreement_snapshots where proposal_id = p_proposal;
  if s.repeat_every_days is null then raise exception 'Dette er ikke en fast avtale.'; end if;
  if p_visit_at > now() + interval '12 hours' then raise exception 'Den gangen har ikke vært ennå.'; end if;
  insert into agreement_visits (proposal_id, visit_at, done_by) values (p_proposal, p_visit_at, v_me) on conflict do nothing;
end $$;
revoke all on function mark_agreement_visit(uuid, timestamptz) from public, anon;
grant execute on function mark_agreement_visit(uuid, timestamptz) to authenticated;

-- Reminders for the visits after the first (the first one is send_agreement_reminders, 0053),
-- and the end of the season: then both are asked to finish and review once.
create or replace function send_repeat_visit_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare a record; v_n int := 0; v_next timestamptz; v_local timestamp; v_now_local timestamp := now() at time zone 'Europe/Oslo';
begin
  for a in
    select s.proposal_id, s.scheduled_at, s.repeat_until, p.from_profile_id, p.to_profile_id, l.title
      from agreement_snapshots s join proposals p on p.id = s.proposal_id join listings l on l.id = s.listing_id
     where s.repeat_every_days is not null and s.repeat_ended_at is null and s.cancelled_at is null and p.status::text = 'ACCEPTED'
  loop
    -- the season is over
    if a.repeat_until is not null and a.repeat_until < v_now_local::date then
      update agreement_snapshots set repeat_ended_at = now() where proposal_id = a.proposal_id;
      insert into notifications (profile_id, kind, title, body, route)
        select x, 'AGREED_TIME', 'Sesongen er over', '«' || a.title || '». Fullfør avtalen og gi en vurdering.', '/avtale/' || a.proposal_id
          from unnest(array[a.from_profile_id, a.to_profile_id]) x;
      v_n := v_n + 1;
      continue;
    end if;
    v_next := next_agreement_visit(a.proposal_id, now() + interval '10 minutes');
    if v_next is null or v_next = a.scheduled_at or v_next > now() + interval '36 hours' then continue; end if;
    v_local := v_next at time zone 'Europe/Oslo';
    if v_local::date = v_now_local::date + 1 and extract(hour from v_now_local) >= 18 then
      insert into agreement_reminders (proposal_id, kind, for_time) values (a.proposal_id, 'EVE', v_next) on conflict do nothing;
      if found then
        insert into notifications (profile_id, kind, title, body, route)
          select x, 'AGREED_TIME', 'Husk den faste avtalen i morgen',
                 '«' || a.title || '» i morgen kl. ' || to_char(v_local, 'HH24:MI') || '.', '/avtale/' || a.proposal_id
            from unnest(array[a.from_profile_id, a.to_profile_id]) x;
        v_n := v_n + 1;
      end if;
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function send_repeat_visit_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. AI usage (edge functions draft-from-photo and translate-message write here)
-- ---------------------------------------------------------------------------
create table if not exists ai_usage (
  id bigint generated always as identity primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('PHOTO_DRAFT','TRANSLATE')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_profile_idx on ai_usage (profile_id, kind, created_at desc);
alter table ai_usage enable row level security;
revoke all on ai_usage from anon, authenticated;

-- The two Claude features stay hidden until Admin › Innstillinger › «KI-hjelp i appen» is on
-- (after ANTHROPIC_API_KEY is set on the edge functions draft-from-photo and translate-message).
insert into app_settings (key, value) values ('platform.ai_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 4. «Jeg vil ha den»: a queue on «Gis bort»
-- ---------------------------------------------------------------------------
create table if not exists notice_reservations (
  notice_id uuid not null references noticeboard_posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'QUEUED' check (status in ('QUEUED','OFFERED','TAKEN','SKIPPED')),
  created_at timestamptz not null default now(),
  offered_at timestamptz,
  primary key (notice_id, profile_id)
);
create index if not exists notice_reservations_queue_idx on notice_reservations (notice_id, created_at);
alter table notice_reservations enable row level security;
drop policy if exists p_notice_reservations_read on notice_reservations;
-- my own place in a queue, and the whole queue on my own oppslag
create policy p_notice_reservations_read on notice_reservations for select to authenticated
  using (profile_id = auth.uid() or exists (select 1 from noticeboard_posts n where n.id = notice_id and n.author_id = auth.uid()));
revoke insert, update, delete on notice_reservations from anon, authenticated;

-- the first one waiting gets it: told, and the owner is told who
create or replace function offer_next_reservation(p_notice uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare n noticeboard_posts; v_next uuid;
begin
  select * into n from noticeboard_posts where id = p_notice;
  if exists (select 1 from notice_reservations where notice_id = p_notice and status in ('OFFERED','TAKEN')) then return null; end if;
  select profile_id into v_next from notice_reservations where notice_id = p_notice and status = 'QUEUED' order by created_at limit 1;
  if v_next is null then return null; end if;
  update notice_reservations set status = 'OFFERED', offered_at = now() where notice_id = p_notice and profile_id = v_next;
  insert into notifications (profile_id, kind, title, body, route) values
    (v_next, 'NOTICE_REPLY'::text::notification_kind, 'Det er din tur', '«' || n.title || '» er din hvis du vil ha den. Avtal henting i oppslaget.', '/oppslagstavle?oppslag=' || p_notice),
    (n.author_id, 'NOTICE_REPLY'::text::notification_kind, coalesce(first_name(v_next), 'En nabo') || ' står først i køen', '«' || n.title || '»', '/oppslagstavle?oppslag=' || p_notice);
  return v_next;
end $$;
revoke all on function offer_next_reservation(uuid) from public, anon, authenticated;

create or replace function reserve_notice(p_notice uuid, p_join boolean) returns int
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); n noticeboard_posts; v_pos int; v_was text;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  select * into n from noticeboard_posts where id = p_notice and hidden_at is null;
  if not found or n.kind::text <> 'GIVEAWAY' then raise exception 'Fant ikke oppslaget.'; end if;
  if n.neighbourhood_id is not null and not is_nabolag_member(n.neighbourhood_id) then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if n.author_id = v_me then raise exception 'Dette er ditt eget oppslag.'; end if;
  if p_join then
    if n.done_at is not null then raise exception 'Den er allerede gitt bort.'; end if;
    if (select count(*) from notice_reservations where notice_id = p_notice and status in ('QUEUED','OFFERED')) >= 20 then
      raise exception 'Køen er full.';
    end if;
    insert into notice_reservations (notice_id, profile_id) values (p_notice, v_me) on conflict do nothing;
    perform offer_next_reservation(p_notice);
  else
    select status into v_was from notice_reservations where notice_id = p_notice and profile_id = v_me;
    delete from notice_reservations where notice_id = p_notice and profile_id = v_me and status in ('QUEUED','OFFERED');
    if v_was = 'OFFERED' then perform offer_next_reservation(p_notice); end if;
  end if;
  select count(*)::int into v_pos from notice_reservations r
   where r.notice_id = p_notice and r.status in ('QUEUED','OFFERED')
     and r.created_at <= coalesce((select created_at from notice_reservations where notice_id = p_notice and profile_id = v_me), '-infinity');
  return v_pos;
end $$;
revoke all on function reserve_notice(uuid, boolean) from public, anon;
grant execute on function reserve_notice(uuid, boolean) to authenticated;

-- The owner: the one offered took it (the oppslag is closed), or didn't come (the next one gets it).
create or replace function settle_reservation(p_notice uuid, p_taken boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); n noticeboard_posts; v_cur uuid;
begin
  select * into n from noticeboard_posts where id = p_notice;
  if not found or n.author_id <> v_me then raise exception 'Fant ikke oppslaget.'; end if;
  select profile_id into v_cur from notice_reservations where notice_id = p_notice and status = 'OFFERED';
  if v_cur is null then raise exception 'Ingen står først i køen.'; end if;
  if p_taken then
    update notice_reservations set status = 'TAKEN' where notice_id = p_notice and profile_id = v_cur;
    update noticeboard_posts set done_at = now() where id = p_notice and done_at is null;
    return v_cur;
  end if;
  update notice_reservations set status = 'SKIPPED' where notice_id = p_notice and profile_id = v_cur;
  insert into notifications (profile_id, kind, title, body, route)
    values (v_cur, 'NOTICE_REPLY'::text::notification_kind, 'Den gikk videre', '«' || n.title || '» gikk til neste i køen.', '/oppslagstavle?oppslag=' || p_notice);
  return offer_next_reservation(p_notice);
end $$;
revoke all on function settle_reservation(uuid, boolean) from public, anon;
grant execute on function settle_reservation(uuid, boolean) to authenticated;

-- how many wait, and my own place (0 = not in the queue)
create or replace function notice_queue(p_notice uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'waiting', (select count(*) from notice_reservations where notice_id = p_notice and status in ('QUEUED','OFFERED')),
    'mine', coalesce((select r.status from notice_reservations r where r.notice_id = p_notice and r.profile_id = auth.uid()), ''),
    'position', coalesce((select count(*) from notice_reservations r where r.notice_id = p_notice and r.status in ('QUEUED','OFFERED')
        and r.created_at <= (select created_at from notice_reservations where notice_id = p_notice and profile_id = auth.uid() and status in ('QUEUED','OFFERED'))), 0)
  )
  where exists (select 1 from noticeboard_posts n where n.id = p_notice);
$$;
revoke all on function notice_queue(uuid) from public, anon;
grant execute on function notice_queue(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Arrangementer
-- ---------------------------------------------------------------------------
alter table noticeboard_posts add column if not exists event_type text;
alter table noticeboard_posts drop constraint if exists notice_event_type_check;
alter table noticeboard_posts add constraint notice_event_type_check
  check (event_type is null or event_type in ('DUGNAD','LOPPEMARKED','QUIZ','FEST','MOTE','TUR','ANNET'));
update noticeboard_posts set event_type = 'DUGNAD' where is_dugnad and event_type is null;

alter table notice_signups add column if not exists status text not null default 'GOING';
alter table notice_signups drop constraint if exists notice_signups_status_check;
alter table notice_signups add constraint notice_signups_status_check check (status in ('GOING','MAYBE'));

-- «Kommer» / «Kanskje» / null to say no more
create or replace function set_event_rsvp(p_notice uuid, p_status text) returns json
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); n noticeboard_posts; v_new boolean;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  select * into n from noticeboard_posts where id = p_notice and hidden_at is null;
  if not found or (n.event_type is null and not n.is_dugnad) then raise exception 'Fant ikke arrangementet.'; end if;
  if n.neighbourhood_id is not null and not is_nabolag_member(n.neighbourhood_id) then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if p_status is null then
    delete from notice_signups where notice_id = p_notice and profile_id = v_me;
  else
    if p_status not in ('GOING','MAYBE') then raise exception 'Ugyldig svar.'; end if;
    if n.done_at is not null or (n.event_at is not null and n.event_at < now()) then raise exception 'Arrangementet er over.'; end if;
    v_new := not exists (select 1 from notice_signups where notice_id = p_notice and profile_id = v_me);
    insert into notice_signups (notice_id, profile_id, status) values (p_notice, v_me, p_status)
      on conflict (notice_id, profile_id) do update set status = excluded.status;
    if v_new and p_status = 'GOING' and n.author_id <> v_me then
      insert into notifications (profile_id, kind, title, body, route)
        values (n.author_id, 'NOTICE_REPLY'::text::notification_kind, coalesce(first_name(v_me), 'En nabo') || ' kommer',
                '«' || n.title || '»', '/oppslagstavle?oppslag=' || n.id);
    end if;
  end if;
  return json_build_object(
    'going', (select count(*) from notice_signups where notice_id = p_notice and status = 'GOING'),
    'maybe', (select count(*) from notice_signups where notice_id = p_notice and status = 'MAYBE'));
end $$;
revoke all on function set_event_rsvp(uuid, text) from public, anon;
grant execute on function set_event_rsvp(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Avstemning
-- ---------------------------------------------------------------------------
alter table noticeboard_posts add column if not exists poll_options text[];
alter table noticeboard_posts add column if not exists poll_closes_at timestamptz;
alter table noticeboard_posts drop constraint if exists notice_poll_options_check;
alter table noticeboard_posts add constraint notice_poll_options_check
  check (poll_options is null or (array_length(poll_options, 1) between 2 and 6));

create table if not exists notice_votes (
  notice_id uuid not null references noticeboard_posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  option_index int not null,
  created_at timestamptz not null default now(),
  primary key (notice_id, profile_id)
);
alter table notice_votes enable row level security;
-- only my own vote is readable; totals come from notice_poll()
drop policy if exists p_notice_votes_read on notice_votes;
create policy p_notice_votes_read on notice_votes for select to authenticated using (profile_id = auth.uid());
revoke insert, update, delete on notice_votes from anon, authenticated;

create or replace function vote_notice_poll(p_notice uuid, p_option int) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); n noticeboard_posts;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  select * into n from noticeboard_posts where id = p_notice and hidden_at is null;
  if not found or n.poll_options is null then raise exception 'Fant ikke avstemningen.'; end if;
  if n.neighbourhood_id is not null and not is_nabolag_member(n.neighbourhood_id) then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if n.done_at is not null or (n.poll_closes_at is not null and n.poll_closes_at < now()) then raise exception 'Avstemningen er stengt.'; end if;
  if p_option is null then
    delete from notice_votes where notice_id = p_notice and profile_id = v_me;
    return;
  end if;
  if p_option < 0 or p_option >= array_length(n.poll_options, 1) then raise exception 'Ugyldig valg.'; end if;
  insert into notice_votes (notice_id, profile_id, option_index) values (p_notice, v_me, p_option)
    on conflict (notice_id, profile_id) do update set option_index = excluded.option_index, created_at = now();
end $$;
revoke all on function vote_notice_poll(uuid, int) from public, anon;
grant execute on function vote_notice_poll(uuid, int) to authenticated;

create or replace function notice_poll(p_notice uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'counts', (select coalesce(json_agg(c order by i), '[]'::json) from (
        select i, (select count(*) from notice_votes v where v.notice_id = n.id and v.option_index = i - 1) as c
          from generate_series(1, array_length(n.poll_options, 1)) i) x),
    'mine', (select option_index from notice_votes where notice_id = n.id and profile_id = auth.uid()),
    'total', (select count(*) from notice_votes where notice_id = n.id))
  from noticeboard_posts n
  where n.id = p_notice and n.poll_options is not null
    and (n.neighbourhood_id is null or is_nabolag_member(n.neighbourhood_id));
$$;
revoke all on function notice_poll(uuid) from public, anon;
grant execute on function notice_poll(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. «Ting jeg låner ut»
-- ---------------------------------------------------------------------------
create table if not exists lend_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 60),
  category text not null default 'ANNET' check (category in ('VERKTOY','HAGE','FRITID','KJOKKEN','TRANSPORT','ANNET')),
  note text check (note is null or char_length(note) <= 300),
  image_path text,
  municipality text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists lend_items_owner_idx on lend_items (owner_id);
create index if not exists lend_items_kommune_idx on lend_items (municipality) where active;
alter table lend_items enable row level security;
drop policy if exists p_lend_items_read on lend_items;
create policy p_lend_items_read on lend_items for select to authenticated
  using (owner_id = auth.uid() or (active and exists (select 1 from profiles p where p.id = owner_id and p.deleted_at is null and p.suspended_at is null)));
drop policy if exists p_lend_items_write on lend_items;
create policy p_lend_items_write on lend_items for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function lend_items_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_youth(new.owner_id) then raise exception 'Utlån er ikke tilgjengelig for ungdomskontoer.' using errcode = '42501'; end if;
  if tg_op = 'INSERT' and (select count(*) from lend_items where owner_id = new.owner_id) >= 30 then
    raise exception 'Du kan ha opptil 30 ting i utlånslisten.';
  end if;
  if new.image_path is not null and new.image_path not like new.owner_id::text || '/%' then raise exception 'Ugyldig bilde.'; end if;
  new.municipality := coalesce((select municipality from profiles where id = new.owner_id), '');
  return new;
end $$;
drop trigger if exists t_lend_items_guard on lend_items;
create trigger t_lend_items_guard before insert or update on lend_items for each row execute function lend_items_guard();

create table if not exists lend_requests (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references lend_items(id) on delete cascade,
  borrower_id uuid not null references profiles(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','DECLINED','CANCELLED')),
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create index if not exists lend_requests_item_idx on lend_requests (item_id, from_date);
alter table lend_requests enable row level security;
drop policy if exists p_lend_requests_read on lend_requests;
create policy p_lend_requests_read on lend_requests for select to authenticated
  using (borrower_id = auth.uid() or exists (select 1 from lend_items i where i.id = item_id and i.owner_id = auth.uid()));
revoke insert, update, delete on lend_requests from anon, authenticated;

create or replace function request_lend(p_item uuid, p_from date, p_to date, p_note text default null) returns lend_requests
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); i lend_items; r lend_requests;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  select * into i from lend_items where id = p_item and active;
  if not found then raise exception 'Fant ikke tingen.'; end if;
  if i.owner_id = v_me then raise exception 'Dette er din egen ting.'; end if;
  if exists (select 1 from blocks b where (b.by_profile_id = i.owner_id and b.blocked_profile_id = v_me) or (b.by_profile_id = v_me and b.blocked_profile_id = i.owner_id)) then
    raise exception 'Ikke tilgang.' using errcode = '42501';
  end if;
  if p_from < current_date or p_to < p_from or p_to > p_from + 30 then raise exception 'Velg opptil 30 dager, fra i dag.'; end if;
  if exists (select 1 from lend_requests where item_id = p_item and status = 'ACCEPTED' and daterange(from_date, to_date, '[]') && daterange(p_from, p_to, '[]')) then
    raise exception 'Den er lånt ut da. Velg andre dager.';
  end if;
  if (select count(*) from lend_requests where borrower_id = v_me and status = 'PENDING') >= 5 then
    raise exception 'Du har mange forespørsler som venter. Vent på svar først.';
  end if;
  insert into lend_requests (item_id, borrower_id, from_date, to_date, note) values (p_item, v_me, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''))
    returning * into r;
  insert into notifications (profile_id, kind, title, body, route)
    values (i.owner_id, 'NOTICE_REPLY'::text::notification_kind, coalesce(first_name(v_me), 'En nabo') || ' vil låne ' || i.title,
            to_char(p_from, 'DD.MM') || '–' || to_char(p_to, 'DD.MM'), '/utlan?fane=foresporsler');
  return r;
end $$;
revoke all on function request_lend(uuid, date, date, text) from public, anon;
grant execute on function request_lend(uuid, date, date, text) to authenticated;

create or replace function respond_lend(p_id uuid, p_status text) returns lend_requests
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); r lend_requests; i lend_items;
begin
  select * into r from lend_requests where id = p_id for update;
  if not found then raise exception 'Fant ikke forespørselen.'; end if;
  select * into i from lend_items where id = r.item_id;
  if p_status = 'CANCELLED' then
    if r.borrower_id <> v_me then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  elsif p_status in ('ACCEPTED','DECLINED') then
    if i.owner_id <> v_me then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
    if r.status <> 'PENDING' then raise exception 'Forespørselen er allerede besvart.'; end if;
    if p_status = 'ACCEPTED' and exists (select 1 from lend_requests x where x.item_id = r.item_id and x.id <> r.id and x.status = 'ACCEPTED'
        and daterange(x.from_date, x.to_date, '[]') && daterange(r.from_date, r.to_date, '[]')) then
      raise exception 'Den er allerede lånt ut noen av de dagene.';
    end if;
  else
    raise exception 'Ugyldig svar.';
  end if;
  update lend_requests set status = p_status where id = p_id returning * into r;
  if p_status in ('ACCEPTED','DECLINED') then
    insert into notifications (profile_id, kind, title, body, route)
      values (r.borrower_id, 'NOTICE_REPLY'::text::notification_kind,
              case when p_status = 'ACCEPTED' then 'Du kan låne ' || i.title else coalesce(first_name(v_me), 'Naboen') || ' kan ikke låne ut ' || i.title || ' da' end,
              to_char(r.from_date, 'DD.MM') || '–' || to_char(r.to_date, 'DD.MM'), '/utlan?fane=foresporsler');
  end if;
  return r;
end $$;
revoke all on function respond_lend(uuid, text) from public, anon;
grant execute on function respond_lend(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Chat for an arrangement (not for youth accounts)
-- ---------------------------------------------------------------------------
create table if not exists event_messages (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references noticeboard_posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists event_messages_idx on event_messages (notice_id, created_at);

-- the author and everyone who said «Kommer» or «Kanskje», adults only, until 7 days after
create or replace function can_use_event_chat(p_notice uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and not is_youth(auth.uid()) and exists (
    select 1 from noticeboard_posts n
     where n.id = p_notice and n.hidden_at is null and (n.event_type is not null or n.is_dugnad)
       and (n.event_at is null or n.event_at > now() - interval '7 days')
       and (n.author_id = auth.uid() or exists (select 1 from notice_signups s where s.notice_id = n.id and s.profile_id = auth.uid())));
$$;
revoke all on function can_use_event_chat(uuid) from public, anon;
grant execute on function can_use_event_chat(uuid) to authenticated;

alter table event_messages enable row level security;
drop policy if exists p_event_messages_read on event_messages;
create policy p_event_messages_read on event_messages for select to authenticated using (can_use_event_chat(notice_id));
revoke insert, update, delete on event_messages from anon, authenticated;

create or replace function post_event_message(p_notice uuid, p_body text) returns event_messages
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); m event_messages;
begin
  if not can_use_event_chat(p_notice) then raise exception 'Chatten er stengt.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'Skriv en melding.'; end if;
  if (select count(*) from event_messages where author_id = v_me and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Du sender veldig fort. Vent litt.';
  end if;
  insert into event_messages (notice_id, author_id, body) values (p_notice, v_me, left(btrim(p_body), 1000)) returning * into m;
  return m;
end $$;
revoke all on function post_event_message(uuid, text) from public, anon;
grant execute on function post_event_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. «Vis på norsk»: the translation is kept on the message, made once for both
-- ---------------------------------------------------------------------------
alter table messages add column if not exists translation_nb text;
alter table messages add column if not exists translation_from text;

-- ---------------------------------------------------------------------------
-- 10. Reactions on oppslag
-- ---------------------------------------------------------------------------
create table if not exists notice_reactions (
  notice_id uuid not null references noticeboard_posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍','😂','😮','🙏','🎉')),
  created_at timestamptz not null default now(),
  primary key (notice_id, profile_id, emoji)
);
alter table notice_reactions enable row level security;
drop policy if exists p_notice_reactions_read on notice_reactions;
create policy p_notice_reactions_read on notice_reactions for select to authenticated
  using (exists (select 1 from noticeboard_posts n where n.id = notice_id));
drop policy if exists p_notice_reactions_write on notice_reactions;
create policy p_notice_reactions_write on notice_reactions for insert to authenticated
  with check (profile_id = auth.uid() and exists (select 1 from noticeboard_posts n where n.id = notice_id));
drop policy if exists p_notice_reactions_delete on notice_reactions;
create policy p_notice_reactions_delete on notice_reactions for delete to authenticated using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 11. Ferdighetsmerker: finished jobs per category, as a helper
-- ---------------------------------------------------------------------------
create or replace function profile_category_jobs(p_profile uuid) returns table (category_slug text, jobs int)
language sql stable security definer set search_path = public as $$
  select l.category_slug::text, count(*)::int
    from proposals p
    join listings l on l.id = p.listing_id
   where p.from_profile_id = p_profile and p.status::text = 'ACCEPTED'
     and (select count(*) from completion_confirmations c where c.agreement_proposal_id = p.id) >= 2
   group by l.category_slug
   order by 2 desc;
$$;
revoke all on function profile_category_jobs(uuid) from public, anon;
grant execute on function profile_category_jobs(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Husstand
-- ---------------------------------------------------------------------------
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  profile_id uuid not null unique references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, profile_id)
);
create table if not exists household_invites (
  code text primary key,
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null
);
alter table households enable row level security;
alter table household_members enable row level security;
alter table household_invites enable row level security;
revoke all on households, household_members, household_invites from anon, authenticated;

create or replace function household_invite_code() returns text
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_house uuid; v_code text;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  if is_youth(v_me) then raise exception 'Husstand er ikke tilgjengelig for ungdomskontoer.' using errcode = '42501'; end if;
  select household_id into v_house from household_members where profile_id = v_me;
  if v_house is null then
    insert into households default values returning id into v_house;
    insert into household_members (household_id, profile_id) values (v_house, v_me);
  end if;
  if (select count(*) from household_members where household_id = v_house) >= 2 then
    raise exception 'Husstanden har allerede to personer.';
  end if;
  delete from household_invites where household_id = v_house;
  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from household_invites where code = v_code);
  end loop;
  insert into household_invites (code, household_id, created_by, expires_at) values (v_code, v_house, v_me, now() + interval '7 days');
  return v_code;
end $$;
revoke all on function household_invite_code() from public, anon;
grant execute on function household_invite_code() to authenticated;

create or replace function household_join(p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); i household_invites;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  if is_youth(v_me) then raise exception 'Husstand er ikke tilgjengelig for ungdomskontoer.' using errcode = '42501'; end if;
  select * into i from household_invites where code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) and expires_at > now();
  if not found then raise exception 'Koden er feil eller utløpt.'; end if;
  if i.created_by = v_me then raise exception 'Det er din egen kode. Gi den til den du bor med.'; end if;
  if exists (select 1 from household_members where profile_id = v_me) then raise exception 'Du er allerede i en husstand. Forlat den først.'; end if;
  if (select count(*) from household_members where household_id = i.household_id) >= 2 then raise exception 'Husstanden har allerede to personer.'; end if;
  insert into household_members (household_id, profile_id) values (i.household_id, v_me);
  delete from household_invites where household_id = i.household_id;
  insert into notifications (profile_id, kind, title, body, route)
    values (i.created_by, 'NOTICE_REPLY'::text::notification_kind, coalesce(first_name(v_me), 'Naboen') || ' er med i husstanden din',
            'Dere ser nå hverandres oppdrag og avtaler.', '/husstand');
end $$;
revoke all on function household_join(text) from public, anon;
grant execute on function household_join(text) to authenticated;

create or replace function household_leave() returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_house uuid;
begin
  select household_id into v_house from household_members where profile_id = v_me;
  if v_house is null then return; end if;
  delete from household_members where profile_id = v_me;
  if not exists (select 1 from household_members where household_id = v_house) then delete from households where id = v_house; end if;
end $$;
revoke all on function household_leave() from public, anon;
grant execute on function household_leave() to authenticated;

-- What I see: who I live with, their open oppdrag and their coming avtaler (read only), and an open code.
create or replace function my_household() returns json
language sql stable security definer set search_path = public as $$
  with me as (select household_id from household_members where profile_id = auth.uid()),
       other as (select m.profile_id from household_members m, me where m.household_id = me.household_id and m.profile_id <> auth.uid())
  select json_build_object(
    'inHousehold', exists (select 1 from me),
    'code', (select json_build_object('code', i.code, 'expiresAt', i.expires_at) from household_invites i, me
               where i.household_id = me.household_id and i.expires_at > now() limit 1),
    'partner', (select json_build_object('id', p.id, 'name', p.display_name) from profiles p, other where p.id = other.profile_id),
    'listings', coalesce((select json_agg(json_build_object('id', l.id, 'title', l.title, 'status', l.status, 'createdAt', l.created_at) order by l.created_at desc)
                  from listings l, other where l.owner_id = other.profile_id and l.status::text in ('PUBLISHED','RECEIVING_OFFERS','OFFER_ACCEPTED')), '[]'::json),
    'agreements', coalesce((select json_agg(json_build_object(
                    'proposalId', p.id, 'title', l.title, 'scheduledAt', s.scheduled_at, 'scheduledText', p.scheduled_text,
                    'with', (select display_name from profiles where id = case when p.from_profile_id = other.profile_id then p.to_profile_id else p.from_profile_id end))
                    order by s.scheduled_at nulls last)
                  from proposals p join agreement_snapshots s on s.proposal_id = p.id join listings l on l.id = p.listing_id, other
                 where other.profile_id in (p.from_profile_id, p.to_profile_id) and p.status::text = 'ACCEPTED' and s.cancelled_at is null
                   and not exists (select 1 from completion_confirmations c where c.agreement_proposal_id = p.id
                                   group by c.agreement_proposal_id having count(*) >= 2)), '[]'::json));
$$;
revoke all on function my_household() from public, anon;
grant execute on function my_household() to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Fordeler for hjelpere
-- ---------------------------------------------------------------------------
alter table partners add column if not exists helper_offer text;
alter table partners add column if not exists helper_offer_until date;
create table if not exists partner_helper_codes (
  partner_id uuid primary key references partners(id) on delete cascade,
  code text not null check (char_length(code) between 2 and 40)
);
alter table partner_helper_codes enable row level security;
revoke all on partner_helper_codes from anon, authenticated;

-- the code only for someone who has finished at least one job as a helper
create or replace function partner_helper_code(p_partner uuid) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from proposals p where p.from_profile_id = auth.uid() and p.status::text = 'ACCEPTED'
       and (select count(*) from completion_confirmations c where c.agreement_proposal_id = p.id) >= 2) then
    return null;
  end if;
  return (select c.code from partner_helper_codes c join partners pa on pa.id = c.partner_id
           where c.partner_id = p_partner and pa.helper_offer is not null
             and (pa.helper_offer_until is null or pa.helper_offer_until >= current_date));
end $$;
revoke all on function partner_helper_code(uuid) from public, anon;
grant execute on function partner_helper_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 14. Foresatt i appen
-- ---------------------------------------------------------------------------
create or replace function guardian_overview() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', y.id, 'name', y.display_name, 'age', y.youth_age,
    'agreements', coalesce((select json_agg(json_build_object(
        'title', l.title, 'with', (select display_name from profiles where id = case when p.from_profile_id = y.id then p.to_profile_id else p.from_profile_id end),
        'scheduledAt', s.scheduled_at, 'scheduledText', p.scheduled_text, 'place', l.place)
        order by s.scheduled_at nulls last)
      from proposals p join agreement_snapshots s on s.proposal_id = p.id join listings l on l.id = p.listing_id
     where y.id in (p.from_profile_id, p.to_profile_id) and p.status::text = 'ACCEPTED' and s.cancelled_at is null
       and (s.scheduled_at is null or s.scheduled_at > now() - interval '12 hours')
       and not exists (select 1 from completion_confirmations c where c.agreement_proposal_id = p.id group by c.agreement_proposal_id having count(*) >= 2)), '[]'::json),
    'trip', (select json_build_object('startedAt', t.started_at, 'dueAt', t.due_at, 'checkedInAt', t.checked_in_at, 'alertedAt', t.alerted_at)
               from safe_trips t where t.owner_id = y.id and t.started_at > now() - interval '24 hours'
              order by t.started_at desc limit 1)
  ) order by g.linked_at), '[]'::json)
  from guardian_links g join profiles y on y.id = g.youth_id
  where g.guardian_id = auth.uid();
$$;
revoke all on function guardian_overview() from public, anon;
grant execute on function guardian_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- Schedules
-- ---------------------------------------------------------------------------
do $$ begin
  begin
    perform cron.unschedule('minnabo-repeat-visits');
  exception when others then null;
  end;
  perform cron.schedule('minnabo-repeat-visits', '*/10 * * * *', 'select public.send_repeat_visit_reminders()');
exception when others then
  raise notice 'Repeat reminders are not scheduled (%).', sqlerrm;
end $$;
