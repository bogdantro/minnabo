-- 0108_fellesskap.sql
--  Asked 2026-11-14 («Do this»): the open items from the earlier idea lists and the 50 Fellesskap ideas
--  (docs/IDEAS.md part 2; Hjertestarter and the waste calendar were left out on request).
--    A. Shared helper for one street: neighbours join a snømåking / plen oppdrag («Ta med min innkjørsel»).
--    (B. «Alt i orden etter jobben?» three days after a job was already sent by 0087, FOLLOW_UP.)
--    1. New kinds of oppslag as a `topic` on GENERAL (so apps from before 1.3 still show them as «Oppslag»):
--       ønsker å låne, byttes, overskuddsmat, hagens overskudd, savnet dyr, samkjøring, anbefalinger, strømbrudd.
--    2. Nabolag: house rules, verter (hosts) who can pin oppslag, a one-line introduction, «Nye naboer».
--    3. Lag og foreninger: a directory, with verified organisation accounts that post arrangementer.
--    4. Support to lag: «Stem på neste støtte», stories on a donation, the next payout's progress.
--    5. Partners: follow a partner, «Spør fagfolk», «Tips en bedrift», partner arrangementer.
--    6. «Jeg kan hjelpe i dag», språkvenn and vennetjeneste sign-ups (MinNabo pairs people by hand).
--    7. Arrangementer: weekly repeat, «Hvem tar med hva», volunteer slots, a shared photo album.
--    8. Nabolag projects with supporters and steps; «Forslag til kommunen».
--    9. «Ukas bilde», community badges.
--   10. Summaries: «Denne uka i nabolaget», the kommune pulse, my own year, and the Sunday digest
--       now also counts oppslag and arrangementer (one push, not two).
--  Youth accounts (rule 5) may use all of it except: samkjøring (never, for safety), being a vert, an
--  organisation account and the vennetjeneste.

-- ---------------------------------------------------------------------------
-- A. Shared helper for one street
-- ---------------------------------------------------------------------------
alter table listings add column if not exists shared_street boolean not null default false;

create table if not exists listing_joiners (
  listing_id uuid not null references listings(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  primary key (listing_id, profile_id)
);
alter table listing_joiners enable row level security;
revoke all on listing_joiners from anon, authenticated;

-- «Ta med min innkjørsel»: only on an open snømåking / hage oppdrag the owner shared, in my own kommune.
create or replace function join_shared_listing(p_listing uuid, p_join boolean, p_note text default '') returns int
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); l listings; v_n int;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  select * into l from listings where id = p_listing;
  if not found or not l.shared_street then raise exception 'Dette oppdraget kan ikke deles.'; end if;
  if p_join then
    if l.owner_id = v_me then raise exception 'Dette er ditt eget oppdrag.'; end if;
    if l.status::text not in ('PUBLISHED', 'RECEIVING_OFFERS') then raise exception 'Oppdraget er ikke åpent lenger.'; end if;
    if is_youth(v_me) then raise exception 'Ungdomskontoer kan ikke bli med på et oppdrag.' using errcode = '42501'; end if;
    if (select municipality from profiles where id = v_me) is distinct from l.municipality then
      raise exception 'Du kan bare bli med på oppdrag i din egen kommune.';
    end if;
    insert into listing_joiners (listing_id, profile_id, note) values (p_listing, v_me, left(coalesce(p_note, ''), 120))
      on conflict (listing_id, profile_id) do update set note = excluded.note;
    insert into notifications (profile_id, kind, title, body, route)
      values (l.owner_id, 'NEW_OFFER'::text::notification_kind,
              first_name(v_me) || ' vil være med på oppdraget',
              '«' || l.title || '». Hjelperen får vite at det gjelder flere innkjørsler.', '/oppdrag/' || l.id);
  else
    delete from listing_joiners where listing_id = p_listing and profile_id = v_me;
  end if;
  select count(*) into v_n from listing_joiners where listing_id = p_listing;
  return v_n;
end $$;
revoke all on function join_shared_listing(uuid, boolean, text) from public, anon;
grant execute on function join_shared_listing(uuid, boolean, text) to authenticated;

-- How many joined, whether I did, and – for the owner and helpers with a tilbud – who and their note.
create or replace function shared_listing_joiners(p_listing uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'count', (select count(*) from listing_joiners where listing_id = p_listing),
    'mine', exists (select 1 from listing_joiners where listing_id = p_listing and profile_id = auth.uid()),
    'people', case when exists (select 1 from listings where id = p_listing and owner_id = auth.uid())
                     or exists (select 1 from proposals where listing_id = p_listing and from_profile_id = auth.uid())
                   then coalesce((select json_agg(json_build_object('name', first_name(j.profile_id), 'note', j.note) order by j.created_at)
                                    from listing_joiners j where j.listing_id = p_listing), '[]'::json)
                   else '[]'::json end);
$$;
revoke all on function shared_listing_joiners(uuid) from public, anon;
grant execute on function shared_listing_joiners(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. New kinds of oppslag (a topic on GENERAL)
-- ---------------------------------------------------------------------------
alter table noticeboard_posts add column if not exists topic text;
alter table noticeboard_posts drop constraint if exists noticeboard_topic_check;
alter table noticeboard_posts add constraint noticeboard_topic_check
  check (topic is null or topic in ('WANT_BORROW', 'SWAP', 'FOOD', 'HARVEST', 'PET', 'RIDE', 'RECOMMEND', 'OUTAGE'));
-- overskuddsmat and strømbrudd close by themselves
alter table noticeboard_posts add column if not exists expires_at timestamptz;
-- 2. a vert pinned it to the top of the nabolag
alter table noticeboard_posts add column if not exists pinned_at timestamptz;
-- 3. posted by a lag / forening, 5. by a partner (set in Admin)
alter table noticeboard_posts add column if not exists organisation_id uuid;
alter table noticeboard_posts add column if not exists partner_id uuid references partners(id) on delete set null;
-- 7. an arrangement that repeats every week
alter table noticeboard_posts add column if not exists repeat_weekly boolean not null default false;

create or replace function notice_topic_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.topic is not null then
    new.kind := 'GENERAL';
    if new.topic = 'RIDE' and is_youth(new.author_id) then
      raise exception 'Samkjøring er ikke tilgjengelig for ungdomskontoer.' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' then
      new.expires_at := case new.topic when 'FOOD' then now() + interval '24 hours'
                                       when 'OUTAGE' then now() + interval '6 hours' else null end;
    end if;
  end if;
  -- these are set through their own functions (or Admin), never by the author directly
  if tg_op = 'INSERT' then
    if not is_admin() then new.pinned_at := null; new.partner_id := null; end if;
  else
    if not is_admin() and not coalesce(current_setting('minnabo.host_pin', true), '') = 'on' then
      new.pinned_at := old.pinned_at;
    end if;
    if not is_admin() then new.partner_id := old.partner_id; end if;
    if new.organisation_id is distinct from old.organisation_id and not is_admin() then new.organisation_id := old.organisation_id; end if;
  end if;
  if tg_op = 'INSERT' and new.organisation_id is not null and not is_admin()
     and not exists (select 1 from organisation_admins a where a.organisation_id = new.organisation_id and a.profile_id = new.author_id) then
    raise exception 'Du kan ikke legge ut for denne foreningen.' using errcode = '42501';
  end if;
  return new;
end $$;

-- «Hos meg også» on a strømbrudd
create table if not exists notice_metoo (
  notice_id uuid not null references noticeboard_posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (notice_id, profile_id)
);
alter table notice_metoo enable row level security;
revoke all on notice_metoo from anon, authenticated;

create or replace function set_notice_metoo(p_notice uuid, p_on boolean) returns int
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); n noticeboard_posts; v_n int;
begin
  select * into n from noticeboard_posts where id = p_notice;
  if not found or v_me is null or n.hidden_at is not null then raise exception 'Fant ikke oppslaget.'; end if;
  if n.neighbourhood_id is not null and not is_nabolag_member(n.neighbourhood_id) and n.author_id <> v_me then
    raise exception 'Fant ikke oppslaget.';
  end if;
  if p_on then
    insert into notice_metoo (notice_id, profile_id) values (p_notice, v_me) on conflict do nothing;
    -- a strømbrudd others confirm stays up a little longer
    update noticeboard_posts set expires_at = greatest(expires_at, now() + interval '3 hours')
     where id = p_notice and topic = 'OUTAGE' and done_at is null;
  else
    delete from notice_metoo where notice_id = p_notice and profile_id = v_me;
  end if;
  select count(*) into v_n from notice_metoo where notice_id = p_notice;
  return v_n;
end $$;
revoke all on function set_notice_metoo(uuid, boolean) from public, anon;
grant execute on function set_notice_metoo(uuid, boolean) to authenticated;

create or replace function notice_metoo_state(p_notice uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('count', (select count(*) from notice_metoo where notice_id = p_notice),
                           'mine', exists (select 1 from notice_metoo where notice_id = p_notice and profile_id = auth.uid()));
$$;
revoke all on function notice_metoo_state(uuid) from public, anon;
grant execute on function notice_metoo_state(uuid) to authenticated;

-- «Anbefalinger»: answers sorted by likes
create table if not exists notice_comment_likes (
  comment_id uuid not null references notice_comments(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (comment_id, profile_id)
);
alter table notice_comment_likes enable row level security;
revoke all on notice_comment_likes from anon, authenticated;

create or replace function toggle_comment_like(p_comment uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_n int;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  if not exists (select 1 from notice_comments c join noticeboard_posts n on n.id = c.notice_id
                  where c.id = p_comment and n.hidden_at is null
                    and (n.neighbourhood_id is null or is_nabolag_member(n.neighbourhood_id) or n.author_id = v_me)) then
    raise exception 'Fant ikke svaret.';
  end if;
  if exists (select 1 from notice_comment_likes where comment_id = p_comment and profile_id = v_me) then
    delete from notice_comment_likes where comment_id = p_comment and profile_id = v_me;
  else
    insert into notice_comment_likes (comment_id, profile_id) values (p_comment, v_me);
  end if;
  select count(*) into v_n from notice_comment_likes where comment_id = p_comment;
  return v_n;
end $$;
revoke all on function toggle_comment_like(uuid) from public, anon;
grant execute on function toggle_comment_like(uuid) to authenticated;

create or replace function notice_comment_likes_for(p_notice uuid) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(c.id, json_build_object(
           'count', (select count(*) from notice_comment_likes l where l.comment_id = c.id),
           'mine', exists (select 1 from notice_comment_likes l where l.comment_id = c.id and l.profile_id = auth.uid()))), '{}'::json)
    from notice_comments c where c.notice_id = p_notice;
$$;
revoke all on function notice_comment_likes_for(uuid) from public, anon;
grant execute on function notice_comment_likes_for(uuid) to authenticated;

-- Savnet dyr goes to everyone in the nabolag / kommune at once (past the 3-a-day limit of 0097),
-- and «Ønsker å låne» to the neighbours whose things on Utlån match a word in the title.
create or replace function notice_topic_alerts() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_words text[];
begin
  if new.topic = 'PET' then
    insert into notifications (profile_id, kind, title, body, route)
      select distinct p.id, 'NABOLAG_POST'::text::notification_kind, 'Savnet dyr: ' || new.title,
             'Har du sett det? Trykk «Sett den?» hvis du har.', '/oppslagstavle?oppslag=' || new.id
        from profiles p
       where p.id <> new.author_id and p.deleted_at is null
         and ((new.neighbourhood_id is not null and exists (select 1 from neighbourhood_members m
                                                            where m.neighbourhood_id = new.neighbourhood_id and m.profile_id = p.id))
           or (new.neighbourhood_id is null and p.municipality = new.municipality));
  elsif new.topic = 'WANT_BORROW' then
    v_words := array(select w from regexp_split_to_table(lower(new.title), '[^a-zæøå0-9]+') w where char_length(w) >= 4);
    if array_length(v_words, 1) > 0 then
      insert into notifications (profile_id, kind, title, body, route)
        select distinct i.owner_id, 'NABOLAG_POST'::text::notification_kind, first_name(new.author_id) || ' ønsker å låne noe du har',
               '«' || new.title || '». Svar på oppslaget hvis du kan låne bort.', '/oppslagstavle?oppslag=' || new.id
          from lend_items i
         where i.owner_id <> new.author_id and i.municipality = new.municipality
           and exists (select 1 from unnest(v_words) w where lower(i.title) like '%' || w || '%');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists t_notice_topic_alerts on noticeboard_posts;
create trigger t_notice_topic_alerts after insert on noticeboard_posts for each row when (new.topic is not null)
  execute function notice_topic_alerts();

-- overskuddsmat and strømbrudd close themselves; a weekly arrangement moves on to next week two hours after it started
create or replace function close_expired_notices() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update noticeboard_posts
     set event_at = event_at + make_interval(days => 7 * ceil(extract(epoch from (now() - interval '2 hours' - event_at)) / (7 * 86400.0))::int)
   where repeat_weekly and event_at is not null and event_at < now() - interval '2 hours' and done_at is null and hidden_at is null;
  with x as (update noticeboard_posts set done_at = now(), auto_closed = true
              where expires_at is not null and expires_at < now() and done_at is null returning 1)
  select count(*)::int into v_n from x;
  return v_n;
end $$;
revoke all on function close_expired_notices() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Nabolag: rules, verter, introductions, new neighbours
-- ---------------------------------------------------------------------------
alter table neighbourhoods add column if not exists rules text not null default '' check (char_length(rules) <= 1200);
alter table neighbourhood_members add column if not exists intro text not null default '' check (char_length(intro) <= 140);
-- «Vis meg under Nye naboer» – off until the person says yes
alter table neighbourhood_members add column if not exists show_as_new boolean not null default false;

create table if not exists neighbourhood_hosts (
  neighbourhood_id uuid not null references neighbourhoods(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (neighbourhood_id, profile_id)
);
alter table neighbourhood_hosts enable row level security;
drop policy if exists p_nabolag_hosts_read on neighbourhood_hosts;
create policy p_nabolag_hosts_read on neighbourhood_hosts for select to authenticated using (true);
revoke insert, update, delete on neighbourhood_hosts from anon, authenticated;
drop policy if exists p_nabolag_hosts_admin on neighbourhood_hosts;
create policy p_nabolag_hosts_admin on neighbourhood_hosts for all to authenticated using (is_admin()) with check (is_admin());
grant insert, update, delete on neighbourhood_hosts to authenticated;

create or replace function is_nabolag_host(p_nabolag uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from neighbourhood_hosts where neighbourhood_id = p_nabolag and profile_id = auth.uid());
$$;
revoke all on function is_nabolag_host(uuid) from public, anon;
grant execute on function is_nabolag_host(uuid) to authenticated;

create or replace function set_nabolag_rules(p_nabolag uuid, p_rules text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_nabolag_host(p_nabolag) or is_admin()) then raise exception 'Bare verter kan endre reglene.' using errcode = '42501'; end if;
  update neighbourhoods set rules = left(trim(coalesce(p_rules, '')), 1200) where id = p_nabolag;
end $$;
revoke all on function set_nabolag_rules(uuid, text) from public, anon;
grant execute on function set_nabolag_rules(uuid, text) to authenticated;

-- A vert pins (or unpins) an oppslag in their nabolag; at most 3 pinned at a time.
create or replace function pin_notice(p_notice uuid, p_pin boolean) returns void
language plpgsql security definer set search_path = public as $$
declare n noticeboard_posts;
begin
  select * into n from noticeboard_posts where id = p_notice;
  if not found or n.neighbourhood_id is null then raise exception 'Bare oppslag i et nabolag kan festes.'; end if;
  if not (is_nabolag_host(n.neighbourhood_id) or is_admin()) then raise exception 'Bare verter kan feste oppslag.' using errcode = '42501'; end if;
  if p_pin and (select count(*) from noticeboard_posts where neighbourhood_id = n.neighbourhood_id and pinned_at is not null and id <> p_notice) >= 3 then
    raise exception 'Det kan bare være 3 festede oppslag. Løsne et først.';
  end if;
  perform set_config('minnabo.host_pin', 'on', true);
  update noticeboard_posts set pinned_at = case when p_pin then now() else null end where id = p_notice;
  perform set_config('minnabo.host_pin', 'off', true);
end $$;
revoke all on function pin_notice(uuid, boolean) from public, anon;
grant execute on function pin_notice(uuid, boolean) to authenticated;

create or replace function set_nabolag_intro(p_nabolag uuid, p_intro text, p_show_as_new boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update neighbourhood_members set intro = left(trim(coalesce(p_intro, '')), 140), show_as_new = coalesce(p_show_as_new, false)
   where neighbourhood_id = p_nabolag and profile_id = auth.uid();
  if not found then raise exception 'Du er ikke med i dette nabolaget.'; end if;
end $$;
revoke all on function set_nabolag_intro(uuid, text, boolean) from public, anon;
grant execute on function set_nabolag_intro(uuid, text, boolean) to authenticated;

-- Everything Fellesskap shows about one nabolag: rules, verter, my intro, and the new neighbours who said yes.
create or replace function nabolag_details(p_nabolag uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'rules', (select rules from neighbourhoods where id = p_nabolag),
    'hosts', coalesce((select json_agg(json_build_object('id', h.profile_id, 'name', first_name(h.profile_id)))
                         from neighbourhood_hosts h where h.neighbourhood_id = p_nabolag), '[]'::json),
    'iAmHost', is_nabolag_host(p_nabolag),
    'myIntro', (select intro from neighbourhood_members where neighbourhood_id = p_nabolag and profile_id = auth.uid()),
    'myShowAsNew', (select show_as_new from neighbourhood_members where neighbourhood_id = p_nabolag and profile_id = auth.uid()),
    'newMembers', case when is_nabolag_member(p_nabolag) then coalesce((
        select json_agg(json_build_object('id', m.profile_id, 'name', first_name(m.profile_id), 'intro', m.intro, 'joinedAt', m.joined_at)
                        order by m.joined_at desc)
          from neighbourhood_members m join profiles p on p.id = m.profile_id
         where m.neighbourhood_id = p_nabolag and m.show_as_new and m.profile_id <> auth.uid()
           and m.joined_at > now() - interval '30 days' and p.deleted_at is null
           and not exists (select 1 from blocks b where (b.by_profile_id = auth.uid() and b.blocked_profile_id = m.profile_id)
                                                     or (b.by_profile_id = m.profile_id and b.blocked_profile_id = auth.uid()))), '[]'::json)
      else '[]'::json end);
$$;
revoke all on function nabolag_details(uuid) from public, anon;
grant execute on function nabolag_details(uuid) to authenticated;

-- «Si hei» to a new neighbour: a friendly notice, once per pair, only inside a nabolag both are in.
create table if not exists neighbour_waves (
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_profile_id, to_profile_id)
);
alter table neighbour_waves enable row level security;
drop policy if exists p_waves_own on neighbour_waves;
create policy p_waves_own on neighbour_waves for select to authenticated using (from_profile_id = auth.uid());

create or replace function wave_neighbour(p_nabolag uuid, p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_place text;
begin
  if v_me is null or p_to = v_me then raise exception 'Velg en nabo.'; end if;
  if not is_nabolag_member(p_nabolag)
     or not exists (select 1 from neighbourhood_members where neighbourhood_id = p_nabolag and profile_id = p_to and show_as_new) then
    raise exception 'Fant ikke naboen.';
  end if;
  if exists (select 1 from blocks b where (b.by_profile_id = v_me and b.blocked_profile_id = p_to)
                                       or (b.by_profile_id = p_to and b.blocked_profile_id = v_me)) then
    raise exception 'Fant ikke naboen.';
  end if;
  insert into neighbour_waves (from_profile_id, to_profile_id) values (v_me, p_to) on conflict do nothing;
  if not found then return; end if;
  select place into v_place from neighbourhoods where id = p_nabolag;
  insert into notifications (profile_id, kind, title, body, route)
    values (p_to, 'NABOLAG_POST'::text::notification_kind, first_name(v_me) || ' sier hei 👋',
            'Velkommen til ' || coalesce(v_place, 'nabolaget') || '!', '/nabolag-info/' || p_nabolag);
end $$;
revoke all on function wave_neighbour(uuid, uuid) from public, anon;
grant execute on function wave_neighbour(uuid, uuid) to authenticated;

create or replace function my_waves() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(to_profile_id), '[]'::json) from neighbour_waves where from_profile_id = auth.uid();
$$;
revoke all on function my_waves() from public, anon;
grant execute on function my_waves() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Lag og foreninger
-- ---------------------------------------------------------------------------
create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  municipality text not null,
  name text not null check (char_length(name) between 2 and 80),
  kind text not null default 'ANNET' check (kind in ('IDRETT', 'VEL', 'KORPS', 'KULTUR', 'FRIVILLIG', 'SKOLE', 'ANNET')),
  about text not null default '' check (char_length(about) <= 600),
  url text,
  logo_path text,
  verified boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists organisations_kommune_idx on organisations (municipality) where active;
alter table organisations enable row level security;
drop policy if exists p_organisations_read on organisations;
create policy p_organisations_read on organisations for select to authenticated using (active or is_admin());
drop policy if exists p_organisations_admin on organisations;
create policy p_organisations_admin on organisations for all to authenticated using (is_admin()) with check (is_admin());

create table if not exists organisation_admins (
  organisation_id uuid not null references organisations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (organisation_id, profile_id)
);
alter table organisation_admins enable row level security;
drop policy if exists p_org_admins_read on organisation_admins;
create policy p_org_admins_read on organisation_admins for select to authenticated using (profile_id = auth.uid() or is_admin());
drop policy if exists p_org_admins_admin on organisation_admins;
create policy p_org_admins_admin on organisation_admins for all to authenticated using (is_admin()) with check (is_admin());

alter table noticeboard_posts drop constraint if exists noticeboard_posts_organisation_fk;
alter table noticeboard_posts add constraint noticeboard_posts_organisation_fk
  foreign key (organisation_id) references organisations(id) on delete set null;

drop trigger if exists t_notice_topic_guard on noticeboard_posts;
create trigger t_notice_topic_guard before insert or update on noticeboard_posts for each row execute function notice_topic_guard();

-- ---------------------------------------------------------------------------
-- 4. Support to lag og foreninger
-- ---------------------------------------------------------------------------
alter table donation_records add column if not exists organisation_id uuid references organisations(id) on delete set null;
alter table donation_records add column if not exists story_title text;
alter table donation_records add column if not exists story_body text;
alter table donation_records add column if not exists story_image_path text;
alter table donation_records add column if not exists municipality text;

-- «Neste utbetaling»: what has been set aside and the goal, per kommune (filled in Admin)
create table if not exists donation_goals (
  municipality text primary key,
  goal_kr int not null check (goal_kr > 0),
  collected_kr int not null default 0 check (collected_kr >= 0),
  updated_at timestamptz not null default now()
);
alter table donation_goals enable row level security;
drop policy if exists p_donation_goals_read on donation_goals;
create policy p_donation_goals_read on donation_goals for select to authenticated using (true);
drop policy if exists p_donation_goals_admin on donation_goals;
create policy p_donation_goals_admin on donation_goals for all to authenticated using (is_admin()) with check (is_admin());

-- «Stem på neste støtte»: one vote per person per kommune and quarter
create table if not exists support_votes (
  round text not null,
  municipality text not null,
  organisation_id uuid not null references organisations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (round, municipality, profile_id)
);
alter table support_votes enable row level security;
revoke all on support_votes from anon, authenticated;

create or replace function support_round() returns text
language sql stable as $$ select to_char(now() at time zone 'Europe/Oslo', 'YYYY-"K"Q') $$;

create or replace function vote_support(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); o organisations;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  select * into o from organisations where id = p_org and active;
  if not found then raise exception 'Fant ikke foreningen.'; end if;
  if (select municipality from profiles where id = v_me) is distinct from o.municipality then
    raise exception 'Du kan bare stemme i din egen kommune.';
  end if;
  insert into support_votes (round, municipality, organisation_id, profile_id) values (support_round(), o.municipality, p_org, v_me)
    on conflict (round, municipality, profile_id) do update set organisation_id = excluded.organisation_id, created_at = now();
end $$;
revoke all on function vote_support(uuid) from public, anon;
grant execute on function vote_support(uuid) to authenticated;

create or replace function support_vote_state(p_municipality text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'round', support_round(),
    'mine', (select organisation_id from support_votes where round = support_round() and municipality = p_municipality and profile_id = auth.uid()),
    'counts', coalesce((select json_object_agg(organisation_id, n) from (
                 select organisation_id, count(*) n from support_votes where round = support_round() and municipality = p_municipality
                  group by organisation_id) x), '{}'::json),
    'goal', (select json_build_object('goalKr', goal_kr, 'collectedKr', collected_kr) from donation_goals where municipality = p_municipality));
$$;
revoke all on function support_vote_state(text) from public, anon;
grant execute on function support_vote_state(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Partners: follow, «Spør fagfolk», «Tips en bedrift»
-- ---------------------------------------------------------------------------
create table if not exists partner_follows (
  partner_id uuid not null references partners(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (partner_id, profile_id)
);
alter table partner_follows enable row level security;
drop policy if exists p_partner_follows_own on partner_follows;
create policy p_partner_follows_own on partner_follows for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- followers hear about a new offer from the partner, or a new partner arrangement
create or replace function partner_news_to_followers() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_partner uuid; v_title text; v_body text; v_route text;
begin
  if tg_table_name = 'partners' then
    if new.offer is null or new.offer is not distinct from old.offer then return new; end if;
    v_partner := new.id; v_title := new.name || ' har et nytt nabotilbud'; v_body := left(new.offer, 120); v_route := '/partner/' || new.id;
  else
    if new.partner_id is null or (tg_op = 'UPDATE' and old.partner_id is not distinct from new.partner_id) then return new; end if;
    v_partner := new.partner_id; v_title := (select name from partners where id = new.partner_id) || ' inviterer til ' || new.title;
    v_body := 'Et arrangement fra en partner du følger.'; v_route := '/oppslagstavle?oppslag=' || new.id;
  end if;
  insert into notifications (profile_id, kind, title, body, route)
    select f.profile_id, 'NABOLAG_POST'::text::notification_kind, v_title, v_body, v_route from partner_follows f where f.partner_id = v_partner;
  return new;
end $$;
drop trigger if exists t_partner_offer_news on partners;
create trigger t_partner_offer_news after update of offer on partners for each row execute function partner_news_to_followers();
drop trigger if exists t_partner_event_news on noticeboard_posts;
create trigger t_partner_event_news after insert or update of partner_id on noticeboard_posts for each row execute function partner_news_to_followers();

create table if not exists partner_questions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  body text not null check (char_length(body) between 5 and 400),
  answer text,
  answered_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);
alter table partner_questions enable row level security;
-- answered questions are public (without who asked); my own I see before the answer
drop policy if exists p_partner_questions_read on partner_questions;
create policy p_partner_questions_read on partner_questions for select to authenticated
  using (hidden_at is null and (answered_at is not null or profile_id = auth.uid()) or is_admin());
drop policy if exists p_partner_questions_ask on partner_questions;
create policy p_partner_questions_ask on partner_questions for insert to authenticated
  with check (profile_id = auth.uid() and answer is null and answered_at is null and hidden_at is null);
drop policy if exists p_partner_questions_admin on partner_questions;
create policy p_partner_questions_admin on partner_questions for update to authenticated using (is_admin()) with check (is_admin());

create or replace function partner_question_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from partner_questions where profile_id = new.profile_id and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Du kan stille 3 spørsmål i døgnet. Prøv igjen i morgen.';
  end if;
  return new;
end $$;
drop trigger if exists t_partner_question_guard on partner_questions;
create trigger t_partner_question_guard before insert on partner_questions for each row execute function partner_question_guard();

-- the asker hears when the partner has answered
create or replace function partner_question_answered() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.answered_at is not null and old.answered_at is null and new.profile_id is not null then
    insert into notifications (profile_id, kind, title, body, route)
      values (new.profile_id, 'NABOLAG_POST'::text::notification_kind,
              (select name from partners where id = new.partner_id) || ' har svart på spørsmålet ditt',
              left(new.answer, 120), '/partner/' || new.partner_id);
  end if;
  return new;
end $$;
drop trigger if exists t_partner_question_answered on partner_questions;
create trigger t_partner_question_answered after update of answered_at on partner_questions for each row execute function partner_question_answered();

create table if not exists business_tips (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  municipality text not null default '',
  name text not null check (char_length(name) between 2 and 100),
  why text not null default '' check (char_length(why) <= 400),
  created_at timestamptz not null default now()
);
alter table business_tips enable row level security;
drop policy if exists p_business_tips_insert on business_tips;
create policy p_business_tips_insert on business_tips for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists p_business_tips_admin on business_tips;
create policy p_business_tips_admin on business_tips for select to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- 6. «Jeg kan hjelpe i dag», språkvenn and vennetjeneste
-- ---------------------------------------------------------------------------
-- the day I said I'm free; it simply stops counting the next day
alter table profiles add column if not exists available_on date;

create or replace function set_available_today(p_on boolean) returns void
language sql security definer set search_path = public as $$
  update profiles set available_on = case when p_on then (now() at time zone 'Europe/Oslo')::date else null end where id = auth.uid();
$$;
revoke all on function set_available_today(boolean) from public, anon;
grant execute on function set_available_today(boolean) to authenticated;

-- Adult helpers in the kommune who said they're free today: a count for everyone, first names for the list.
create or replace function helpers_available_today(p_municipality text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'count', count(*),
    'mine', bool_or(p.id = auth.uid()),
    'people', coalesce(json_agg(json_build_object('id', p.id, 'name', first_name(p.id))) filter (where p.id <> auth.uid()), '[]'::json))
    from profiles p
   where p.municipality = p_municipality and p.available_on = (now() at time zone 'Europe/Oslo')::date
     and p.deleted_at is null and p.suspended_at is null and not is_youth(p.id)
     and not exists (select 1 from blocks b where (b.by_profile_id = auth.uid() and b.blocked_profile_id = p.id)
                                               or (b.by_profile_id = p.id and b.blocked_profile_id = auth.uid()));
$$;
revoke all on function helpers_available_today(text) from public, anon;
grant execute on function helpers_available_today(text) to authenticated;

create table if not exists buddy_signups (
  profile_id uuid not null references profiles(id) on delete cascade,
  program text not null check (program in ('SPRAKVENN', 'VENNETJENESTE')),
  role text not null check (role in ('WANTS', 'GIVES')),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  paired_at timestamptz,
  primary key (profile_id, program)
);
alter table buddy_signups enable row level security;
drop policy if exists p_buddy_read on buddy_signups;
create policy p_buddy_read on buddy_signups for select to authenticated using (profile_id = auth.uid() or is_admin());
drop policy if exists p_buddy_delete on buddy_signups;
create policy p_buddy_delete on buddy_signups for delete to authenticated using (profile_id = auth.uid());
drop policy if exists p_buddy_admin on buddy_signups;
create policy p_buddy_admin on buddy_signups for update to authenticated using (is_admin()) with check (is_admin());

create or replace function buddy_signup(p_program text, p_role text, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  if p_program = 'VENNETJENESTE' and is_youth(v_me) then
    raise exception 'Vennetjenesten er for voksne.' using errcode = '42501';
  end if;
  insert into buddy_signups (profile_id, program, role, note) values (v_me, p_program, p_role, left(coalesce(p_note, ''), 300))
    on conflict (profile_id, program) do update set role = excluded.role, note = excluded.note, created_at = now(), paired_at = null;
  -- MinNabo pairs people by hand: a short note in the MinNabo thread tells the person what happens next
  insert into notifications (profile_id, kind, title, body, route)
    values (v_me, 'NABOLAG_POST'::text::notification_kind,
            case p_program when 'SPRAKVENN' then 'Du er påmeldt Språkvenn' else 'Du er påmeldt Vennetjenesten' end,
            'MinNabo finner en nabo som passer og tar kontakt med deg i MinNabo-tråden.', '/minnabo');
end $$;
revoke all on function buddy_signup(text, text, text) from public, anon;
grant execute on function buddy_signup(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Arrangementer: «Hvem tar med hva», volunteer slots, photo album
-- ---------------------------------------------------------------------------
create table if not exists event_items (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references noticeboard_posts(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  -- null = a «Hvem tar med …» item; a number = a volunteer slot that needs this many
  needed int check (needed is null or needed between 1 and 50),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists event_item_takers (
  item_id uuid not null references event_items(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, profile_id)
);
alter table event_items enable row level security;
alter table event_item_takers enable row level security;
revoke all on event_items from anon, authenticated;
revoke all on event_item_takers from anon, authenticated;

create or replace function can_see_notice(p_notice uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from noticeboard_posts n where n.id = p_notice and n.hidden_at is null
                   and (n.neighbourhood_id is null or n.author_id = auth.uid() or is_nabolag_member(n.neighbourhood_id)));
$$;
revoke all on function can_see_notice(uuid) from public, anon;
grant execute on function can_see_notice(uuid) to authenticated;

-- The organiser adds a thing to bring or a slot; anyone coming may add a thing to bring.
create or replace function add_event_item(p_notice uuid, p_label text, p_needed int default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); n noticeboard_posts; v_id uuid;
begin
  select * into n from noticeboard_posts where id = p_notice;
  if not found or n.event_type is null or not can_see_notice(p_notice) then raise exception 'Fant ikke arrangementet.'; end if;
  if p_needed is not null and n.author_id <> v_me then raise exception 'Bare arrangøren kan legge til frivillige oppgaver.' using errcode = '42501'; end if;
  if (select count(*) from event_items where notice_id = p_notice) >= 30 then raise exception 'Listen er full.'; end if;
  insert into event_items (notice_id, label, needed, created_by) values (p_notice, trim(p_label), p_needed, v_me) returning id into v_id;
  return v_id;
end $$;
revoke all on function add_event_item(uuid, text, int) from public, anon;
grant execute on function add_event_item(uuid, text, int) to authenticated;

create or replace function remove_event_item(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from event_items i using noticeboard_posts n
   where i.id = p_item and n.id = i.notice_id and (n.author_id = auth.uid() or i.created_by = auth.uid());
end $$;
revoke all on function remove_event_item(uuid) from public, anon;
grant execute on function remove_event_item(uuid) to authenticated;

-- «Jeg tar med» / «Jeg stiller»; a «tar med» item has one taker, a slot up to `needed`
create or replace function take_event_item(p_item uuid, p_take boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); i event_items; v_taken int;
begin
  select * into i from event_items where id = p_item;
  if not found or not can_see_notice(i.notice_id) then raise exception 'Fant ikke oppgaven.'; end if;
  if not p_take then delete from event_item_takers where item_id = p_item and profile_id = v_me; return; end if;
  select count(*) into v_taken from event_item_takers where item_id = p_item and profile_id <> v_me;
  if v_taken >= coalesce(i.needed, 1) then raise exception 'Noen har allerede tatt denne.'; end if;
  insert into event_item_takers (item_id, profile_id) values (p_item, v_me) on conflict do nothing;
end $$;
revoke all on function take_event_item(uuid, boolean) from public, anon;
grant execute on function take_event_item(uuid, boolean) to authenticated;

create or replace function event_items_for(p_notice uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when can_see_notice(p_notice) then coalesce(json_agg(json_build_object(
           'id', i.id, 'label', i.label, 'needed', i.needed, 'createdBy', i.created_by,
           'takers', coalesce((select json_agg(json_build_object('id', t.profile_id, 'name', first_name(t.profile_id)) order by t.created_at)
                                 from event_item_takers t where t.item_id = i.id), '[]'::json)) order by i.needed nulls first, i.created_at), '[]'::json)
         else '[]'::json end
    from event_items i where i.notice_id = p_notice;
$$;
revoke all on function event_items_for(uuid) from public, anon;
grant execute on function event_items_for(uuid) to authenticated;

create table if not exists event_photos (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references noticeboard_posts(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  path text not null,
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);
alter table event_photos enable row level security;
revoke all on event_photos from anon, authenticated;

-- people who answered «Kommer» (and the organiser) add photos from when the arrangement has started
create or replace function add_event_photo(p_notice uuid, p_path text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); n noticeboard_posts; v_id uuid;
begin
  select * into n from noticeboard_posts where id = p_notice;
  if not found or n.event_type is null or not can_see_notice(p_notice) then raise exception 'Fant ikke arrangementet.'; end if;
  if n.event_at is null or n.event_at > now() then raise exception 'Bilder kan legges til når arrangementet har startet.'; end if;
  if n.author_id <> v_me and not exists (select 1 from notice_signups r where r.notice_id = p_notice and r.profile_id = v_me and r.status = 'GOING') then
    raise exception 'Bare de som kom kan legge til bilder.' using errcode = '42501';
  end if;
  if (select count(*) from event_photos where notice_id = p_notice and profile_id = v_me) >= 20 then raise exception 'Du kan legge til 20 bilder.'; end if;
  insert into event_photos (notice_id, profile_id, path) values (p_notice, v_me, p_path) returning id into v_id;
  return v_id;
end $$;
revoke all on function add_event_photo(uuid, text) from public, anon;
grant execute on function add_event_photo(uuid, text) to authenticated;

create or replace function remove_event_photo(p_photo uuid) returns void
language sql security definer set search_path = public as $$
  delete from event_photos p using noticeboard_posts n
   where p.id = p_photo and n.id = p.notice_id and (p.profile_id = auth.uid() or n.author_id = auth.uid());
$$;
revoke all on function remove_event_photo(uuid) from public, anon;
grant execute on function remove_event_photo(uuid) to authenticated;

create or replace function event_photos_for(p_notice uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when can_see_notice(p_notice) then coalesce(json_agg(json_build_object('id', id, 'path', path, 'profileId', profile_id, 'createdAt', created_at)
           order by created_at), '[]'::json) else '[]'::json end
    from event_photos where notice_id = p_notice and hidden_at is null;
$$;
revoke all on function event_photos_for(uuid) from public, anon;
grant execute on function event_photos_for(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Nabolag projects and «Forslag til kommunen»
-- ---------------------------------------------------------------------------
create table if not exists community_projects (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  municipality text not null,
  neighbourhood_id uuid references neighbourhoods(id) on delete set null,
  kind text not null default 'PROJECT' check (kind in ('PROJECT', 'PROPOSAL')),
  title text not null check (char_length(title) between 4 and 90),
  body text not null default '' check (char_length(body) <= 1500),
  steps text[] not null default '{}',
  steps_done int not null default 0,
  sent_at timestamptz,
  hidden_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table community_projects enable row level security;
drop policy if exists p_projects_read on community_projects;
create policy p_projects_read on community_projects for select to authenticated
  using ((hidden_at is null or author_id = auth.uid() or is_admin())
     and (neighbourhood_id is null or author_id = auth.uid() or is_nabolag_member(neighbourhood_id) or is_admin()));
drop policy if exists p_projects_write on community_projects;
create policy p_projects_write on community_projects for all to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid() and hidden_at is null
     and (neighbourhood_id is null or is_nabolag_member(neighbourhood_id)));

create or replace function project_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (select count(*) from community_projects where author_id = new.author_id and created_at > now() - interval '7 days') >= 3 then
    raise exception 'Du kan starte 3 prosjekter i uka.';
  end if;
  if array_length(new.steps, 1) > 8 then raise exception 'Bruk høyst 8 steg.'; end if;
  new.steps_done := least(greatest(new.steps_done, 0), coalesce(array_length(new.steps, 1), 0));
  return new;
end $$;
drop trigger if exists t_project_guard on community_projects;
create trigger t_project_guard before insert or update on community_projects for each row execute function project_guard();

create table if not exists project_supporters (
  project_id uuid not null references community_projects(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  -- «Vis navnet mitt på forslaget» (only for PROPOSAL, for the PDF to the kommune)
  show_name boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);
alter table project_supporters enable row level security;
revoke all on project_supporters from anon, authenticated;

create or replace function support_project(p_project uuid, p_on boolean, p_show_name boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_n int;
begin
  if not exists (select 1 from community_projects where id = p_project and hidden_at is null and closed_at is null) then
    raise exception 'Fant ikke prosjektet.';
  end if;
  if p_on then
    insert into project_supporters (project_id, profile_id, show_name) values (p_project, v_me, coalesce(p_show_name, false))
      on conflict (project_id, profile_id) do update set show_name = excluded.show_name;
  else
    delete from project_supporters where project_id = p_project and profile_id = v_me;
  end if;
  select count(*) into v_n from project_supporters where project_id = p_project;
  return v_n;
end $$;
revoke all on function support_project(uuid, boolean, boolean) from public, anon;
grant execute on function support_project(uuid, boolean, boolean) to authenticated;

create or replace function project_support_state(p_project uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'count', (select count(*) from project_supporters where project_id = p_project),
    'mine', exists (select 1 from project_supporters where project_id = p_project and profile_id = auth.uid()),
    -- the names only for the author, and only of people who said yes to showing them
    'names', case when exists (select 1 from community_projects where id = p_project and author_id = auth.uid())
                  then coalesce((select json_agg((select display_name from profiles where id = s.profile_id) order by s.created_at)
                                   from project_supporters s where s.project_id = p_project and s.show_name), '[]'::json)
                  else '[]'::json end);
$$;
revoke all on function project_support_state(uuid) from public, anon;
grant execute on function project_support_state(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. «Ukas bilde», community badges
-- ---------------------------------------------------------------------------
create table if not exists area_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  municipality text not null,
  path text not null,
  caption text not null default '' check (char_length(caption) <= 80),
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists area_photo_likes (
  photo_id uuid not null references area_photos(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (photo_id, profile_id)
);
alter table area_photos enable row level security;
alter table area_photo_likes enable row level security;
drop policy if exists p_area_photos_read on area_photos;
create policy p_area_photos_read on area_photos for select to authenticated using (hidden_at is null or profile_id = auth.uid() or is_admin());
drop policy if exists p_area_photos_insert on area_photos;
create policy p_area_photos_insert on area_photos for insert to authenticated with check (profile_id = auth.uid() and hidden_at is null);
drop policy if exists p_area_photos_delete on area_photos;
create policy p_area_photos_delete on area_photos for delete to authenticated using (profile_id = auth.uid() or is_admin());
drop policy if exists p_area_photos_admin on area_photos;
create policy p_area_photos_admin on area_photos for update to authenticated using (is_admin()) with check (is_admin());
revoke all on area_photo_likes from anon, authenticated;

create or replace function area_photo_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from area_photos where profile_id = new.profile_id and created_at > now() - interval '7 days') >= 2 then
    raise exception 'Du kan sende inn 2 bilder i uka.';
  end if;
  return new;
end $$;
drop trigger if exists t_area_photo_guard on area_photos;
create trigger t_area_photo_guard before insert on area_photos for each row execute function area_photo_guard();

create or replace function toggle_area_photo_like(p_photo uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_n int;
begin
  if not exists (select 1 from area_photos where id = p_photo and hidden_at is null) then raise exception 'Fant ikke bildet.'; end if;
  if exists (select 1 from area_photo_likes where photo_id = p_photo and profile_id = v_me) then
    delete from area_photo_likes where photo_id = p_photo and profile_id = v_me;
  else
    insert into area_photo_likes (photo_id, profile_id) values (p_photo, v_me);
  end if;
  select count(*) into v_n from area_photo_likes where photo_id = p_photo;
  return v_n;
end $$;
revoke all on function toggle_area_photo_like(uuid) from public, anon;
grant execute on function toggle_area_photo_like(uuid) to authenticated;

-- This week's photos in a kommune with their likes; the first is «Ukas bilde».
create or replace function area_photos_week(p_municipality text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.likes desc, x."createdAt"), '[]'::json) from (
    select a.id, a.path, a.caption, first_name(a.profile_id) as "by", a.profile_id as "profileId", a.created_at as "createdAt",
           (select count(*) from area_photo_likes l where l.photo_id = a.id)::int as likes,
           exists (select 1 from area_photo_likes l where l.photo_id = a.id and l.profile_id = auth.uid()) as mine
      from area_photos a
     where a.municipality = p_municipality and a.hidden_at is null and a.created_at > now() - interval '7 days') x;
$$;
revoke all on function area_photos_week(text) from public, anon;
grant execute on function area_photos_week(text) to authenticated;

-- Community badges: counted, never stored.
create or replace function community_badges(p_profile uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'lent', (select count(*) from lend_requests r join lend_items i on i.id = r.item_id where i.owner_id = p_profile and r.status::text = 'ACCEPTED'),
    'dugnads', (select count(*) from notice_signups s join noticeboard_posts n on n.id = s.notice_id
                 where s.profile_id = p_profile and n.event_at < now()),
    'arranged', (select count(*) from noticeboard_posts where author_id = p_profile and event_type is not null and event_at < now() and hidden_at is null));
$$;
revoke all on function community_badges(uuid) from public, anon;
grant execute on function community_badges(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Summaries
-- ---------------------------------------------------------------------------
-- «Denne uka i nabolaget» (7 days) and the kommune pulse (this month)
create or replace function community_summary(p_municipality text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'weekJobs', (select count(*) from proposals p join listings l on l.id = p.listing_id
                  where l.municipality = p_municipality
                    and (select max(confirmed_at) from completion_confirmations c where c.agreement_proposal_id = p.id) > now() - interval '7 days'
                    and (select count(*) from completion_confirmations c where c.agreement_proposal_id = p.id) >= 2),
    'weekNotices', (select count(*) from noticeboard_posts where municipality = p_municipality and hidden_at is null
                      and event_type is null and created_at > now() - interval '7 days'),
    'weekEvents', (select count(*) from noticeboard_posts where municipality = p_municipality and hidden_at is null
                     and event_type is not null and created_at > now() - interval '7 days'),
    'monthHelped', (select count(*) from proposals p join listings l on l.id = p.listing_id
                     where l.municipality = p_municipality
                       and (select count(*) from completion_confirmations c where c.agreement_proposal_id = p.id) >= 2
                       and (select max(confirmed_at) from completion_confirmations c where c.agreement_proposal_id = p.id)
                             >= date_trunc('month', now() at time zone 'Europe/Oslo') at time zone 'Europe/Oslo'));
$$;
revoke all on function community_summary(text) from public, anon;
grant execute on function community_summary(text) to authenticated;

-- «Du har lånt ut 3 ting og vært på 2 arrangementer i år»
create or replace function my_community_year() returns json
language sql stable security definer set search_path = public as $$
  with y as (select date_trunc('year', now() at time zone 'Europe/Oslo') at time zone 'Europe/Oslo' as start)
  select json_build_object(
    'lent', (select count(*) from lend_requests r join lend_items i on i.id = r.item_id, y
              where i.owner_id = auth.uid() and r.status::text = 'ACCEPTED' and r.created_at >= y.start),
    'borrowed', (select count(*) from lend_requests r, y where r.borrower_id = auth.uid() and r.status::text = 'ACCEPTED' and r.created_at >= y.start),
    'events', (select count(*) from notice_signups r join noticeboard_posts n on n.id = r.notice_id, y
                where r.profile_id = auth.uid() and r.status = 'GOING' and n.event_at >= y.start and n.event_at < now()),
    'notices', (select count(*) from noticeboard_posts, y where author_id = auth.uid() and created_at >= y.start and event_type is null),
    'given', (select count(*) from noticeboard_posts, y where author_id = auth.uid() and kind = 'GIVEAWAY' and done_at is not null and created_at >= y.start));
$$;
revoke all on function my_community_year() from public, anon;
grant execute on function my_community_year() to authenticated;

-- The Sunday digest (0079) now also counts oppslag and arrangementer: one push a week, not two.
create or replace function weekly_digest() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_sent int := 0; v_title text;
begin
  for r in
    select p.id, p.municipality,
           (select count(*) from listings l
             where l.municipality = p.municipality and l.type::text = 'TASK_REQUEST'
               and l.status::text in ('PUBLISHED', 'RECEIVING_OFFERS') and l.created_at > now() - interval '7 days'
               and l.owner_id <> p.id
               and not exists (select 1 from blocks b where (b.by_profile_id = p.id and b.blocked_profile_id = l.owner_id)
                                                         or (b.by_profile_id = l.owner_id and b.blocked_profile_id = p.id)))::int as jobs,
           (select count(*) from noticeboard_posts n
             where n.municipality = p.municipality and n.hidden_at is null and n.author_id <> p.id
               and n.created_at > now() - interval '7 days'
               and (n.neighbourhood_id is null or exists (select 1 from neighbourhood_members m
                                                          where m.neighbourhood_id = n.neighbourhood_id and m.profile_id = p.id)))::int as board
      from profiles p
     where p.municipality is not null and p.deleted_at is null and p.suspended_at is null
       and not exists (select 1 from notifications n
                        where n.profile_id = p.id and n.kind::text = 'NEW_MATCH' and n.created_at > now() - interval '6 days')
  loop
    if r.jobs < 2 and r.board < 2 then continue; end if;
    v_title := case
      when r.jobs >= 2 and r.board >= 2 then 'Nytt i ' || r.municipality || ' denne uka: ' || r.jobs || ' oppdrag og ' || r.board || ' oppslag'
      when r.jobs >= 2 then r.jobs || ' nye oppdrag i ' || r.municipality || ' denne uka'
      else 'Nytt i nabolaget denne uka: ' || r.board || ' oppslag' end;
    insert into notifications (profile_id, kind, title, body, route)
      values (r.id, case when r.jobs >= 2 then 'NEW_MATCH' else 'NABOLAG_POST' end::text::notification_kind,
              v_title, 'Se hva som skjer der du bor.', case when r.jobs >= 2 then '/' else '/fellesskap' end);
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end $$;
revoke all on function weekly_digest() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedules
-- ---------------------------------------------------------------------------
do $$ begin
  begin perform cron.unschedule('minnabo-expired-notices'); exception when others then null; end;
  perform cron.schedule('minnabo-expired-notices', '*/15 * * * *', 'select public.close_expired_notices()');
exception when others then
  raise notice 'pg_cron not available – schedule close_expired_notices() by hand';
end $$;
