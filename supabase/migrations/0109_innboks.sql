-- 0109_innboks.sql
--  Asked 2026-11-15 («Do this»): the Innboks ideas (docs/IDEAS.md part 3) that need the database.
--    1. Per conversation for me: pinned, snoozed until, muted until (on top of «Demp» = muted for good).
--    2. Edit a sent message for 15 minutes («redigert»).
--    3. Schedule a message («Send i morgen kl 08»), sent by a job every minute.
--    4. Away mode: an automatic reply once per conversation while I'm away.
--    5. Read receipts off: the other person no longer sees how far I have read (and I don't see theirs).
--    6. «Skjul når jeg er aktiv»: a setting the app reads before it shows me as online.
--    7. Search across all my conversations, voice message transcripts included.
--    8. Which conversations I have written in («Forespørsler» = the ones I haven't), and which have photos or videos.
--    9. A short video or a PDF in the chat: a TEXT message with an attachment, so older apps show the line of text.
--   10. «Del adresse»: only with an avtale, can be withdrawn, hidden a day after the job is done.
--   11. Auto-archive conversations about closed oppdrag after 30 days (a setting, on by default).
--   12. Quiet hours: pushes are held and sent in the morning instead of being dropped (send-push + a job).

-- ---------------------------------------------------------------------------
-- 1. pinned, snoozed, muted until
-- ---------------------------------------------------------------------------
alter table conversation_participants add column if not exists pinned_at timestamptz;
alter table conversation_participants add column if not exists snoozed_until timestamptz;
alter table conversation_participants add column if not exists muted_until timestamptz;

create or replace function set_conversation_flags(p_conversation uuid, p_pinned boolean default null,
                                                  p_snooze_until timestamptz default null, p_clear_snooze boolean default false,
                                                  p_muted_until timestamptz default null, p_clear_mute boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_participant(p_conversation) then raise exception 'Fant ikke samtalen.'; end if;
  if p_pinned is not null and p_pinned
     and (select count(*) from conversation_participants where profile_id = auth.uid() and pinned_at is not null and conversation_id <> p_conversation) >= 5 then
    raise exception 'Du kan feste 5 samtaler. Løsne en først.';
  end if;
  update conversation_participants set
    pinned_at = case when p_pinned is null then pinned_at when p_pinned then now() else null end,
    snoozed_until = case when p_clear_snooze then null else coalesce(p_snooze_until, snoozed_until) end,
    muted_until = case when p_clear_mute then null else coalesce(p_muted_until, muted_until) end
  where conversation_id = p_conversation and profile_id = auth.uid();
end $$;
revoke all on function set_conversation_flags(uuid, boolean, timestamptz, boolean, timestamptz, boolean) from public, anon;
grant execute on function set_conversation_flags(uuid, boolean, timestamptz, boolean, timestamptz, boolean) to authenticated;

-- a new message ends a snooze: the conversation is back, unread, at the top
create or replace function messages_end_snooze() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversation_participants set snoozed_until = null
   where conversation_id = new.conversation_id and profile_id <> new.author_id and snoozed_until is not null;
  return new;
end $$;
drop trigger if exists t_messages_end_snooze on messages;
create trigger t_messages_end_snooze after insert on messages for each row execute function messages_end_snooze();

-- ---------------------------------------------------------------------------
-- 2. edit a message for 15 minutes
-- ---------------------------------------------------------------------------
alter table messages add column if not exists edited_at timestamptz;
-- 9. a video or a PDF rides on a TEXT message (see below)
alter table messages add column if not exists attachment_kind text check (attachment_kind is null or attachment_kind in ('VIDEO', 'FILE'));
alter table messages add column if not exists file_name text check (file_name is null or char_length(file_name) <= 120);

create or replace function edit_message(p_message uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare m messages;
begin
  select * into m from messages where id = p_message;
  if not found or m.author_id is distinct from auth.uid() then raise exception 'Fant ikke meldingen.'; end if;
  if m.kind::text <> 'TEXT' or m.deleted_at is not null or m.attachment_path is not null then raise exception 'Denne meldingen kan ikke endres.'; end if;
  if m.created_at < now() - interval '15 minutes' then raise exception 'Meldinger kan bare endres de første 15 minuttene.'; end if;
  if char_length(trim(coalesce(p_text, ''))) = 0 then raise exception 'Skriv noe, eller slett meldingen.'; end if;
  update messages set text = left(trim(p_text), 4000), edited_at = now() where id = p_message;
  update conversations set last_message_preview = left(trim(p_text), 120)
   where id = m.conversation_id and last_message_at = m.created_at;
end $$;
revoke all on function edit_message(uuid, text) from public, anon;
grant execute on function edit_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. scheduled messages
-- ---------------------------------------------------------------------------
create table if not exists scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 4000),
  send_at timestamptz not null,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists scheduled_messages_due_idx on scheduled_messages (send_at) where sent_at is null and cancelled_at is null;
alter table scheduled_messages enable row level security;
drop policy if exists p_sched_own on scheduled_messages;
create policy p_sched_own on scheduled_messages for select to authenticated using (author_id = auth.uid());
revoke insert, update, delete on scheduled_messages from anon, authenticated;

create or replace function schedule_message(p_conversation uuid, p_text text, p_send_at timestamptz) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_participant(p_conversation) then raise exception 'Fant ikke samtalen.'; end if;
  if p_send_at < now() + interval '1 minute' or p_send_at > now() + interval '14 days' then
    raise exception 'Velg et tidspunkt fra om et minutt til om 14 dager.';
  end if;
  if (select count(*) from scheduled_messages where author_id = auth.uid() and sent_at is null and cancelled_at is null) >= 20 then
    raise exception 'Du har mange planlagte meldinger. Vent til noen er sendt.';
  end if;
  insert into scheduled_messages (conversation_id, author_id, text, send_at)
    values (p_conversation, auth.uid(), left(trim(p_text), 4000), p_send_at) returning id into v_id;
  return v_id;
end $$;
revoke all on function schedule_message(uuid, text, timestamptz) from public, anon;
grant execute on function schedule_message(uuid, text, timestamptz) to authenticated;

create or replace function cancel_scheduled_message(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update scheduled_messages set cancelled_at = now() where id = p_id and author_id = auth.uid() and sent_at is null;
$$;
revoke all on function cancel_scheduled_message(uuid) from public, anon;
grant execute on function cancel_scheduled_message(uuid) to authenticated;

-- every minute: what is due goes out as the author wrote it (blocks still apply through the message triggers)
create or replace function send_scheduled_messages() returns int
language plpgsql security definer set search_path = public as $$
declare r scheduled_messages; v_n int := 0;
begin
  for r in select * from scheduled_messages where sent_at is null and cancelled_at is null and send_at <= now() order by send_at for update skip locked loop
    begin
      if exists (select 1 from conversation_participants where conversation_id = r.conversation_id and profile_id = r.author_id) then
        insert into messages (conversation_id, author_id, kind, text) values (r.conversation_id, r.author_id, 'TEXT', r.text);
      end if;
      update scheduled_messages set sent_at = now() where id = r.id;
      v_n := v_n + 1;
    exception when others then
      -- blocked since, or the conversation is gone: never try again
      update scheduled_messages set cancelled_at = now() where id = r.id;
    end;
  end loop;
  return v_n;
end $$;
revoke all on function send_scheduled_messages() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4–6, 11. settings: away, read receipts, hide online, auto-archive
-- ---------------------------------------------------------------------------
alter table profile_settings add column if not exists away_until date;
alter table profile_settings add column if not exists away_message text;
alter table profile_settings add column if not exists read_receipts boolean not null default true;
alter table profile_settings add column if not exists hide_online boolean not null default false;
alter table profile_settings add column if not exists auto_archive boolean not null default true;
alter table conversation_participants add column if not exists share_reads boolean not null default true;

create table if not exists away_paused_listings (
  listing_id uuid primary key references listings(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  was text not null
);
alter table away_paused_listings enable row level security;
revoke all on away_paused_listings from anon, authenticated;

create or replace function restore_away_listings(p_profile uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update listings l set status = a.was::listing_status
    from away_paused_listings a where a.listing_id = l.id and a.profile_id = p_profile and l.status::text = 'PAUSED';
  delete from away_paused_listings where profile_id = p_profile;
end $$;
revoke all on function restore_away_listings(uuid) from public, anon, authenticated;

-- the day after the last away day: everything opens again by itself
create or replace function end_away_periods() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  for r in select profile_id from profile_settings where away_until is not null and away_until < (now() at time zone 'Europe/Oslo')::date loop
    perform restore_away_listings(r.profile_id);
    update profile_settings set away_until = null where profile_id = r.profile_id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function end_away_periods() from public, anon, authenticated;

create or replace function set_chat_settings(p_away_until date default null, p_away_message text default null, p_clear_away boolean default false,
                                             p_read_receipts boolean default null, p_hide_online boolean default null, p_auto_archive boolean default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  if p_away_until is not null and (p_away_until < current_date or p_away_until > current_date + 90) then
    raise exception 'Velg en dato de neste 90 dagene.';
  end if;
  insert into profile_settings (profile_id) values (v_me) on conflict (profile_id) do nothing;
  update profile_settings set
    away_until = case when p_clear_away then null else coalesce(p_away_until, away_until) end,
    away_message = case when p_clear_away then null else coalesce(left(trim(p_away_message), 300), away_message) end,
    read_receipts = coalesce(p_read_receipts, read_receipts),
    hide_online = coalesce(p_hide_online, hide_online),
    auto_archive = coalesce(p_auto_archive, auto_archive),
    updated_at = now()
  where profile_id = v_me;
  if p_read_receipts is not null then
    update conversation_participants set share_reads = p_read_receipts where profile_id = v_me;
  end if;
  -- away: my «Tilbyr hjelp» posts rest meanwhile; back: they open again
  if p_away_until is not null then
    insert into away_paused_listings (listing_id, profile_id, was)
      select id, owner_id, status::text from listings
       where owner_id = v_me and type::text = 'SERVICE_OFFER' and status::text in ('ACTIVE', 'PUBLISHED')
      on conflict (listing_id) do nothing;
    update listings set status = 'PAUSED' where id in (select listing_id from away_paused_listings where profile_id = v_me);
  elsif p_clear_away then
    perform restore_away_listings(v_me);
  end if;
end $$;
revoke all on function set_chat_settings(date, text, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function set_chat_settings(date, text, boolean, boolean, boolean, boolean) to authenticated;

-- With receipts off, how far I have read stays where it was for the other person; my own unread counts use
-- message_reads, which only I can read.
create or replace function participants_hide_reads() returns trigger
language plpgsql as $$
begin
  if not new.share_reads and new.last_read_at is distinct from old.last_read_at then
    new.last_read_at := old.last_read_at;
  end if;
  return new;
end $$;
drop trigger if exists t_participants_hide_reads on conversation_participants;
create trigger t_participants_hide_reads before update on conversation_participants for each row execute function participants_hide_reads();

-- new conversations follow my setting
create or replace function participants_share_reads_default() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.share_reads := coalesce((select read_receipts from profile_settings where profile_id = new.profile_id), true);
  return new;
end $$;
drop trigger if exists t_participants_share_reads_default on conversation_participants;
create trigger t_participants_share_reads_default before insert on conversation_participants for each row execute function participants_share_reads_default();

-- what others may know: away until (for «Borte til 20. nov»), and whether I hide that I'm online
create or replace function chat_status(p_profile uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'awayUntil', case when s.away_until >= (now() at time zone 'Europe/Oslo')::date then s.away_until end,
    'hideOnline', coalesce(s.hide_online, false),
    'readReceipts', coalesce(s.read_receipts, true))
  from (select 1) x left join profile_settings s on s.profile_id = p_profile;
$$;
revoke all on function chat_status(uuid) from public, anon;
grant execute on function chat_status(uuid) to authenticated;

-- my own chat settings
create or replace function my_chat_settings() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('awayUntil', s.away_until, 'awayMessage', s.away_message,
                           'readReceipts', coalesce(s.read_receipts, true), 'hideOnline', coalesce(s.hide_online, false),
                           'autoArchive', coalesce(s.auto_archive, true))
  from (select 1) x left join profile_settings s on s.profile_id = auth.uid();
$$;
revoke all on function my_chat_settings() from public, anon;
grant execute on function my_chat_settings() to authenticated;

-- 4. the automatic reply: once per conversation and away period, never to an automatic reply
create table if not exists away_replies (
  conversation_id uuid not null references conversations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  away_until date not null,
  primary key (conversation_id, profile_id, away_until)
);
alter table away_replies enable row level security;
revoke all on away_replies from anon, authenticated;

create or replace function messages_away_reply() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.kind::text not in ('TEXT', 'IMAGE', 'AUDIO') or coalesce(new.text, '') like '🌴 %' then return new; end if;
  for r in
    select cp.profile_id, s.away_until, s.away_message from conversation_participants cp
      join profile_settings s on s.profile_id = cp.profile_id
     where cp.conversation_id = new.conversation_id and cp.profile_id <> new.author_id
       and s.away_until >= (now() at time zone 'Europe/Oslo')::date
  loop
    insert into away_replies (conversation_id, profile_id, away_until) values (new.conversation_id, r.profile_id, r.away_until)
      on conflict do nothing;
    if found then
      insert into messages (conversation_id, author_id, kind, text)
        values (new.conversation_id, r.profile_id, 'TEXT',
                '🌴 ' || coalesce(nullif(trim(r.away_message), ''), 'Jeg er borte en stund') ||
                ' (borte til ' || to_char(r.away_until, 'DD.MM') || ')');
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists t_messages_away_reply on messages;
create trigger t_messages_away_reply after insert on messages for each row execute function messages_away_reply();

-- ---------------------------------------------------------------------------
-- 7, 8. search everything, and which conversations I wrote in / have media
-- ---------------------------------------------------------------------------
create or replace function search_my_messages(p_query text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x."createdAt" desc), '[]'::json) from (
    select m.id as "messageId", m.conversation_id as "conversationId", m.author_id as "authorId", m.created_at as "createdAt",
           case when m.text ilike '%' || p_query || '%' then m.text else m.transcript end as "text",
           m.kind::text as kind
      from messages m join conversation_participants cp on cp.conversation_id = m.conversation_id and cp.profile_id = auth.uid()
     where char_length(trim(p_query)) >= 2 and m.deleted_at is null
       and (m.text ilike '%' || trim(p_query) || '%' or m.transcript ilike '%' || trim(p_query) || '%')
     order by m.created_at desc limit 50) x;
$$;
revoke all on function search_my_messages(text) from public, anon;
grant execute on function search_my_messages(text) to authenticated;

create or replace function inbox_flags() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'written', coalesce((select json_agg(distinct m.conversation_id) from messages m
                          join conversation_participants cp on cp.conversation_id = m.conversation_id and cp.profile_id = auth.uid()
                         where m.author_id = auth.uid()), '[]'::json),
    'media', coalesce((select json_agg(distinct m.conversation_id) from messages m
                        join conversation_participants cp on cp.conversation_id = m.conversation_id and cp.profile_id = auth.uid()
                       where m.deleted_at is null and (m.kind::text = 'IMAGE' or m.attachment_kind = 'VIDEO')), '[]'::json));
$$;

-- ---------------------------------------------------------------------------
-- 9. video and PDF: a TEXT message with an attachment (older apps show the line of text)
-- ---------------------------------------------------------------------------
revoke all on function inbox_flags() from public, anon;
grant execute on function inbox_flags() to authenticated;

create or replace function messages_attachment_guard() returns trigger
language plpgsql as $$
begin
  if new.attachment_kind is not null then
    if new.kind::text <> 'TEXT' or new.attachment_path is null then raise exception 'Vedlegget mangler.'; end if;
    if new.attachment_kind = 'FILE' and lower(coalesce(new.file_name, new.attachment_path)) !~ '\.pdf$' then
      raise exception 'Bare PDF-filer kan sendes.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists t_messages_attachment_guard on messages;
create trigger t_messages_attachment_guard before insert on messages for each row execute function messages_attachment_guard();

-- ---------------------------------------------------------------------------
-- 10. «Del adresse»
-- ---------------------------------------------------------------------------
create table if not exists shared_addresses (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  from_profile_id uuid not null references profiles(id) on delete cascade,
  address text not null check (char_length(address) between 3 and 200),
  note text check (note is null or char_length(note) <= 200),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table shared_addresses enable row level security;
revoke all on shared_addresses from anon, authenticated;

-- the accepted avtale behind a conversation, if any
create or replace function conversation_agreement(p_conversation uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from proposals p join agreement_snapshots s on s.proposal_id = p.id
   where p.conversation_id = p_conversation and p.status::text = 'ACCEPTED' and s.cancelled_at is null
   order by p.created_at desc limit 1;
$$;
revoke all on function conversation_agreement(uuid) from public, anon;

create or replace function share_address(p_conversation uuid, p_address text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid();
begin
  if not is_participant(p_conversation) then raise exception 'Fant ikke samtalen.'; end if;
  if conversation_agreement(p_conversation) is null then
    raise exception 'Del adressen først når dere har en avtale.';
  end if;
  update shared_addresses set revoked_at = now() where conversation_id = p_conversation and from_profile_id = v_me and revoked_at is null;
  insert into shared_addresses (conversation_id, from_profile_id, address, note) values (p_conversation, v_me, trim(p_address), nullif(trim(p_note), ''));
  insert into messages (conversation_id, author_id, kind, text) values (p_conversation, v_me, 'SYSTEM', first_name(v_me) || ' delte adressen sin');
end $$;
revoke all on function share_address(uuid, text, text) from public, anon;
grant execute on function share_address(uuid, text, text) to authenticated;

create or replace function revoke_address(p_conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update shared_addresses set revoked_at = now() where conversation_id = p_conversation and from_profile_id = auth.uid() and revoked_at is null;
  if found then
    insert into messages (conversation_id, author_id, kind, text) values (p_conversation, auth.uid(), 'SYSTEM', first_name(auth.uid()) || ' trakk tilbake adressen');
  end if;
end $$;
revoke all on function revoke_address(uuid) from public, anon;
grant execute on function revoke_address(uuid) to authenticated;

-- shown while the avtale stands, until a day after both confirmed the job
create or replace function conversation_addresses(p_conversation uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when not is_participant(p_conversation) then '[]'::json else coalesce((
    select json_agg(json_build_object('id', a.id, 'fromId', a.from_profile_id, 'address', a.address, 'note', a.note, 'createdAt', a.created_at))
      from shared_addresses a
     where a.conversation_id = p_conversation and a.revoked_at is null
       and conversation_agreement(p_conversation) is not null
       and not exists (select 1 from completion_confirmations c where c.agreement_proposal_id = conversation_agreement(p_conversation)
                        group by c.agreement_proposal_id having count(*) >= 2 and max(c.confirmed_at) < now() - interval '1 day')), '[]'::json) end;
$$;
revoke all on function conversation_addresses(uuid) from public, anon;
grant execute on function conversation_addresses(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. auto-archive after 30 days on a closed oppdrag
-- ---------------------------------------------------------------------------
create or replace function auto_archive_conversations() returns int
language sql security definer set search_path = public as $$
  with x as (
    update conversation_participants cp set archived_at = now()
      from conversations c, listings l
     where cp.conversation_id = c.id and l.id = c.listing_id and cp.archived_at is null
       and l.status::text in ('COMPLETED', 'REVIEWED', 'CANCELLED', 'EXPIRED', 'REMOVED', 'ARCHIVED')
       and c.last_message_at < now() - interval '30 days'
       and coalesce((select auto_archive from profile_settings s where s.profile_id = cp.profile_id), true)
     returning 1)
  select count(*)::int from x;
$$;
revoke all on function auto_archive_conversations() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. quiet hours: held pushes, sent in the morning by send-push (`type: 'held'`)
-- ---------------------------------------------------------------------------
create table if not exists held_pushes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  route text,
  conversation_id uuid,
  created_at timestamptz not null default now()
);
alter table held_pushes enable row level security;
revoke all on held_pushes from anon, authenticated;

-- every 10 minutes: ask send-push to deliver what was held for people whose quiet hours are over
create or replace function release_held_pushes() returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from held_pushes) then
    perform call_send_push(jsonb_build_object('type', 'held', 'id', gen_random_uuid()));
  end if;
exception when others then null;
end $$;
revoke all on function release_held_pushes() from public, anon, authenticated;

do $$ begin
  begin perform cron.unschedule('minnabo-scheduled-messages'); exception when others then null; end;
  perform cron.schedule('minnabo-scheduled-messages', '* * * * *', 'select public.send_scheduled_messages()');
  begin perform cron.unschedule('minnabo-end-away'); exception when others then null; end;
  perform cron.schedule('minnabo-end-away', '5 0 * * *', 'select public.end_away_periods()');
  begin perform cron.unschedule('minnabo-auto-archive'); exception when others then null; end;
  perform cron.schedule('minnabo-auto-archive', '20 3 * * *', 'select public.auto_archive_conversations()');
  begin perform cron.unschedule('minnabo-held-pushes'); exception when others then null; end;
  perform cron.schedule('minnabo-held-pushes', '*/10 * * * *', 'select public.release_held_pushes()');
exception when others then
  raise notice 'pg_cron not available – schedule send_scheduled_messages(), auto_archive_conversations() and release_held_pushes() by hand';
end $$;
