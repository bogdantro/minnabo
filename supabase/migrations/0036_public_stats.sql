-- 0036_public_stats.sql
--  * Meny: "Tilgjengelig for småjobber" (profiles.available_for_jobs).
--  * Oppdrag for meg: the categories a helper wants jobs in (profiles.category_slugs).
--  * notify_matching_helpers – the app has called this since the Publisert screen
--    was built, but the function never existed.
--  * Read receipts: 0007 moved mark_conversation_read to
--    conversation_participants.last_read_at while Innboks still reads
--    message_reads, so a conversation never became "read". Both are written now.
--  * Oppdragsdetaljer: public offer count (a number only – never who).
--  * "Svarer vanligvis innen …": median reply time per profile.
--  * Innboks: unread count per conversation, who wrote the last message.

alter table profiles add column if not exists available_for_jobs boolean not null default true;
alter table profiles add column if not exists category_slugs text[] not null default '{}';

alter type notification_kind add value if not exists 'NEW_MATCH';

-- ---------------------------------------------------------------------------
-- match notifications
-- ---------------------------------------------------------------------------
create or replace function notify_matching_helpers(p_listing_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare l listings; v_helper uuid; v_n int := 0;
begin
  select * into l from listings where id = p_listing_id;
  if not found or l.owner_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if l.type <> 'TASK_REQUEST' or l.status not in ('PUBLISHED','RECEIVING_OFFERS') then return 0; end if;

  for v_helper in
    select p.id from profiles p
     where p.id <> l.owner_id
       and p.deleted_at is null
       and p.suspended_at is null
       and p.available_for_jobs
       and not p.paused
       and p.municipality = l.municipality
       and l.category_slug = any(p.category_slugs)
       and (l.offer_audience <> 'VERIFIED'
            or exists (select 1 from verifications v where v.profile_id = p.id and v.verified))
       and not exists (select 1 from blocks b
                        where (b.by_profile_id = p.id and b.blocked_profile_id = l.owner_id)
                           or (b.by_profile_id = l.owner_id and b.blocked_profile_id = p.id))
       -- one match notification per helper and oppdrag
       and not exists (select 1 from notifications n
                        where n.profile_id = p.id and n.kind::text = 'NEW_MATCH'
                          and n.route = '/oppdrag/' || l.id)
     limit 200
  loop
    insert into notifications (profile_id, kind, title, body, route)
      values (v_helper, 'NEW_MATCH'::text::notification_kind, 'Nytt oppdrag som passer deg',
              '«' || l.title || '» i ' || l.place, '/oppdrag/' || l.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
grant execute on function notify_matching_helpers(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- read receipts: keep both stores in step
-- ---------------------------------------------------------------------------
create or replace function mark_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_participant(p_conversation_id) then raise exception 'Ikke tilgang.'; end if;
  update conversation_participants set last_read_at = now()
   where conversation_id = p_conversation_id and profile_id = auth.uid();
  insert into message_reads (conversation_id, profile_id, last_read_at)
    values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, profile_id) do update set last_read_at = now();
end $$;
grant execute on function mark_conversation_read(uuid) to authenticated;

-- carry over what 0007 recorded
insert into message_reads (conversation_id, profile_id, last_read_at)
  select conversation_id, profile_id, last_read_at from conversation_participants
   where last_read_at > 'epoch'
on conflict (conversation_id, profile_id) do update
  set last_read_at = greatest(message_reads.last_read_at, excluded.last_read_at);

-- ---------------------------------------------------------------------------
-- public offer count on an oppdrag
-- ---------------------------------------------------------------------------
create or replace function listing_offer_count(p_listing_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'count', count(distinct from_profile_id),
    'mine', coalesce(bool_or(from_profile_id = auth.uid()), false))
    from proposals
   where listing_id = p_listing_id and status in ('SENT','REVISION_PENDING','ACCEPTED');
$$;
grant execute on function listing_offer_count(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- median reply time (minutes) over the last 180 days; null until 3 replies exist
-- ---------------------------------------------------------------------------
create or replace function profile_reply_minutes(p_profile_id uuid)
returns int language sql stable security definer set search_path = public as $$
  with m as (
    select author_id, created_at,
           lag(author_id) over w as prev_author,
           lag(created_at) over w as prev_at
      from messages
     where kind <> 'SYSTEM'
       and created_at > now() - interval '180 days'
       and conversation_id in (select conversation_id from conversation_participants
                                where profile_id = p_profile_id)
    window w as (partition by conversation_id order by created_at)
  ), r as (
    select extract(epoch from (created_at - prev_at)) / 60 as mins
      from m
     where author_id = p_profile_id and prev_author is not null and prev_author <> p_profile_id
  )
  select case when count(*) >= 3
              then greatest(1, round(percentile_cont(0.5) within group (order by mins)))::int end
    from r;
$$;
grant execute on function profile_reply_minutes(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Innboks: unread messages + author of the last message, for my conversations
-- ---------------------------------------------------------------------------
create or replace function my_conversation_meta()
returns table (conversation_id uuid, unread_count int, last_author_id uuid, last_kind text)
language sql stable security definer set search_path = public as $$
  select cp.conversation_id,
         (select count(*)::int from messages m
           where m.conversation_id = cp.conversation_id
             and m.author_id <> auth.uid()
             and m.kind <> 'SYSTEM'
             and m.created_at > greatest(cp.last_read_at, coalesce(
                   (select r.last_read_at from message_reads r
                     where r.conversation_id = cp.conversation_id and r.profile_id = auth.uid()),
                   'epoch'::timestamptz))),
         lm.author_id,
         lm.kind::text
    from conversation_participants cp
    left join lateral (
      select m.author_id, m.kind from messages m
       where m.conversation_id = cp.conversation_id
       order by m.created_at desc limit 1) lm on true
   where cp.profile_id = auth.uid();
$$;
grant execute on function my_conversation_meta() to authenticated;

-- Writing a message means you have read the conversation up to that point:
-- your own message must never make the conversation "unread" for you.
create or replace function message_author_read() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversation_participants set last_read_at = greatest(last_read_at, new.created_at)
   where conversation_id = new.conversation_id and profile_id = new.author_id;
  insert into message_reads (conversation_id, profile_id, last_read_at)
    values (new.conversation_id, new.author_id, new.created_at)
  on conflict (conversation_id, profile_id) do update
    set last_read_at = greatest(message_reads.last_read_at, excluded.last_read_at);
  return new;
end $$;
drop trigger if exists t_messages_author_read on messages;
create trigger t_messages_author_read after insert on messages
  for each row execute function message_author_read();
