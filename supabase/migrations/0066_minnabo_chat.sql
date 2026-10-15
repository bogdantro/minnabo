-- 0066_minnabo_chat.sql
-- «MinNabo» in Innboks: messages from MinNabo (the website's admin) to one person or to
-- many, which the person can answer. A message to many can be plain, a news item or a poll.
--
-- Until now «Send melding» in the admin only made a varsel: nothing in Innboks, no reply.
--
--  * minnabo_broadcasts   one row per message sent to many (kind MESSAGE / NEWS / POLL,
--                         who it went to, poll options)
--  * minnabo_messages     each person's thread with MinNabo: one row per message, both ways.
--                         A broadcast is copied into every recipient's thread.
--  * minnabo_poll_votes   one vote per person and poll (can be changed until it closes)
--
-- The app reads and writes only through the functions at the bottom of section 3.
-- The website (connects as postgres) uses section 2 and reads the tables + the view
-- minnabo_broadcast_stats directly. Nothing existing is changed.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists minnabo_broadcasts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('MESSAGE', 'NEWS', 'POLL')),
  title text,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  poll_options text[],
  poll_closes_at timestamptz,
  -- {"municipalities": ["Lillehammer"], "nabolag": ["<uuid>"], "account": "all" | "adult" | "youth"}
  audience jsonb not null default '{}'::jsonb,
  recipients integer not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  check (kind <> 'POLL' or (poll_options is not null and array_length(poll_options, 1) between 2 and 6))
);

create table if not exists minnabo_messages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  from_admin boolean not null,
  staff text,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  -- set on the copy of a broadcast in this person's thread
  broadcast_id uuid references minnabo_broadcasts(id) on delete cascade,
  -- set on a person's answer: the broadcast they were answering (the last one they got)
  reply_to_broadcast_id uuid references minnabo_broadcasts(id) on delete set null,
  created_at timestamptz not null default now(),
  -- from_admin: when the person read it. Otherwise: when the admin read it (the website sets it).
  read_at timestamptz
);
create index if not exists minnabo_messages_thread_idx on minnabo_messages(profile_id, created_at);
create index if not exists minnabo_messages_broadcast_idx on minnabo_messages(broadcast_id) where broadcast_id is not null;
create index if not exists minnabo_messages_reply_idx on minnabo_messages(reply_to_broadcast_id) where reply_to_broadcast_id is not null;

create table if not exists minnabo_poll_votes (
  broadcast_id uuid not null references minnabo_broadcasts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  option integer not null,
  created_at timestamptz not null default now(),
  primary key (broadcast_id, profile_id)
);

alter table minnabo_broadcasts enable row level security;
alter table minnabo_messages enable row level security;
alter table minnabo_poll_votes enable row level security;
-- no policies: clients go through the functions
revoke all on minnabo_broadcasts, minnabo_messages, minnabo_poll_votes from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 2. For the website's admin (not callable from the app)
-- ---------------------------------------------------------------------------
-- Who a message goes to. Empty filters = everyone. Deleted accounts and admins never.
create or replace function minnabo_audience(p_audience jsonb)
returns setof uuid language sql stable security definer set search_path = public as $$
  with f as (
    select coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_audience->'municipalities', '[]'::jsonb)) x), '{}') as kommuner,
           coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_audience->'nabolag', '[]'::jsonb)) x), '{}') as nabolag,
           coalesce(nullif(p_audience->>'account', ''), 'all') as account
  )
  select p.id from profiles p, f
   where p.deleted_at is null and p.role <> 'admin'
     and (cardinality(f.kommuner) = 0 or p.municipality = any(f.kommuner))
     and (cardinality(f.nabolag) = 0
          or exists (select 1 from neighbourhood_members m where m.profile_id = p.id and m.neighbourhood_id = any(f.nabolag)))
     and (f.account = 'all' or (f.account = 'youth') = is_youth(p.id));
$$;

-- «Sendes til N personer» before sending.
create or replace function minnabo_audience_count(p_audience jsonb)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from minnabo_audience(p_audience);
$$;

-- One person.
create or replace function minnabo_send_message(p_profile uuid, p_body text, p_staff text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_body text := btrim(coalesce(p_body, ''));
begin
  if not exists (select 1 from profiles where id = p_profile and deleted_at is null) then
    raise exception 'Fant ikke brukeren.';
  end if;
  insert into minnabo_messages (profile_id, from_admin, staff, body)
    values (p_profile, true, p_staff, v_body) returning id into v_id;
  perform notify_moderation(p_profile, 'Melding fra MinNabo', left(v_body, 140), '/minnabo');
  return v_id;
end $$;

-- Many people: a message, a news item (with a title) or a poll (2–6 options).
create or replace function minnabo_send_broadcast(
  p_kind text, p_title text, p_body text, p_options text[] default null,
  p_audience jsonb default '{}'::jsonb, p_staff text default null, p_closes_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int; v_body text := btrim(coalesce(p_body, '')); v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if p_kind = 'NEWS' and v_title is null then raise exception 'En nyhet må ha en tittel.'; end if;
  insert into minnabo_broadcasts (kind, title, body, poll_options, poll_closes_at, audience, created_by)
    values (p_kind, v_title, v_body, case when p_kind = 'POLL' then p_options end,
            case when p_kind = 'POLL' then p_closes_at end, coalesce(p_audience, '{}'::jsonb), p_staff)
    returning id into v_id;

  insert into minnabo_messages (profile_id, from_admin, staff, body, broadcast_id)
    select a, true, p_staff, v_body, v_id from minnabo_audience(p_audience) a;
  get diagnostics v_n = row_count;
  update minnabo_broadcasts set recipients = v_n where id = v_id;

  insert into notifications (profile_id, kind, title, body, route)
    select m.profile_id, 'MODERATION',
           case p_kind when 'POLL' then 'Spørsmål fra MinNabo' when 'NEWS' then coalesce(v_title, 'Nytt fra MinNabo') else 'Melding fra MinNabo' end,
           left(v_body, 140), '/minnabo'
      from minnabo_messages m where m.broadcast_id = v_id;
  return v_id;
end $$;

revoke all on function minnabo_audience(jsonb) from public, anon, authenticated;
revoke all on function minnabo_audience_count(jsonb) from public, anon, authenticated;
revoke all on function minnabo_send_message(uuid, text, text) from public, anon, authenticated;
revoke all on function minnabo_send_broadcast(text, text, text, text[], jsonb, text, timestamptz) from public, anon, authenticated;

-- Per broadcast: how many got it, read it, answered, and the votes per option (1-based).
create or replace view minnabo_broadcast_stats as
select b.id, b.kind, b.title, b.body, b.poll_options, b.poll_closes_at, b.audience, b.created_by, b.created_at,
       b.recipients,
       (select count(*)::int from minnabo_messages m where m.broadcast_id = b.id and m.read_at is not null) as read_count,
       (select count(*)::int from minnabo_messages m where m.reply_to_broadcast_id = b.id) as reply_count,
       (select count(*)::int from minnabo_poll_votes v where v.broadcast_id = b.id) as vote_count,
       case when b.kind = 'POLL' then
         (select array_agg((select count(*)::int from minnabo_poll_votes v where v.broadcast_id = b.id and v.option = o.i) order by o.i)
            from generate_series(1, array_length(b.poll_options, 1)) as o(i))
       end as votes
  from minnabo_broadcasts b;
revoke all on minnabo_broadcast_stats from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 3. For the app
-- ---------------------------------------------------------------------------
-- My thread, oldest first. A poll shows the result once I have voted or it has closed.
create or replace function minnabo_thread()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(t order by t."createdAt"), '[]'::json) from (
    select m.id, m.from_admin as "fromAdmin", m.body, m.created_at as "createdAt", m.read_at as "readAt",
           b.id as "broadcastId", coalesce(b.kind, 'MESSAGE') as kind, b.title,
           b.poll_options as "pollOptions",
           (b.poll_closes_at is not null and b.poll_closes_at <= now()) as "pollClosed",
           v.option as "myVote",
           case when b.kind = 'POLL' and (v.option is not null or (b.poll_closes_at is not null and b.poll_closes_at <= now())) then
             (select array_agg((select count(*)::int from minnabo_poll_votes x where x.broadcast_id = b.id and x.option = o.i) order by o.i)
                from generate_series(1, array_length(b.poll_options, 1)) as o(i))
           end as "pollCounts"
      from minnabo_messages m
      left join minnabo_broadcasts b on b.id = m.broadcast_id
      left join minnabo_poll_votes v on v.broadcast_id = b.id and v.profile_id = m.profile_id
     where m.profile_id = auth.uid()
  ) t;
$$;

create or replace function minnabo_unread()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from minnabo_messages where profile_id = auth.uid() and from_admin and read_at is null;
$$;

create or replace function minnabo_mark_read()
returns void language sql security definer set search_path = public as $$
  update minnabo_messages set read_at = now() where profile_id = auth.uid() and from_admin and read_at is null;
$$;

-- Answer MinNabo. The answer is tied to the last broadcast the person got, so the admin
-- can see the answers to one news item or poll together.
create or replace function minnabo_reply(p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_id uuid; v_body text := btrim(coalesce(p_body, '')); v_last uuid;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  if exists (select 1 from profiles where id = v_me and deleted_at is not null) then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if char_length(v_body) < 1 then raise exception 'Skriv en melding.'; end if;
  if char_length(v_body) > 2000 then raise exception 'Meldingen kan ha høyst 2000 tegn.'; end if;
  if (select count(*) from minnabo_messages
       where profile_id = v_me and not from_admin and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'Du har sendt mange meldinger i dag. Prøv igjen i morgen.';
  end if;
  select broadcast_id into v_last from minnabo_messages
   where profile_id = v_me and from_admin order by created_at desc limit 1;
  insert into minnabo_messages (profile_id, from_admin, body, reply_to_broadcast_id)
    values (v_me, false, v_body, v_last) returning id into v_id;
  return v_id;
end $$;

-- Vote in a poll I have received. Voting again changes the vote, until the poll closes.
create or replace function minnabo_vote(p_broadcast uuid, p_option integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); b minnabo_broadcasts;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  select * into b from minnabo_broadcasts where id = p_broadcast and kind = 'POLL';
  if not found or not exists (select 1 from minnabo_messages where broadcast_id = p_broadcast and profile_id = v_me) then
    raise exception 'Fant ikke spørsmålet.';
  end if;
  if b.poll_closes_at is not null and b.poll_closes_at <= now() then raise exception 'Avstemningen er avsluttet.'; end if;
  if p_option is null or p_option < 1 or p_option > array_length(b.poll_options, 1) then raise exception 'Ugyldig valg.'; end if;
  insert into minnabo_poll_votes (broadcast_id, profile_id, option) values (p_broadcast, v_me, p_option)
  on conflict (broadcast_id, profile_id) do update set option = excluded.option, created_at = now();
end $$;

revoke all on function minnabo_thread() from public, anon;
revoke all on function minnabo_unread() from public, anon;
revoke all on function minnabo_mark_read() from public, anon;
revoke all on function minnabo_reply(text) from public, anon;
revoke all on function minnabo_vote(uuid, integer) from public, anon;
grant execute on function minnabo_thread(), minnabo_unread(), minnabo_mark_read(), minnabo_reply(text), minnabo_vote(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Storage period
-- ---------------------------------------------------------------------------
-- Gone at once when the account is deleted; otherwise 24 months, like other messages.
create or replace function minnabo_drop_on_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    delete from minnabo_messages where profile_id = new.id;
    delete from minnabo_poll_votes where profile_id = new.id;
  end if;
  return new;
end $$;
revoke all on function minnabo_drop_on_delete() from public, anon, authenticated;
drop trigger if exists t_minnabo_drop_on_delete on profiles;
create trigger t_minnabo_drop_on_delete after update of deleted_at on profiles
  for each row execute function minnabo_drop_on_delete();

create or replace function minnabo_purge_old()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  delete from minnabo_messages where created_at < now() - interval '24 months';
  get diagnostics v_n = row_count;
  delete from minnabo_broadcasts b where b.created_at < now() - interval '24 months'
     and not exists (select 1 from minnabo_messages m where m.broadcast_id = b.id);
  return v_n;
end $$;
revoke all on function minnabo_purge_old() from public, anon, authenticated;

do $$ begin
  begin
    perform cron.unschedule('minnabo-chat-retention');
  exception when others then null;
  end;
  perform cron.schedule('minnabo-chat-retention', '25 3 * * *', 'select public.minnabo_purge_old()');
exception when others then
  raise notice 'MinNabo chat clean-up is not scheduled (%).', sqlerrm;
end $$;
