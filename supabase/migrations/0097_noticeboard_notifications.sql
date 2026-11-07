-- 0097_noticeboard_notifications.sql
--  Asked 2026-11-07: people should hear about new oppslag, and when someone answers their oppslag or an oppslag
--  they have answered on.
--    * A new oppslag for the whole kommune notifies the people in that kommune (an oppslag for one nabolag already
--      notifies its members, 0065/0067). At most 3 such notices per person per day, so a busy board never
--      turns into a stream of pushes. The «Oppslag» switch in Varslinger turns them off (send-push: NABOLAG_POST).
--    * An answer notifies the author (as before) and now also the others who have answered on the same oppslag.
--      Every notice opens the oppslag itself.

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
              '«' || n.title || '»: ' || left(new.body, 100), '/oppslagstavle?oppslag=' || n.id);
  end if;
  -- everyone else who has answered under the same oppslag hears about the new answer too (0097),
  -- once per oppslag until they have opened it: no new notice while an unread one is waiting
  insert into notifications (profile_id, kind, title, body, route)
  select distinct c.author_id, 'NOTICE_REPLY'::text::notification_kind,
         coalesce(v_name, 'En nabo') || ' svarte også på «' || left(n.title, 60) || '»',
         left(new.body, 120), '/oppslagstavle?oppslag=' || n.id
    from notice_comments c
    join profiles p on p.id = c.author_id and p.deleted_at is null and p.suspended_at is null
   where c.notice_id = n.id
     and c.author_id <> new.author_id
     and c.author_id <> n.author_id
     and not exists (select 1 from blocks b
                      where (b.by_profile_id = c.author_id and b.blocked_profile_id = new.author_id)
                         or (b.by_profile_id = new.author_id and b.blocked_profile_id = c.author_id))
     and not exists (select 1 from notifications x
                      where x.profile_id = c.author_id and x.route = '/oppslagstavle?oppslag=' || n.id
                        and not x.read and x.created_at > now() - interval '7 days');
  return new;
end $$;

create or replace function notify_kommune_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.neighbourhood_id is not null or new.hidden_at is not null then return new; end if;
  insert into notifications (profile_id, kind, title, body, route)
  select p.id, 'NABOLAG_POST'::text::notification_kind,
         'Nytt oppslag i ' || new.municipality, '«' || new.title || '»', '/oppslagstavle?oppslag=' || new.id
    from profiles p
   where p.municipality = new.municipality
     and p.id <> new.author_id
     and p.deleted_at is null and p.suspended_at is null
     and not exists (select 1 from blocks b
                      where (b.by_profile_id = p.id and b.blocked_profile_id = new.author_id)
                         or (b.by_profile_id = new.author_id and b.blocked_profile_id = p.id))
     and (select count(*) from notifications x
           where x.profile_id = p.id and x.kind = 'NABOLAG_POST'::text::notification_kind
             and x.created_at > now() - interval '24 hours') < 3;
  return new;
end $$;
revoke all on function notify_kommune_post() from public, anon, authenticated;
drop trigger if exists t_notify_kommune_post on noticeboard_posts;
create trigger t_notify_kommune_post after insert on noticeboard_posts
  for each row execute function notify_kommune_post();
