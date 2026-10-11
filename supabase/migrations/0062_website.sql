-- =====================================================================================
-- 0062_website.sql — follow-up to 0054 for the MinNabo website (minnabo-web repo)
--
--  * Requires 0054_website.sql (checked against the live schema at app migration 0061). Source of truth: minnabo-web supabase/sql/0002_website.sql (identical file),
--    loaded by the website's local/test database builder.
--  * Additive only: new table news_views, new column listings.pending_review, new functions + three triggers
--    (reports_auto_moderate, reports_auto_restore, listings_first_review). No app table, column or policy is dropped
--    or renamed. guard_listing_hidden (already re-created by 0054) also keeps pending_review.
--  * Idempotent (safe to run twice).
--  * Apply BEFORE deploying the website version that logs news views (it writes to public.news_views).
-- =====================================================================================


-- =====================================================================================
-- 1. News views (decided 2026-10-10): one row per read, so «Lesninger 30 d» in Admin › Nyheter is exact.
--    The website inserts rows server-side (source 'web'). The app calls log_news_view() when an article
--    from news_public is opened (source 'app'). `viewer` is an md5 hash (session or user id), never the
--    id itself, and only serves to count a reader once per 30 minutes. news_articles.views stays the
--    all-time counter and is bumped by the same calls.
-- =====================================================================================
create table if not exists public.news_views (
  id          bigint generated always as identity primary key,
  article_id  uuid not null references public.news_articles(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  source      text not null check (source in ('web','app')),
  viewer      text
);
create index if not exists news_views_article_idx on public.news_views(article_id, viewed_at desc);
create index if not exists news_views_at_idx on public.news_views(viewed_at desc);
alter table public.news_views enable row level security;
-- no policies: the app writes only through log_news_view(); the website connects server-side.
revoke all on public.news_views from anon, authenticated;

create or replace function public.log_news_view(p_article uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_viewer text := md5(coalesce(auth.uid()::text, ''));
begin
  if auth.uid() is null then return; end if;
  if not exists (select 1 from news_articles where id = p_article and status = 'published' and show_in_app) then
    return;
  end if;
  if exists (select 1 from news_views where article_id = p_article and viewer = v_viewer
               and viewed_at > now() - interval '30 minutes') then
    return;
  end if;
  insert into news_views(article_id, source, viewer) values (p_article, 'app', v_viewer);
  update news_articles set views = views + 1 where id = p_article;
end $$;
revoke all on function public.log_news_view(uuid) from public, anon;
grant execute on function public.log_news_view(uuid) to authenticated;


-- =====================================================================================
-- 2. Automatic moderation (Innstillinger › Moderering, decided 2026-10-10). Reports are made in the app only;
--    these run in the database so app and website behave the same.
--    * moderation.auto_hide_threshold (3): an oppdrag with OPEN reports from that many different users is hidden.
--    * moderation.auto_suspend_threshold (5): a user whose profile + content (oppdrag, tilbud, meldinger, vurderinger,
--      oppslag, kommentarer) has OPEN reports from that many different users is suspended until a moderator has
--      looked at it (no end date). Admin profiles are never auto-suspended.
--    * A moderator dismissing the reports undoes it: when no OPEN report is left, an auto-hidden oppdrag is shown
--      again and an auto-suspension is lifted (reports_auto_restore). «Fjern»/«Advar» leave it to the moderator.
--    * moderation.review_first_listing (off until the app shows «Venter på godkjenning»): a user's first oppdrag
--      starts hidden with listings.pending_review = true; the website's Verifisering approves or rejects it.
--    Every automatic action is written to admin_audit_log with actor 'system'.
-- =====================================================================================
insert into public.app_settings(key, value) values
  ('moderation.auto_suspend_threshold', '5'),
  ('moderation.fraud_alert',            'true'),
  ('moderation.review_first_listing',   'false')
on conflict (key) do nothing;

alter table public.listings add column if not exists pending_review boolean not null default false;
create index if not exists listings_pending_review_idx on public.listings(created_at) where pending_review;

create or replace function public.setting_bool(p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = p_key), p_default)
$$;
revoke all on function public.setting_bool(text, boolean) from public, anon, authenticated;

-- report_target_owner(type, id) is the app's own function (who wrote the reported thing).

create or replace function public.reports_auto_moderate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_hide  int := setting_int('moderation.auto_hide_threshold', 3);
  v_susp  int := setting_int('moderation.auto_suspend_threshold', 5);
  v_n     int;
  v_owner uuid;
  v_title text;
begin
  if new.status <> 'OPEN' then return new; end if;

  if new.target_type = 'LISTING' and v_hide > 0
     and exists (select 1 from listings where id::text = new.target_id and not admin_hidden) then
    select count(distinct by_profile_id) into v_n from reports
     where target_type = 'LISTING' and target_id = new.target_id and status = 'OPEN';
    if v_n >= v_hide then
      update listings set admin_hidden = true, hidden_at = now(), hidden_by = 'system',
             hidden_reason = 'Skjult automatisk etter rapporter fra ' || v_n || ' brukere. En moderator ser på saken.'
       where id::text = new.target_id returning owner_id, title into v_owner, v_title;
      perform notify_moderation(v_owner, 'Oppdraget ditt er skjult midlertidig',
        '«' || v_title || '» er rapportert av flere brukere og vises ikke for andre mens en moderator ser på saken.', '/mine');
      insert into admin_audit_log(actor_email, actor_role, action, target_type, target_id, after)
      values ('system', 'system', 'listing.auto_hide', 'listing', new.target_id,
              jsonb_build_object('reports', v_n, 'threshold', v_hide, 'report_id', new.id));
    end if;
  end if;

  v_owner := report_target_owner(new.target_type, new.target_id);
  if v_owner is not null and v_susp > 0
     and exists (select 1 from profiles where id = v_owner and suspended_at is null and role <> 'admin') then
    select count(distinct r.by_profile_id) into v_n from reports r
     where r.status = 'OPEN' and r.by_profile_id <> v_owner
       and report_target_owner(r.target_type, r.target_id) = v_owner;
    if v_n >= v_susp then
      perform moderation_set_suspended(v_owner, true, null,
        'Midlertidig suspendert etter rapporter fra ' || v_n || ' brukere. En moderator ser på saken.', 'system');
      insert into admin_audit_log(actor_email, actor_role, action, target_type, target_id, after)
      values ('system', 'system', 'user.auto_suspend', 'profile', v_owner::text,
              jsonb_build_object('reports', v_n, 'threshold', v_susp, 'report_id', new.id));
    end if;
  end if;
  return new;
end $$;
revoke all on function public.reports_auto_moderate() from public, anon, authenticated;
drop trigger if exists reports_auto_moderate on public.reports;
create trigger reports_auto_moderate after insert on public.reports
  for each row execute function public.reports_auto_moderate();

create or replace function public.listings_first_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'TASK_REQUEST' and setting_bool('moderation.review_first_listing', false)
     and not exists (select 1 from listings where owner_id = new.owner_id and type = 'TASK_REQUEST') then
    new.pending_review := true;
    new.admin_hidden   := true;
    new.hidden_reason  := 'Venter på godkjenning';
    new.hidden_at      := now();
    new.hidden_by      := 'system';
  end if;
  return new;
end $$;
revoke all on function public.listings_first_review() from public, anon, authenticated;
drop trigger if exists listings_first_review on public.listings;
create trigger listings_first_review before insert on public.listings
  for each row execute function public.listings_first_review();

-- The owner's own edits must not clear the review hold (same guard as 0054, plus pending_review).
create or replace function public.guard_listing_hidden() returns trigger
language plpgsql as $$
begin
  if not is_admin() and current_user = 'authenticated' then
    new.admin_hidden   := old.admin_hidden;
    new.hidden_reason  := old.hidden_reason;
    new.hidden_at      := old.hidden_at;
    new.hidden_by      := old.hidden_by;
    new.pending_review := old.pending_review;
  end if;
  return new;
end $$;

create or replace function public.reports_auto_restore() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text;
begin
  if new.target_type = 'LISTING'
     and not exists (select 1 from reports where target_type = 'LISTING' and target_id = new.target_id and status = 'OPEN') then
    update listings set admin_hidden = false, hidden_reason = null, hidden_at = null, hidden_by = null
     where id::text = new.target_id and admin_hidden and hidden_by = 'system' and not pending_review
    returning owner_id, title into v_owner, v_title;
    if v_owner is not null then
      perform notify_moderation(v_owner, 'Oppdraget ditt er synlig igjen', '«' || v_title || '» vises for andre igjen.', '/mine');
      insert into admin_audit_log(actor_email, actor_role, action, target_type, target_id, after)
      values ('system', 'system', 'listing.auto_restore', 'listing', new.target_id, jsonb_build_object('report_id', new.id));
    end if;
  end if;
  v_owner := report_target_owner(new.target_type, new.target_id);
  if v_owner is not null
     and exists (select 1 from profiles p join profile_moderation m on m.profile_id = p.id
                  where p.id = v_owner and p.suspended_at is not null and m.updated_by = 'system'
                    and m.suspended_until is null and m.suspension_reason like 'Midlertidig suspendert etter rapporter%')
     and not exists (select 1 from reports r where r.status = 'OPEN' and report_target_owner(r.target_type, r.target_id) = v_owner) then
    perform moderation_set_suspended(v_owner, false, null, null, 'system');
    insert into admin_audit_log(actor_email, actor_role, action, target_type, target_id, after)
    values ('system', 'system', 'user.auto_unsuspend', 'profile', v_owner::text, jsonb_build_object('report_id', new.id));
  end if;
  return new;
end $$;
revoke all on function public.reports_auto_restore() from public, anon, authenticated;
drop trigger if exists reports_auto_restore on public.reports;
create trigger reports_auto_restore after update of status on public.reports
  for each row when (old.status = 'OPEN' and new.status = 'RESOLVED' and new.outcome = 'dismiss')
  execute function public.reports_auto_restore();
