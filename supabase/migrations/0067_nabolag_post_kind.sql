-- 0067_nabolag_post_kind.sql
-- A new oppslag in your nabolag (0065) was sent as kind NOTICE_REPLY, so Varsler showed it
-- with the «svar» icon, as if someone had answered you. It gets its own kind now.
-- The push setting stays «Oppslag» (send-push maps NABOLAG_POST to 'board' like NOTICE_REPLY).
--
-- `add value` and the function below are fine in one migration: the new value is only used
-- when the trigger runs, never inside this transaction.

alter type notification_kind add value if not exists 'NABOLAG_POST';

create or replace function notify_nabolag_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.neighbourhood_id is null or new.hidden_at is not null then return new; end if;
  insert into notifications (profile_id, kind, title, body, route)
  select m.profile_id, 'NABOLAG_POST'::text::notification_kind,
         'Nytt oppslag i ' || new.place, '«' || new.title || '»', '/oppslagstavle?oppslag=' || new.id
    from neighbourhood_members m
    join profiles p on p.id = m.profile_id and p.deleted_at is null and p.suspended_at is null
   where m.neighbourhood_id = new.neighbourhood_id
     and m.profile_id <> new.author_id
     and not exists (select 1 from blocks b
                      where (b.by_profile_id = m.profile_id and b.blocked_profile_id = new.author_id)
                         or (b.by_profile_id = new.author_id and b.blocked_profile_id = m.profile_id));
  return new;
end $$;
revoke all on function notify_nabolag_post() from public, anon, authenticated;
