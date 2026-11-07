-- 0090_dugnad_and_tool_loans.sql
--  Asked 2026-11-06: two things for Oppslagstavla.
--    * Dugnad: an oppslag with a day and time that people sign up for, with a list and a reminder
--      the day before. It stays kind GENERAL (+ is_dugnad) so an older app shows it as a normal oppslag.
--    * Utlån av verktøy: ask to borrow a tool for some days. The owner says yes or no, others see which
--      days are taken, and the borrower is reminded on the last day.
--  Youth accounts are locked out of Fellesskap (rule 5): the functions refuse them on the server.

alter table noticeboard_posts add column if not exists is_dugnad boolean not null default false;
alter table noticeboard_posts add column if not exists event_at timestamptz;

create table if not exists notice_signups (
  notice_id uuid not null references noticeboard_posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (notice_id, profile_id)
);
alter table notice_signups enable row level security;
drop policy if exists p_notice_signups_read on notice_signups;
-- the noticeboard's own policy decides who can see the oppslag, so also who sees the list
create policy p_notice_signups_read on notice_signups for select to authenticated
  using (exists (select 1 from noticeboard_posts n where n.id = notice_id));
revoke insert, update, delete on notice_signups from anon, authenticated;

create or replace function set_dugnad_signup(p_notice_id uuid, p_join boolean) returns int
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); n noticeboard_posts; v_name text; v_count int;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  if is_youth(v_me) then raise exception 'Fellesskap er låst for ungdomskontoer.' using errcode = '42501'; end if;
  select * into n from noticeboard_posts where id = p_notice_id and hidden_at is null;
  if not found or not n.is_dugnad then raise exception 'Fant ikke dugnaden.'; end if;
  if n.neighbourhood_id is not null and not is_nabolag_member(n.neighbourhood_id) then
    raise exception 'Ikke tilgang.' using errcode = '42501';
  end if;

  if p_join then
    if n.done_at is not null or (n.event_at is not null and n.event_at < now()) then
      raise exception 'Dugnaden er over.';
    end if;
    insert into notice_signups (notice_id, profile_id) values (p_notice_id, v_me) on conflict do nothing;
    if found and n.author_id <> v_me then
      v_name := first_name(v_me);
      insert into notifications (profile_id, kind, title, body, route)
        values (n.author_id, 'NOTICE_REPLY'::text::notification_kind, coalesce(v_name, 'En nabo') || ' blir med på dugnaden',
                '«' || n.title || '»', '/oppslagstavle?oppslag=' || n.id);
    end if;
  else
    delete from notice_signups where notice_id = p_notice_id and profile_id = v_me;
  end if;
  select count(*)::int into v_count from notice_signups where notice_id = p_notice_id;
  return v_count;
end $$;
revoke all on function set_dugnad_signup(uuid, boolean) from public, anon;
grant execute on function set_dugnad_signup(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Tool loans
-- ---------------------------------------------------------------------------
create table if not exists tool_bookings (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references noticeboard_posts(id) on delete cascade,
  borrower_id uuid not null references profiles(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  note text check (note is null or char_length(note) <= 200),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','DECLINED','RETURNED','CANCELLED')),
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tool_bookings_dates check (to_date >= from_date and to_date <= from_date + 30)
);
create index if not exists tool_bookings_notice_idx on tool_bookings (notice_id, from_date);
alter table tool_bookings enable row level security;
drop policy if exists p_tool_bookings_read on tool_bookings;
create policy p_tool_bookings_read on tool_bookings for select to authenticated
  using (borrower_id = auth.uid()
         or exists (select 1 from noticeboard_posts n where n.id = notice_id and n.author_id = auth.uid()));
revoke insert, update, delete on tool_bookings from anon, authenticated;

-- The days that are taken, without saying by whom.
create or replace function tool_booked_days(p_notice_id uuid) returns table (from_date date, to_date date)
language sql stable security definer set search_path = public as $$
  select b.from_date, b.to_date from tool_bookings b
   where b.notice_id = p_notice_id and b.status = 'APPROVED' and b.to_date >= current_date
     and exists (select 1 from noticeboard_posts n where n.id = p_notice_id)
   order by b.from_date;
$$;
revoke all on function tool_booked_days(uuid) from public, anon;
grant execute on function tool_booked_days(uuid) to authenticated;

create or replace function request_tool_booking(p_notice_id uuid, p_from date, p_to date, p_note text) returns tool_bookings
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); n noticeboard_posts; v_name text; b tool_bookings; v_open int;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  if is_youth(v_me) then raise exception 'Fellesskap er låst for ungdomskontoer.' using errcode = '42501'; end if;
  select * into n from noticeboard_posts where id = p_notice_id and hidden_at is null;
  if not found or n.kind::text <> 'TOOL_LEND' then raise exception 'Fant ikke oppslaget.'; end if;
  if n.done_at is not null then raise exception 'Oppslaget er avsluttet.'; end if;
  if n.author_id = v_me then raise exception 'Dette er ditt eget verktøy.'; end if;
  if p_from < current_date then raise exception 'Velg en dag fra i dag og framover.'; end if;
  if p_to < p_from then raise exception 'Siste dag kan ikke være før første dag.'; end if;
  if p_to > p_from + 30 then raise exception 'Du kan låne i maks 30 dager om gangen.'; end if;
  if exists (select 1 from blocks x where (x.by_profile_id = n.author_id and x.blocked_profile_id = v_me)
                                       or (x.by_profile_id = v_me and x.blocked_profile_id = n.author_id)) then
    raise exception 'Du kan ikke låne her.' using errcode = '42501';
  end if;
  if exists (select 1 from tool_bookings t where t.notice_id = p_notice_id and t.status = 'APPROVED'
              and t.from_date <= p_to and t.to_date >= p_from) then
    raise exception 'Noen av dagene er allerede tatt.';
  end if;
  select count(*) into v_open from tool_bookings t
   where t.notice_id = p_notice_id and t.borrower_id = v_me and t.status = 'PENDING';
  if v_open > 0 then raise exception 'Du har allerede en forespørsel som venter på svar.'; end if;

  insert into tool_bookings (notice_id, borrower_id, from_date, to_date, note)
    values (p_notice_id, v_me, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''))
    returning * into b;
  v_name := first_name(v_me);
  insert into notifications (profile_id, kind, title, body, route)
    values (n.author_id, 'NOTICE_REPLY'::text::notification_kind, coalesce(v_name, 'En nabo') || ' vil låne',
            '«' || n.title || '» · ' || to_char(p_from, 'DD.MM') || '–' || to_char(p_to, 'DD.MM'),
            '/oppslagstavle?oppslag=' || n.id);
  return b;
end $$;
revoke all on function request_tool_booking(uuid, date, date, text) from public, anon;
grant execute on function request_tool_booking(uuid, date, date, text) to authenticated;

-- APPROVED / DECLINED by the owner · RETURNED by the owner · CANCELLED by the borrower.
create or replace function respond_tool_booking(p_id uuid, p_status text) returns tool_bookings
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); b tool_bookings; n noticeboard_posts;
begin
  select * into b from tool_bookings where id = p_id for update;
  if not found then raise exception 'Fant ikke forespørselen.'; end if;
  select * into n from noticeboard_posts where id = b.notice_id;

  if p_status in ('APPROVED','DECLINED','RETURNED') then
    if n.author_id is distinct from v_me then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  elsif p_status = 'CANCELLED' then
    if b.borrower_id is distinct from v_me then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  else
    raise exception 'Ugyldig valg.';
  end if;
  if p_status = 'APPROVED' and exists (
    select 1 from tool_bookings t where t.notice_id = b.notice_id and t.id <> b.id and t.status = 'APPROVED'
       and t.from_date <= b.to_date and t.to_date >= b.from_date) then
    raise exception 'Noen av dagene er allerede lånt ut.';
  end if;

  update tool_bookings set status = p_status where id = p_id returning * into b;
  if p_status in ('APPROVED','DECLINED') then
    insert into notifications (profile_id, kind, title, body, route)
      values (b.borrower_id, 'NOTICE_REPLY'::text::notification_kind,
              case when p_status = 'APPROVED' then 'Du kan låne' else 'Lånet passer ikke' end,
              '«' || n.title || '» · ' || to_char(b.from_date, 'DD.MM') || '–' || to_char(b.to_date, 'DD.MM'),
              '/oppslagstavle?oppslag=' || n.id);
  end if;
  return b;
end $$;
revoke all on function respond_tool_booking(uuid, text) from public, anon;
grant execute on function respond_tool_booking(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reminders: the dugnad the day before, the loan on its last day. Evening hour, once.
-- ---------------------------------------------------------------------------
create table if not exists dugnad_reminders (
  notice_id uuid not null references noticeboard_posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (notice_id, profile_id)
);
alter table dugnad_reminders enable row level security;
revoke all on dugnad_reminders from public, anon, authenticated;

create or replace function send_community_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v int := 0;
begin
  for r in
    select n.id, n.title, n.event_at, n.author_id, s.profile_id
      from noticeboard_posts n
      join (select notice_id, profile_id from notice_signups
            union select id, author_id from noticeboard_posts where is_dugnad) s on s.notice_id = n.id
     where n.is_dugnad and n.done_at is null and n.hidden_at is null
       and n.event_at > now() and n.event_at <= now() + interval '24 hours'
       and not exists (select 1 from dugnad_reminders d where d.notice_id = n.id and d.profile_id = s.profile_id)
  loop
    insert into dugnad_reminders (notice_id, profile_id) values (r.id, r.profile_id);
    insert into notifications (profile_id, kind, title, body, route)
      values (r.profile_id, 'NOTICE_REPLY'::text::notification_kind, 'Dugnad i morgen',
              '«' || r.title || '» · kl. ' || to_char(r.event_at at time zone 'Europe/Oslo', 'HH24:MI'),
              '/oppslagstavle?oppslag=' || r.id);
    v := v + 1;
  end loop;

  for r in
    select b.id, b.borrower_id, n.title, n.id as notice_id
      from tool_bookings b join noticeboard_posts n on n.id = b.notice_id
     where b.status = 'APPROVED' and b.to_date = (now() at time zone 'Europe/Oslo')::date and b.reminded_at is null
  loop
    update tool_bookings set reminded_at = now() where id = r.id;
    insert into notifications (profile_id, kind, title, body, route)
      values (r.borrower_id, 'NOTICE_REPLY'::text::notification_kind, 'Husk å levere tilbake',
              '«' || r.title || '» skal tilbake i dag.', '/oppslagstavle?oppslag=' || r.notice_id);
    v := v + 1;
  end loop;
  return v;
end $$;
revoke all on function send_community_reminders() from public, anon, authenticated;

do $$ begin
  begin
    perform cron.unschedule('minnabo-community-reminders');
  exception when others then null;
  end;
  -- 16:30 UTC = 17:30 in winter, 18:30 in summer
  perform cron.schedule('minnabo-community-reminders', '30 16 * * *', 'select public.send_community_reminders()');
exception when others then
  raise notice 'Community reminders are not scheduled (%). Enable pg_cron and run this block again.', sqlerrm;
end $$;
