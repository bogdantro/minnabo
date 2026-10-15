-- 0065_nabolag.sql
-- Nabolag are now a fixed list that MinNabo manages (the website's admin), not something
-- that appears by itself from a person's «område».
--  * neighbourhoods: `active` (hidden when false) and `sort`. People can no longer create
--    rows, and can only join through join_nabolag(): active nabolag only, at most 3.
--  * An oppslag is for the whole kommune (neighbourhood_id null, as before) or for ONE
--    nabolag. A nabolag oppslag can only be written and read by its members (and the
--    author / admins), and so can its svar and the private reply to the author.
--  * A new nabolag oppslag gives the other members a varsel.
--  * Lillehammer's nabolag are seeded. Other kommuner have none yet: «Hele kommunen» only.
-- Youth accounts stay locked out (the existing block_youth_writes triggers).
--
-- For the website: manage rows in `neighbourhoods` (name = "<place> nabolag", place,
-- municipality, active, sort). Hide with active = false instead of deleting – a nabolag
-- that still has oppslag cannot be deleted (move them first: update neighbourhood_id).

alter table neighbourhoods add column if not exists active boolean not null default true;
alter table neighbourhoods add column if not exists sort integer not null default 0;

-- ---------------------------------------------------------------------------
-- 1. The list: Lillehammer
-- ---------------------------------------------------------------------------
insert into neighbourhoods (name, place, municipality, sort, active)
select p || ' nabolag', p, 'Lillehammer', i * 10, true
  from unnest(array[
    'Sentrum', 'Nordre Ål', 'Søre Ål', 'Vingnes', 'Vingrom', 'Jørstadmoen', 'Fåberg', 'Rudsbygd',
    'Saksumdal', 'Nordseter', 'Røyslimoen', 'Vårsetergrenda', 'Kringsjå', 'Hammartun', 'Smestad',
    'Skårsetlia', 'Busmoen', 'Ekrom', 'Storhove', 'Stampesletta', 'Kanten'
  ]) with ordinality as t(p, i)
on conflict (municipality, place) do update set active = true, sort = excluded.sort;

-- Nabolag that people made themselves and that are not on the list: hidden, and emptied.
update neighbourhoods set active = false where sort = 0;
delete from neighbourhood_members m using neighbourhoods n where n.id = m.neighbourhood_id and not n.active;

-- ---------------------------------------------------------------------------
-- 2. Who can do what
-- ---------------------------------------------------------------------------
drop policy if exists neighbourhoods_create on neighbourhoods;
drop policy if exists neighbourhoods_read_all on neighbourhoods;
create policy neighbourhoods_read on neighbourhoods for select to authenticated
  using (active or is_admin());

-- memberships: read your own; joining and leaving go through the functions below
drop policy if exists neighbourhood_members_own on neighbourhood_members;
create policy neighbourhood_members_read on neighbourhood_members for select to authenticated
  using (profile_id = auth.uid());
revoke insert, update, delete on neighbourhood_members from authenticated, anon;
revoke insert, update, delete on neighbourhoods from authenticated, anon;

create or replace function is_nabolag_member(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from neighbourhood_members m where m.neighbourhood_id = p_id and m.profile_id = auth.uid());
$$;
revoke all on function is_nabolag_member(uuid) from public, anon;
grant execute on function is_nabolag_member(uuid) to authenticated;

create or replace function join_nabolag(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  if not exists (select 1 from neighbourhoods where id = p_id and active) then
    raise exception 'Fant ikke nabolaget.';
  end if;
  if exists (select 1 from neighbourhood_members where neighbourhood_id = p_id and profile_id = v_me) then return; end if;
  if (select count(*) from neighbourhood_members m join neighbourhoods n on n.id = m.neighbourhood_id
       where m.profile_id = v_me and n.active) >= 3 then
    raise exception 'Du kan være med i høyst 3 nabolag. Forlat ett for å bli med i et nytt.';
  end if;
  insert into neighbourhood_members (neighbourhood_id, profile_id) values (p_id, v_me);
end $$;
revoke all on function join_nabolag(uuid) from public, anon;
grant execute on function join_nabolag(uuid) to authenticated;

-- The old way in (kommune + område): no longer creates a nabolag.
create or replace function join_neighbourhood(p_municipality text, p_place text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from neighbourhoods where municipality = p_municipality and place = p_place and active;
  if v_id is null then raise exception 'Fant ikke nabolaget.'; end if;
  perform join_nabolag(v_id);
  return v_id;
end $$;

-- Every nabolag in a kommune, or (without a kommune) the ones I am in.
create or replace function nabolag_list(p_municipality text default null)
returns table (id uuid, name text, place text, municipality text, member_count integer, is_member boolean)
language sql stable security definer set search_path = public as $$
  select n.id, n.name, n.place, n.municipality,
         (select count(*)::int from neighbourhood_members m where m.neighbourhood_id = n.id),
         exists (select 1 from neighbourhood_members m where m.neighbourhood_id = n.id and m.profile_id = auth.uid())
    from neighbourhoods n
   where n.active and auth.uid() is not null
     and (n.municipality = p_municipality
          or (p_municipality is null
              and exists (select 1 from neighbourhood_members m where m.neighbourhood_id = n.id and m.profile_id = auth.uid())))
   order by n.sort, n.place;
$$;
revoke all on function nabolag_list(text) from public, anon;
grant execute on function nabolag_list(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Oppslag for one nabolag
-- ---------------------------------------------------------------------------
alter table noticeboard_posts
  add column if not exists neighbourhood_id uuid references neighbourhoods(id) on delete restrict;
create index if not exists noticeboard_posts_nabolag_idx on noticeboard_posts(neighbourhood_id) where neighbourhood_id is not null;

drop policy if exists noticeboard_read_all on noticeboard_posts;
create policy noticeboard_read_all on noticeboard_posts for select to authenticated
  using ((hidden_at is null or author_id = auth.uid() or is_admin())
     and (neighbourhood_id is null or author_id = auth.uid() or is_admin() or is_nabolag_member(neighbourhood_id)));

drop policy if exists noticeboard_write_own on noticeboard_posts;
create policy noticeboard_write_own on noticeboard_posts to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and (neighbourhood_id is null or is_nabolag_member(neighbourhood_id)));

-- A nabolag oppslag always carries the nabolag's own kommune and place.
create or replace function notice_nabolag_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare n neighbourhoods;
begin
  if new.neighbourhood_id is null then return new; end if;
  select * into n from neighbourhoods where id = new.neighbourhood_id;
  if not found or not n.active then raise exception 'Fant ikke nabolaget.'; end if;
  new.municipality := n.municipality;
  new.place := n.place;
  return new;
end $$;
revoke all on function notice_nabolag_sync() from public, anon, authenticated;
drop trigger if exists t_notice_nabolag_sync on noticeboard_posts;
create trigger t_notice_nabolag_sync before insert or update of neighbourhood_id on noticeboard_posts
  for each row execute function notice_nabolag_sync();

-- Svar: only on oppslag the person can read (the sub-query runs with their own access).
drop policy if exists p_notice_comments_insert on notice_comments;
create policy p_notice_comments_insert on notice_comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from noticeboard_posts n where n.id = notice_id));

-- The private reply to the author: same rule. Otherwise unchanged from 0041.
create or replace function start_conversation_for_notice(p_notice_id uuid)
returns conversations language plpgsql security definer set search_path = public as $$
declare n noticeboard_posts; v_me uuid := auth.uid(); v_conv conversations;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  if is_youth(v_me) then
    raise exception 'Dette er ikke tilgjengelig for ungdomskontoer.' using errcode = '42501';
  end if;
  select * into n from noticeboard_posts where id = p_notice_id and hidden_at is null;
  if not found then raise exception 'Fant ikke oppslaget.'; end if;
  if n.neighbourhood_id is not null and n.author_id <> v_me and not is_nabolag_member(n.neighbourhood_id) then
    raise exception 'Fant ikke oppslaget.';
  end if;
  if n.author_id = v_me then raise exception 'Du kan ikke svare på ditt eget oppslag.'; end if;
  if exists (select 1 from blocks b
              where (b.by_profile_id = v_me and b.blocked_profile_id = n.author_id)
                 or (b.by_profile_id = n.author_id and b.blocked_profile_id = v_me)) then
    raise exception 'Du kan ikke kontakte denne personen.' using errcode = '42501';
  end if;

  select c.* into v_conv from conversations c
    join conversation_participants a on a.conversation_id = c.id and a.profile_id = v_me
    join conversation_participants b on b.conversation_id = c.id and b.profile_id = n.author_id
   where c.notice_id = p_notice_id limit 1;
  if found then return v_conv; end if;

  insert into conversations (notice_id, notice_title, notice_place)
    values (n.id, n.title, n.place) returning * into v_conv;
  insert into conversation_participants (conversation_id, profile_id)
    values (v_conv.id, v_me), (v_conv.id, n.author_id);
  return v_conv;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Varsel to the nabolag
-- ---------------------------------------------------------------------------
-- Uses the kind the other oppslag varsler use, so the «Oppslag» switch in Varsler covers it.
create or replace function notify_nabolag_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.neighbourhood_id is null or new.hidden_at is not null then return new; end if;
  insert into notifications (profile_id, kind, title, body, route)
  select m.profile_id, 'NOTICE_REPLY'::text::notification_kind,
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
drop trigger if exists t_notify_nabolag_post on noticeboard_posts;
create trigger t_notify_nabolag_post after insert on noticeboard_posts
  for each row execute function notify_nabolag_post();
