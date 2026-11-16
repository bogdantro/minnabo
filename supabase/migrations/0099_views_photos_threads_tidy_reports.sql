-- 0099_views_photos_threads_tidy_reports.sql
--  Asked 2026-11-09:
--    1. «14 naboer har sett oppdraget»: who has opened a listing, counted once per person, shown only to its owner.
--    2. Several photos per oppslag (image_paths). image_path keeps the first one, so older apps still show a photo.
--    3. Reply to a reply under an oppslag: notice_comments.parent_id, one level deep.
--    4. Oppslag that tidy themselves up: «Gis bort» and «Mistet og funnet» ask the owner after 14 days whether they
--       are still current; without an answer in 7 days the oppslag is closed (never deleted, and it can be reopened).
--    5. Photos in reviews (image_paths), shown together with the review.
--    6. «Rist for å melde fra om en feil»: a problem report with a screenshot lands in the person's MinNabo thread,
--       where the website's Admin › Chats reads it.

-- ---------------------------------------------------------------------------
-- 1. Views
-- ---------------------------------------------------------------------------
create table if not exists listing_views (
  listing_id uuid not null references listings(id) on delete cascade,
  viewer_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, viewer_id)
);
alter table listing_views enable row level security;
-- no policies: only the two functions below touch it
revoke all on listing_views from anon, authenticated;

create or replace function record_listing_view(p_listing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then return; end if;
  insert into listing_views (listing_id, viewer_id)
    select l.id, v_me from listings l where l.id = p_listing and l.owner_id <> v_me
  on conflict do nothing;
end $$;
revoke all on function record_listing_view(uuid) from public, anon;
grant execute on function record_listing_view(uuid) to authenticated;

-- How many neighbours have opened my listing. Null for anyone but the owner.
create or replace function listing_view_count(p_listing uuid) returns integer
language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from listings where id = p_listing and owner_id = auth.uid())
              then (select count(*)::int from listing_views where listing_id = p_listing) end;
$$;
revoke all on function listing_view_count(uuid) from public, anon;
grant execute on function listing_view_count(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Several photos per oppslag
-- ---------------------------------------------------------------------------
alter table noticeboard_posts add column if not exists image_paths text[] not null default '{}';
update noticeboard_posts set image_paths = array[image_path] where image_path is not null and image_paths = '{}';
alter table noticeboard_posts drop constraint if exists noticeboard_posts_image_paths_max;
alter table noticeboard_posts add constraint noticeboard_posts_image_paths_max check (cardinality(image_paths) <= 6);

-- the first photo stays in image_path for older apps, whichever column a client writes
create or replace function notice_images_sync() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.image_paths is not distinct from old.image_paths
     and new.image_path is distinct from old.image_path then
    new.image_paths := case when new.image_path is null then '{}' else array[new.image_path] end;
  elsif tg_op = 'INSERT' and new.image_paths = '{}' and new.image_path is not null then
    new.image_paths := array[new.image_path];
  end if;
  new.image_path := new.image_paths[1];
  return new;
end $$;
drop trigger if exists t_notice_images_sync on noticeboard_posts;
create trigger t_notice_images_sync before insert or update of image_path, image_paths on noticeboard_posts
  for each row execute function notice_images_sync();

-- ---------------------------------------------------------------------------
-- 3. Reply to a reply
-- ---------------------------------------------------------------------------
alter table notice_comments add column if not exists parent_id uuid references notice_comments(id) on delete cascade;
create index if not exists notice_comments_parent_idx on notice_comments (parent_id);

-- one level deep, and only under the same oppslag
create or replace function notice_comment_thread_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_parent notice_comments;
begin
  if new.parent_id is null then return new; end if;
  select * into v_parent from notice_comments where id = new.parent_id;
  if not found or v_parent.notice_id <> new.notice_id then raise exception 'Fant ikke svaret du svarer på.'; end if;
  if v_parent.parent_id is not null then new.parent_id := v_parent.parent_id; end if;
  return new;
end $$;
drop trigger if exists t_notice_comment_thread_guard on notice_comments;
create trigger t_notice_comment_thread_guard before insert on notice_comments
  for each row execute function notice_comment_thread_guard();

-- ---------------------------------------------------------------------------
-- 4. Oppslag that tidy themselves up
-- ---------------------------------------------------------------------------
alter table noticeboard_posts add column if not exists kept_at timestamptz;
alter table noticeboard_posts add column if not exists still_asked_at timestamptz;
alter table noticeboard_posts add column if not exists auto_closed boolean not null default false;

-- «Ja, det er fortsatt aktuelt»: asked again 14 days later
create or replace function keep_notice(p_notice uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update noticeboard_posts set kept_at = now(), still_asked_at = null, auto_closed = false, done_at = null
   where id = p_notice and author_id = auth.uid();
  if not found then raise exception 'Fant ikke oppslaget.'; end if;
end $$;
revoke all on function keep_notice(uuid) from public, anon;
grant execute on function keep_notice(uuid) to authenticated;

create or replace function tidy_old_notices() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; r record;
begin
  -- ask
  for r in select id, author_id, title from noticeboard_posts
            where kind::text in ('GIVEAWAY', 'LOST_FOUND') and done_at is null and hidden_at is null
              and still_asked_at is null and greatest(created_at, coalesce(kept_at, created_at)) < now() - interval '14 days'
  loop
    update noticeboard_posts set still_asked_at = now() where id = r.id;
    perform notify(r.author_id, 'NOTICE_REPLY', 'Er oppslaget fortsatt aktuelt?',
      '«' || r.title || '». Svar innen 7 dager, ellers avslutter vi det for deg.', '/oppslagstavle?oppslag=' || r.id);
    v_n := v_n + 1;
  end loop;
  -- close
  for r in select id, author_id, title from noticeboard_posts
            where done_at is null and still_asked_at is not null and still_asked_at < now() - interval '7 days'
  loop
    update noticeboard_posts set done_at = now(), auto_closed = true where id = r.id;
    perform notify(r.author_id, 'NOTICE_REPLY', 'Oppslaget er avsluttet',
      '«' || r.title || '» er avsluttet. Du kan åpne det igjen når du vil.', '/oppslagstavle?oppslag=' || r.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function tidy_old_notices() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('minnabo-tidy-notices', '15 9 * * *', 'select public.tidy_old_notices()');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Photos in reviews
-- ---------------------------------------------------------------------------
alter table reviews add column if not exists image_paths text[] not null default '{}';
alter table reviews drop constraint if exists reviews_image_paths_max;
alter table reviews add constraint reviews_image_paths_max check (cardinality(image_paths) <= 4);

drop function if exists submit_review(uuid, integer, text, text[], boolean);
create or replace function submit_review(p_agreement_proposal_id uuid, p_rating integer, p_comment text,
                                         p_tags text[] default '{}', p_recommends boolean default null,
                                         p_image_paths text[] default '{}')
returns reviews language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_to uuid; v_done int; v_row reviews; v_path text;
begin
  select * into p from proposals where id = p_agreement_proposal_id;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me is null or v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Ikke tilgang.'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Velg mellom 1 og 5 stjerner.'; end if;

  select count(*) into v_done from completion_confirmations
   where agreement_proposal_id = p_agreement_proposal_id;
  if v_done < 2 then raise exception 'Oppdraget er ikke fullført ennå.'; end if;

  if exists (select 1 from reviews
              where agreement_proposal_id = p_agreement_proposal_id and from_profile_id = v_me) then
    raise exception 'Du har allerede vurdert denne avtalen.';
  end if;
  if cardinality(coalesce(p_image_paths, '{}')) > 4 then raise exception 'Du kan legge ved høyst 4 bilder.'; end if;
  -- only photos from your own folder
  foreach v_path in array coalesce(p_image_paths, '{}') loop
    if v_path not like v_me::text || '/%' then raise exception 'Ugyldig bilde.'; end if;
  end loop;

  v_to := case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end;
  insert into reviews (agreement_proposal_id, listing_id, from_profile_id, to_profile_id, rating, comment, tags, recommends, image_paths)
  values (p_agreement_proposal_id, p.listing_id, v_me, v_to, p_rating, nullif(p_comment, ''), coalesce(p_tags, '{}'),
          p_recommends, coalesce(p_image_paths, '{}'))
  returning * into v_row;

  update listings set status = 'REVIEWED' where id = p.listing_id and status = 'COMPLETED';
  return v_row;
end $$;
revoke all on function submit_review(uuid, integer, text, text[], boolean, text[]) from public, anon;
grant execute on function submit_review(uuid, integer, text, text[], boolean, text[]) to authenticated;

create or replace view visible_reviews as
  select r.id, r.agreement_proposal_id, r.listing_id, r.from_profile_id, r.to_profile_id,
         r.rating, r.comment, r.created_at, r.tags, r.reply, r.replied_at, r.recommends, r.image_paths
    from reviews r
   where r.approval = 'APPROVED'
     and (now() - r.created_at > interval '10 days'
          or exists (select 1 from reviews x
                      where x.agreement_proposal_id = r.agreement_proposal_id
                        and x.from_profile_id = r.to_profile_id));
revoke all on visible_reviews from anon, public;
revoke insert, update, delete, truncate on visible_reviews from authenticated;
grant select on visible_reviews to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Problem reports with a screenshot
-- ---------------------------------------------------------------------------
alter table minnabo_messages add column if not exists image_path text;
alter table minnabo_messages add column if not exists is_problem_report boolean not null default false;

create or replace function minnabo_report_problem(p_body text, p_image_path text default null, p_context text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_id uuid; v_body text := btrim(coalesce(p_body, ''));
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  if exists (select 1 from profiles where id = v_me and deleted_at is not null) then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if char_length(v_body) < 3 then raise exception 'Skriv litt om hva som skjedde.'; end if;
  if char_length(v_body) > 1500 then raise exception 'Meldingen kan ha høyst 1500 tegn.'; end if;
  if p_image_path is not null and p_image_path not like v_me::text || '/%' then raise exception 'Ugyldig bilde.'; end if;
  if (select count(*) from minnabo_messages
       where profile_id = v_me and is_problem_report and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Du har meldt fra mange ganger i dag. Takk! Prøv igjen i morgen.';
  end if;
  insert into minnabo_messages (profile_id, from_admin, body, image_path, is_problem_report)
    values (v_me, false,
            'Feilmelding fra appen' || case when p_context is not null then ' (' || left(p_context, 120) || ')' else '' end
              || E'\n' || v_body,
            p_image_path, true)
    returning id into v_id;
  return v_id;
end $$;
revoke all on function minnabo_report_problem(text, text, text) from public, anon;
grant execute on function minnabo_report_problem(text, text, text) to authenticated;
