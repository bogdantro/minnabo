-- 0107_lend_merge.sql
--  Asked 2026-11-13: «Lån ut» on Oppslagstavla and /utlan become one thing.
--
--   * A thing to lend lives in lend_items. Every lend item has its «Lån ut» oppslag on Oppslagstavla
--     (lend_items.notice_id), and every «Lån ut» oppslag has its lend item. Adding, editing, hiding or
--     deleting either one does the same to the other, whichever app or screen did it.
--   * One way to borrow: request_lend / respond_lend (0101, 0104). The old tool loans (tool_bookings, 0090)
--     are moved over, and tool_bookings becomes a read-only view so an older app still shows its loans.
--     The old functions still work for an older app: they ask through request_lend.
--   * A lend item can be for one nabolag only, like an oppslag; then only its members see it.
--   * Youth accounts may lend out too (decided 2026-11-13), not only borrow.

-- ---------------------------------------------------------------------------
-- 1. The link, and nabolag on lend items
-- ---------------------------------------------------------------------------
alter table lend_items add column if not exists notice_id uuid unique references noticeboard_posts(id) on delete set null;
alter table lend_items add column if not exists neighbourhood_id uuid references neighbourhoods(id) on delete set null;
create index if not exists lend_items_nabolag_idx on lend_items (neighbourhood_id) where neighbourhood_id is not null;

drop policy if exists p_lend_items_read on lend_items;
create policy p_lend_items_read on lend_items for select to authenticated
  using (owner_id = auth.uid()
     or (active
         and exists (select 1 from profiles p where p.id = owner_id and p.deleted_at is null and p.suspended_at is null)
         and (neighbourhood_id is null or is_nabolag_member(neighbourhood_id))));

-- While one side writes the other, the other side's sync triggers stay quiet (no ping-pong),
-- and the mirror oppslag does not count against the 5-oppslag-a-day limit (lend items have their own cap of 30).
create or replace function lend_syncing() returns boolean
language sql stable as $$ select coalesce(current_setting('minnabo.lend_sync', true), '') = 'on' $$;

create or replace function lend_items_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n neighbourhoods;
begin
  if tg_op = 'INSERT' and (select count(*) from lend_items where owner_id = new.owner_id) >= 30 then
    raise exception 'Du kan ha opptil 30 ting i utlånslisten.';
  end if;
  if new.image_path is not null and new.image_path not like new.owner_id::text || '/%' then raise exception 'Ugyldig bilde.'; end if;
  if new.neighbourhood_id is not null then
    -- an oppslag's nabolag is checked by the oppslag's own policy; a lend item checks it here
    if tg_op = 'INSERT' or new.neighbourhood_id is distinct from old.neighbourhood_id then
      if not lend_syncing() and auth.uid() is not null and not is_nabolag_member(new.neighbourhood_id) then
        raise exception 'Du er ikke med i det nabolaget.' using errcode = '42501';
      end if;
    end if;
    select * into n from neighbourhoods where id = new.neighbourhood_id;
    new.municipality := coalesce(n.municipality, '');
  else
    new.municipality := coalesce((select municipality from profiles where id = new.owner_id), '');
  end if;
  return new;
end $$;

create or replace function notices_rate_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_day int;
begin
  if auth.uid() is null or is_admin() or lend_syncing() then return new; end if;
  select count(*) into v_day from noticeboard_posts
   where author_id = new.author_id and created_at > now() - interval '24 hours';
  if v_day >= 5 then raise exception 'Du har lagt ut mange oppslag i dag. Prøv igjen i morgen.'; end if;
  return new;
end $$;

-- 'Bormaskin' + photo -> the oppslag's photos: the lend item's photo first, the oppslag's other photos kept.
create or replace function lend_photos(p_paths text[], p_old text, p_new text) returns text[]
language sql immutable as $$
  select case
    when p_new is null then array_remove(coalesce(p_paths, '{}'), p_old)
    when p_old is not null and p_old = any (coalesce(p_paths, '{}')) then array_replace(p_paths, p_old, p_new)
    when p_new = any (coalesce(p_paths, '{}')) then p_paths
    else array[p_new] || coalesce(p_paths, '{}')
  end
$$;

-- ---------------------------------------------------------------------------
-- 2. Lend item -> oppslag
-- ---------------------------------------------------------------------------
create or replace function lend_item_to_notice() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_notice uuid; pr profiles;
begin
  if lend_syncing() then return coalesce(new, old); end if;
  perform set_config('minnabo.lend_sync', 'on', true);
  if tg_op = 'INSERT' and new.notice_id is null then
    select * into pr from profiles where id = new.owner_id;
    insert into noticeboard_posts (kind, title, body, author_id, place, municipality, neighbourhood_id, image_paths)
      values ('TOOL_LEND', new.title, coalesce(new.note, ''), new.owner_id, coalesce(pr.place, new.municipality),
              new.municipality, new.neighbourhood_id, case when new.image_path is null then '{}' else array[new.image_path] end)
      returning id into v_notice;
    update lend_items set notice_id = v_notice where id = new.id;
  elsif tg_op = 'UPDATE' and new.notice_id is not null then
    update noticeboard_posts n
       set title = new.title,
           body = coalesce(new.note, ''),
           image_paths = case when new.image_path is distinct from old.image_path
                              then lend_photos(n.image_paths, old.image_path, new.image_path) else n.image_paths end,
           -- hidden on Utlån = «Avsluttet» on the board, and back
           done_at = case when new.active = old.active then n.done_at when new.active then null else now() end
     where n.id = new.notice_id
       and (new.title, coalesce(new.note, ''), new.image_path, new.active)
           is distinct from (old.title, coalesce(old.note, ''), old.image_path, old.active);
  elsif tg_op = 'DELETE' and old.notice_id is not null then
    delete from noticeboard_posts where id = old.notice_id;
  end if;
  perform set_config('minnabo.lend_sync', '', true);
  return coalesce(new, old);
end $$;
revoke all on function lend_item_to_notice() from public, anon, authenticated;
drop trigger if exists t_lend_item_to_notice on lend_items;
create trigger t_lend_item_to_notice after insert or update or delete on lend_items
  for each row execute function lend_item_to_notice();

-- ---------------------------------------------------------------------------
-- 3. «Lån ut» oppslag -> lend item (an older app, or an edit on the board)
-- ---------------------------------------------------------------------------
create or replace function notice_to_lend_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if lend_syncing() then return coalesce(new, old); end if;
  perform set_config('minnabo.lend_sync', 'on', true);
  if tg_op = 'DELETE' then
    delete from lend_items where notice_id = old.id;
  elsif new.kind::text = 'TOOL_LEND' and (tg_op = 'INSERT' or not exists (select 1 from lend_items where notice_id = new.id)) then
    -- a new «Lån ut» oppslag, or one changed to «Lån ut»: it becomes a thing on Utlån
    v_title := left(btrim(new.title), 60);
    insert into lend_items (owner_id, title, category, note, image_path, neighbourhood_id, active, notice_id)
      values (new.author_id, case when char_length(v_title) < 2 then 'Utlån' else v_title end, 'VERKTOY',
              nullif(left(btrim(new.body), 300), ''), new.image_paths[1], new.neighbourhood_id,
              new.done_at is null and new.hidden_at is null, new.id);
  elsif tg_op = 'UPDATE' and new.kind::text <> 'TOOL_LEND' then
    -- no longer «Lån ut»: the thing leaves Utlån, its loans stay in the history
    update lend_items set active = false, notice_id = null where notice_id = new.id;
  elsif tg_op = 'UPDATE' then
    v_title := left(btrim(new.title), 60);
    update lend_items i
       set title = case when char_length(v_title) < 2 then i.title else v_title end,
           note = nullif(left(btrim(new.body), 300), ''),
           image_path = case when new.image_paths is distinct from old.image_paths then new.image_paths[1] else i.image_path end,
           active = new.done_at is null and new.hidden_at is null
     where i.notice_id = new.id;
  end if;
  perform set_config('minnabo.lend_sync', '', true);
  return coalesce(new, old);
end $$;
revoke all on function notice_to_lend_item() from public, anon, authenticated;
drop trigger if exists t_notice_to_lend_item on noticeboard_posts;
create trigger t_notice_to_lend_item after insert or update of kind, title, body, image_path, image_paths, done_at, hidden_at on noticeboard_posts
  for each row execute function notice_to_lend_item();
drop trigger if exists t_notice_to_lend_item_del on noticeboard_posts;
create trigger t_notice_to_lend_item_del before delete on noticeboard_posts
  for each row execute function notice_to_lend_item();

-- ---------------------------------------------------------------------------
-- 4. Link what exists today. Neighbours are not notified about old things, the word filter and the
--    30-item cap don't stop the move, and the sync triggers stay out of it (each side is written here).
-- ---------------------------------------------------------------------------
alter table noticeboard_posts disable trigger t_notify_kommune_post;
alter table noticeboard_posts disable trigger t_notify_nabolag_post;
alter table noticeboard_posts disable trigger t_words_notices;
alter table noticeboard_posts disable trigger t_notice_to_lend_item;
alter table noticeboard_posts disable trigger t_notice_to_lend_item_del;
alter table lend_items disable trigger t_lend_items_guard;
alter table lend_items disable trigger t_lend_item_to_notice;

-- every «Lån ut» oppslag gets its lend item
insert into lend_items (owner_id, title, category, note, image_path, municipality, neighbourhood_id, active, notice_id, created_at)
select n.author_id,
       case when char_length(left(btrim(n.title), 60)) < 2 then 'Utlån' else left(btrim(n.title), 60) end,
       'VERKTOY', nullif(left(btrim(n.body), 300), ''),
       case when n.image_paths[1] like n.author_id::text || '/%' then n.image_paths[1] end,
       coalesce(n.municipality, ''), n.neighbourhood_id, n.done_at is null and n.hidden_at is null, n.id, n.created_at
  from noticeboard_posts n
 where n.kind::text = 'TOOL_LEND'
   and not exists (select 1 from lend_items i where i.notice_id = n.id);

-- every lend item gets its «Lån ut» oppslag
do $$
declare i record; v_notice uuid;
begin
  for i in select l.*, p.place from lend_items l left join profiles p on p.id = l.owner_id where l.notice_id is null loop
    insert into noticeboard_posts (kind, title, body, author_id, place, municipality, neighbourhood_id, image_path, image_paths, done_at, created_at)
      values ('TOOL_LEND', i.title, coalesce(i.note, ''), i.owner_id, coalesce(i.place, i.municipality), i.municipality, i.neighbourhood_id,
              i.image_path, case when i.image_path is null then '{}' else array[i.image_path] end,
              case when i.active then null else now() end, i.created_at)
      returning id into v_notice;
    update lend_items set notice_id = v_notice where id = i.id;
  end loop;
end $$;

-- the old tool loans become lend requests, with the same ids so links keep working
insert into lend_requests (id, item_id, borrower_id, from_date, to_date, note, status, created_at)
select b.id, i.id, b.borrower_id, b.from_date, b.to_date, b.note,
       case b.status when 'APPROVED' then 'ACCEPTED' when 'RETURNED' then 'ACCEPTED' else b.status end, b.created_at
  from tool_bookings b join lend_items i on i.notice_id = b.notice_id
on conflict (id) do nothing;

alter table noticeboard_posts enable trigger t_notify_kommune_post;
alter table noticeboard_posts enable trigger t_notify_nabolag_post;
alter table noticeboard_posts enable trigger t_words_notices;
alter table noticeboard_posts enable trigger t_notice_to_lend_item;
alter table noticeboard_posts enable trigger t_notice_to_lend_item_del;
alter table lend_items enable trigger t_lend_items_guard;
alter table lend_items enable trigger t_lend_item_to_notice;

-- ---------------------------------------------------------------------------
-- 5. The old tool loans: a view and thin wrappers, for an app from before 0107
-- ---------------------------------------------------------------------------
drop function if exists request_tool_booking(uuid, date, date, text);
drop function if exists respond_tool_booking(uuid, text);
drop function if exists tool_booked_days(uuid);
drop table if exists tool_bookings;

create view tool_bookings with (security_invoker = true) as
  select r.id, i.notice_id, r.borrower_id, r.from_date, r.to_date, r.note,
         case when r.status = 'ACCEPTED' and r.to_date < current_date then 'RETURNED'
              when r.status = 'ACCEPTED' then 'APPROVED' else r.status end as status,
         null::timestamptz as reminded_at, r.created_at
    from lend_requests r join lend_items i on i.id = r.item_id
   where i.notice_id is not null;
grant select on tool_bookings to authenticated;

create or replace function tool_booked_days(p_notice_id uuid) returns table (from_date date, to_date date)
language sql stable security definer set search_path = public as $$
  select d.from_date, d.to_date from lend_items i, lend_busy_days(i.id) d where i.notice_id = p_notice_id;
$$;
revoke all on function tool_booked_days(uuid) from public, anon;
grant execute on function tool_booked_days(uuid) to authenticated;

create or replace function request_tool_booking(p_notice_id uuid, p_from date, p_to date, p_note text) returns tool_bookings
language plpgsql security definer set search_path = public as $$
declare v_item uuid; r lend_requests; t tool_bookings;
begin
  select id into v_item from lend_items where notice_id = p_notice_id;
  if v_item is null then raise exception 'Fant ikke oppslaget.'; end if;
  r := request_lend(v_item, p_from, p_to, p_note);
  select * into t from tool_bookings where id = r.id;
  return t;
end $$;
revoke all on function request_tool_booking(uuid, date, date, text) from public, anon;
grant execute on function request_tool_booking(uuid, date, date, text) to authenticated;

create or replace function respond_tool_booking(p_id uuid, p_status text) returns tool_bookings
language plpgsql security definer set search_path = public as $$
declare t tool_bookings;
begin
  -- «Levert tilbake» has no step of its own any more: the loan simply ends on its last day
  if p_status <> 'RETURNED' then
    perform respond_lend(p_id, case p_status when 'APPROVED' then 'ACCEPTED' else p_status end, null);
  end if;
  select * into t from tool_bookings where id = p_id;
  return t;
end $$;
revoke all on function respond_tool_booking(uuid, text) from public, anon;
grant execute on function respond_tool_booking(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. What used tool_bookings directly
-- ---------------------------------------------------------------------------
create or replace function profile_deleted_new_data() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_path text;
begin
  if new.deleted_at is null or old.deleted_at is not null then return new; end if;
  delete from listing_questions where author_id = new.id;
  delete from notice_signups where profile_id = new.id;
  delete from notice_likes where profile_id = new.id;
  delete from lend_requests where borrower_id = new.id and status in ('PENDING','ACCEPTED') and to_date >= current_date;
  delete from thank_cards where from_profile_id = new.id or to_profile_id = new.id;
  select file_path into v_path from police_certificates where profile_id = new.id;
  if v_path is not null then perform queue_file_purge('police-certificates', v_path); end if;
  delete from police_certificates where profile_id = new.id;
  return new;
end $$;

-- the dugnad reminder stays; the return-day reminder for loans is send_feature_reminders (0106)
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
  return v;
end $$;
revoke all on function send_community_reminders() from public, anon, authenticated;
