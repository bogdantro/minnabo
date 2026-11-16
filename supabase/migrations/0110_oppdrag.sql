-- 0110_oppdrag.sql
--  Asked 2026-11-15 («Do this»): the Oppdrag ideas (docs/IDEAS.md part 4) that need the database.
--    1. How many tilbud an oppdrag has («Ingen tilbud ennå – vær først»), for many oppdrag at once.
--    2. «Svarer raskt»: owners who usually answer within an hour, for many at once.
--    3. Search suggestions from what people in the kommune search for (a small, anonymous log).
--    4. «Hjelp for eldre»: an oppdrag posted in senior mode.
--    5. «Én oppsummering om dagen»: one push a day with the count of new oppdrag instead of one per oppdrag.
--    6. Message deleting gets the same 15 minutes as editing (the «Angre» bar is gone, asked 2026-11-15).
--    7. A varsel about an answer under an oppslag opens the answers (&svar=1); other oppslag links
--       now show the oppslag itself first on Oppslagstavla (asked 2026-11-15: search hits went to the wrong thing).

-- ---------------------------------------------------------------------------
-- 1. tilbud per oppdrag (open ones only; nobody learns who sent them)
-- ---------------------------------------------------------------------------
create or replace function listing_offer_counts(p_ids uuid[]) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(l.id, (select count(*) from proposals p
                                          where p.listing_id = l.id and p.status::text in ('SENT', 'REVISION_PENDING', 'ACCEPTED'))), '{}'::json)
    from listings l where l.id = any(p_ids[1:100]) and listing_publicly_visible(l);
$$;
revoke all on function listing_offer_counts(uuid[]) from public, anon;
grant execute on function listing_offer_counts(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. «Svarer raskt»
-- ---------------------------------------------------------------------------
create or replace function fast_responders(p_ids uuid[]) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(id), '[]'::json) from (
    select distinct unnest(p_ids[1:60]) as id) x
   where profile_reply_minutes(x.id) <= 60;
$$;
revoke all on function fast_responders(uuid[]) from public, anon;
grant execute on function fast_responders(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. search suggestions: the word and the kommune only, never who searched
-- ---------------------------------------------------------------------------
create table if not exists search_terms (
  municipality text not null,
  term text not null check (char_length(term) between 2 and 40),
  searched_on date not null default (now() at time zone 'Europe/Oslo')::date,
  n int not null default 1,
  primary key (municipality, term, searched_on)
);
alter table search_terms enable row level security;
revoke all on search_terms from anon, authenticated;

create or replace function log_search_term(p_municipality text, p_term text) returns void
language plpgsql security definer set search_path = public as $$
declare v text := lower(trim(p_term));
begin
  -- only plain words: no numbers, no addresses, no e-mail or phone numbers end up in the log
  if auth.uid() is null or v !~ '^[a-zæøåé ]{2,40}$' then return; end if;
  insert into search_terms (municipality, term) values (coalesce(p_municipality, ''), v)
    on conflict (municipality, term, searched_on) do update set n = search_terms.n + 1;
end $$;
revoke all on function log_search_term(text, text) from public, anon;
grant execute on function log_search_term(text, text) to authenticated;

-- the most searched words in the kommune the last 30 days (at least 3 searches, so one person can't plant a word)
create or replace function popular_search_terms(p_municipality text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(term order by total desc), '[]'::json) from (
    select term, sum(n) as total from search_terms
     where municipality = coalesce(p_municipality, '') and searched_on > (now() at time zone 'Europe/Oslo')::date - 30
     group by term having sum(n) >= 3 order by total desc limit 12) x;
$$;
revoke all on function popular_search_terms(text) from public, anon;
grant execute on function popular_search_terms(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. «Hjelp for eldre»
-- ---------------------------------------------------------------------------
alter table listings add column if not exists from_senior boolean not null default false;

-- ---------------------------------------------------------------------------
-- 5. one push a day instead of one per new oppdrag
-- ---------------------------------------------------------------------------
create or replace function notify_kommune_new_oppdrag() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_route text := '/oppdrag/' || new.id; v_offer boolean := new.type::text = 'SERVICE_OFFER'; v_owner text;
begin
  -- the head start: only the helpers the owner follows hear about it now
  if new.first_to_followed_until is not null and new.first_to_followed_until > now()
     and tg_op = 'INSERT' and new.status::text in ('PUBLISHED', 'RECEIVING_OFFERS')
     and not coalesce(new.pending_review, false) and not coalesce(new.admin_hidden, false) then
    v_owner := first_name(new.owner_id);
    insert into notifications (profile_id, kind, title, body, route)
    select f.followed_id, 'NEW_MATCH'::text::notification_kind,
           coalesce(v_owner, 'En nabo') || ' spør deg først',
           '«' || new.title || '» · De andre får se oppdraget om to timer.',
           v_route
      from follows f
      join profiles p on p.id = f.followed_id
     where f.follower_id = new.owner_id and p.deleted_at is null and p.suspended_at is null;
    return new;
  end if;

  if not listing_publicly_visible(new) then return new; end if;
  -- only the moment it becomes visible, never on an edit of an oppdrag that already was.
  -- When the head start ends, `old` already looks visible by the clock, so that counts on its own.
  if tg_op = 'UPDATE' and listing_publicly_visible(old)
     and not (old.first_to_followed_until is not null and new.first_to_followed_until is null) then
    return new;
  end if;

  insert into notifications (profile_id, kind, title, body, route)
  select p.id, 'NEW_MATCH'::text::notification_kind,
         case when v_offer then 'En nabo tilbyr hjelp i ' else 'Nytt oppdrag i ' end || new.municipality,
         '«' || new.title || '» · ' || new.place,
         v_route
    from profiles p
   where p.municipality = any(kommune_group(new.municipality))
     and p.id <> new.owner_id
     and p.deleted_at is null
     and p.suspended_at is null
     and not coalesce(p.paused, false)
     and (not is_youth(p.id) or (not v_offer and youth_offer_category(new.category_slug)))
     -- oppdrag follow what the person wants to help with; «Tilgjengelig for småjobber» off = none.
     -- A «Tilbyr hjelp» is for people who need help, so it doesn't depend on their skills.
     and (v_offer or (coalesce(p.available_for_jobs, true)
                      and (coalesce(cardinality(p.category_slugs), 0) = 0 or new.category_slug = any(p.category_slugs))))
     and not exists (select 1 from blocks b
                      where (b.by_profile_id = p.id and b.blocked_profile_id = new.owner_id)
                         or (b.by_profile_id = new.owner_id and b.blocked_profile_id = p.id))
     and not exists (select 1 from notifications n
                      where n.profile_id = p.id and n.kind::text = 'NEW_MATCH' and n.route = v_route)
     -- «Én oppsummering om dagen» (0110): these get the daily count instead
     and not coalesce((select (s.notification_prefs->>'matchDaily')::boolean from profile_settings s where s.profile_id = p.id), false);
  return new;
end $$;


create or replace function send_daily_match_digest() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  for r in
    select p.id, p.municipality, count(l.id)::int as n
      from profiles p
      join profile_settings s on s.profile_id = p.id and coalesce((s.notification_prefs->>'matchDaily')::boolean, false)
      join listings l on l.municipality = any(kommune_group(p.municipality))
                     and l.type::text = 'TASK_REQUEST' and listing_publicly_visible(l)
                     and l.created_at > now() - interval '24 hours' and l.owner_id <> p.id
                     and (coalesce(cardinality(p.category_slugs), 0) = 0 or l.category_slug = any(p.category_slugs))
     where p.municipality is not null and p.deleted_at is null and p.suspended_at is null
       and coalesce(p.available_for_jobs, true) and not coalesce(p.paused, false)
     group by p.id, p.municipality
  loop
    insert into notifications (profile_id, kind, title, body, route)
      values (r.id, 'NEW_MATCH'::text::notification_kind,
              case when r.n = 1 then '1 nytt oppdrag i ' else r.n || ' nye oppdrag i ' end || r.municipality || ' i dag',
              'Se hva naboene trenger hjelp til.', '/');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function send_daily_match_digest() from public, anon, authenticated;

do $$ begin
  begin perform cron.unschedule('minnabo-daily-match'); exception when others then null; end;
  -- 16:00 UTC = 17:00 in winter, 18:00 in summer
  perform cron.schedule('minnabo-daily-match', '0 16 * * *', 'select public.send_daily_match_digest()');
exception when others then
  raise notice 'pg_cron not available – schedule send_daily_match_digest() by hand';
end $$;

-- ---------------------------------------------------------------------------
-- 6. deleting a message: 15 minutes, like editing (0109); the 5-second «Angre» is gone
-- ---------------------------------------------------------------------------
create or replace function delete_my_message(p_message_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m messages; v_last uuid;
begin
  select * into m from messages where id = p_message_id for update;
  if not found or m.author_id is distinct from auth.uid() then
    raise exception 'Ikke tilgang.' using errcode = '42501';
  end if;
  if m.deleted_at is not null then return; end if;
  if m.kind::text not in ('TEXT', 'IMAGE', 'AUDIO') then
    raise exception 'Denne meldingen kan ikke slettes.';
  end if;
  if m.created_at < now() - interval '15 minutes' then
    raise exception 'Du kan bare slette en melding de første 15 minuttene.';
  end if;

  perform queue_file_purge('chat-attachments', m.attachment_path);
  update messages
     set text = '', attachment_path = null, transcript = null, audio_ms = null,
         reactions = '{}'::jsonb, pinned = false, deleted_at = now()
   where id = m.id;

  -- Innboks must not keep showing a message that is gone
  select id into v_last from messages where conversation_id = m.conversation_id
   order by created_at desc limit 1;
  if v_last = m.id then
    update conversations set last_message_preview = 'Meldingen ble slettet' where id = m.conversation_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. an answer under an oppslag opens the answers (the app shows the oppslag first for other links)
-- ---------------------------------------------------------------------------
create or replace function notice_comment_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare n noticeboard_posts; v_name text; v_recent int;
begin
  select * into n from noticeboard_posts where id = new.notice_id;
  if not found or n.hidden_at is not null then raise exception 'Fant ikke oppslaget.'; end if;
  if n.done_at is not null then raise exception 'Oppslaget er avsluttet.'; end if;
  if exists (select 1 from blocks b
              where (b.by_profile_id = n.author_id and b.blocked_profile_id = new.author_id)
                 or (b.by_profile_id = new.author_id and b.blocked_profile_id = n.author_id)) then
    raise exception 'Du kan ikke svare på dette oppslaget.' using errcode = '42501';
  end if;
  select count(*) into v_recent from notice_comments
   where author_id = new.author_id and created_at > now() - interval '1 minute';
  if v_recent >= 6 then raise exception 'For mange svar. Vent litt og prøv igjen.'; end if;

  select display_name into v_name from profiles where id = new.author_id;
  if n.author_id <> new.author_id then
    insert into notifications (profile_id, kind, title, body, route)
      values (n.author_id, 'NOTICE_REPLY'::text::notification_kind,
              coalesce(v_name, 'En nabo') || ' svarte på oppslaget ditt',
              '«' || n.title || '»: ' || left(new.body, 100), '/oppslagstavle?oppslag=' || n.id || '&svar=1');
  end if;
  -- everyone else who has answered under the same oppslag hears about the new answer too (0097),
  -- once per oppslag until they have opened it: no new notice while an unread one is waiting
  insert into notifications (profile_id, kind, title, body, route)
  select distinct c.author_id, 'NOTICE_REPLY'::text::notification_kind,
         coalesce(v_name, 'En nabo') || ' svarte også på «' || left(n.title, 60) || '»',
         left(new.body, 120), '/oppslagstavle?oppslag=' || n.id || '&svar=1'
    from notice_comments c
    join profiles p on p.id = c.author_id and p.deleted_at is null and p.suspended_at is null
   where c.notice_id = n.id
     and c.author_id <> new.author_id
     and c.author_id <> n.author_id
     and not exists (select 1 from blocks b
                      where (b.by_profile_id = c.author_id and b.blocked_profile_id = new.author_id)
                         or (b.by_profile_id = new.author_id and b.blocked_profile_id = c.author_id))
     and not exists (select 1 from notifications x
                      where x.profile_id = c.author_id and x.route = '/oppslagstavle?oppslag=' || n.id || '&svar=1'
                        and not x.read and x.created_at > now() - interval '7 days');
  return new;
end $$;

-- unread answer varsler already waiting get the same link
update notifications
   set route = route || '&svar=1'
 where kind = 'NOTICE_REPLY'::text::notification_kind
   and not read
   and route like '/oppslagstavle?oppslag=%'
   and route not like '%svar=1%'
   and (title like '% svarte på oppslaget ditt' or title like '% svarte også på «%');
