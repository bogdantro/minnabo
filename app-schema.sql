-- =============================================================================
-- MinNabo – complete Supabase database schema (reference)
-- =============================================================================
--
-- What this is
--   The state of the database after every migration in supabase/migrations
--   (0001_schema.sql … 0055_jobs_and_reviews.sql) has run, in one file.
--   It was produced by replaying all 55 migrations, in order, on a scratch
--   Postgres and dumping the result (pg_dump --schema-only --schema=public),
--   then adding the parts that live outside `public` (auth trigger, storage
--   buckets + policies, realtime publication, pg_cron job) and the category
--   seed rows. Every table, view and RPC that the app code calls (src/, app/,
--   supabase/functions/) exists below; the code uses exactly these 4 buckets.
--
-- What this is NOT
--   Not a migration. Do not run it against the live project – change the
--   database with a new file in supabase/migrations instead, then regenerate
--   this file. supabase/migrations stays the source of truth.
--
-- Live project status (from docs/LEFT_OUT.md, A14, checked 2026-10-06)
--   0001–0046 are applied to the hosted project; 0047–0055 still have to be
--   pushed. This file already includes them. 0054_website.sql comes from the
--   website repo (minnabo-web) and adds the website's tables (schema `web`
--   is not dumped here – only `public`).
--
-- Supabase-managed parts this schema relies on (not defined here)
--   * schemas auth, storage, extensions, net, cron, realtime
--   * roles anon, authenticated, service_role
--   * auth.uid(), auth.users, auth.sessions, auth.refresh_tokens
--   * storage.buckets, storage.objects, storage.foldername()
--   * extensions: pgcrypto (0001), pg_net (0039, push via net.http_post),
--     pg_cron (0053, agreement reminders)
--   * app_secrets rows 'functions_url' and 'push_secret' (set by hand, see 0039)
--
-- Legacy kept in the schema
--   The app now has only one listing type (oppdrag = TASK_REQUEST), but the
--   schema still has listing_type 'SERVICE_OFFER' and the table
--   service_offer_details (from 0001/0017). No migration has removed them and
--   some code still references them, so they are listed as they are.
--
-- Contents
--   1. Extensions
--   2. public schema: 13 enums, 63 tables, 6 views, 138 functions,
--      62 triggers, 34 indexes (plus primary/unique keys),
--      foreign keys, row level security + 67 policies, grants
--   3. Trigger on auth.users
--   4. Storage buckets and storage.objects policies
--   5. Realtime publication
--   6. Scheduled jobs (pg_cron)
--   7. Seed data: categories
--
-- Enums (13):
--   business_status, listing_status, listing_type, message_kind, notice_kind, notification_kind,
--   price_mode, proposal_status, purpose, report_status, report_target, task_recurrence,
--   verification_kind
--
-- Tables (63):
--   account_deletions, admin_audit_log, agreement_reminders, agreement_snapshots,
--   agreement_time_proposals, app_secrets, app_settings, banned_words, blocks, business_profiles,
--   categories, clubs, completion_confirmations, consent_records, contact_messages,
--   conversation_participants, conversations, donation_records, follows, guardian_links,
--   job_workspaces, kommune_waitlist, kommuner, listing_images, listing_private, listings,
--   message_reads, messages, neighbourhood_members, neighbourhoods, news_articles,
--   newsletter_subscribers, no_show_reports, notice_comments, noticeboard_posts, notifications,
--   partner_accounts, partner_events, partner_invoices, partner_placements,
--   partner_profile_changes, partner_reminders, partners, portfolio_items, profile_moderation,
--   profile_private, profile_settings, profiles, proposal_revisions, proposals, push_tokens,
--   reports, reviews, safe_trips, saved_listings, saved_notices, saved_searches,
--   service_offer_details, skill_endorsements, stripe_events, task_details, trusted_contacts,
--   verifications
--
-- Views (6):
--   news_public, partners_public, profile_ratings, public_listings, shared_contacts,
--   visible_reviews
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- -----------------------------------------------------------------------------
-- 2. public schema
-- -----------------------------------------------------------------------------
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: business_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.business_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: listing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.listing_status AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'RECEIVING_OFFERS',
    'OFFER_ACCEPTED',
    'AGREED',
    'IN_PROGRESS',
    'COMPLETION_SENT',
    'COMPLETED',
    'REVIEWED',
    'CANCELLED',
    'EXPIRED',
    'REMOVED',
    'ACTIVE',
    'PAUSED',
    'ARCHIVED'
);


--
-- Name: listing_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.listing_type AS ENUM (
    'TASK_REQUEST',
    'SERVICE_OFFER'
);


--
-- Name: message_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_kind AS ENUM (
    'TEXT',
    'PROPOSAL',
    'SYSTEM',
    'IMAGE'
);


--
-- Name: notice_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notice_kind AS ENUM (
    'GIVEAWAY',
    'LOST_FOUND',
    'TOOL_LEND',
    'GENERAL'
);


--
-- Name: notification_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_kind AS ENUM (
    'NEW_MESSAGE',
    'NEW_OFFER',
    'OFFER_CHANGED',
    'OFFER_WITHDRAWN',
    'OFFER_ACCEPTED',
    'OFFER_DECLINED',
    'AGREED_TIME',
    'COMPLETION_REQUESTED',
    'REVIEW_RECEIVED',
    'MODERATION',
    'AGREEMENT_CANCELLED',
    'NEW_MATCH',
    'NOTICE_REPLY'
);


--
-- Name: price_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.price_mode AS ENUM (
    'FIXED',
    'BUDGET',
    'FROM',
    'BY_AGREEMENT'
);


--
-- Name: proposal_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.proposal_status AS ENUM (
    'DRAFT',
    'SENT',
    'WITHDRAWN',
    'DECLINED',
    'ACCEPTED',
    'REVISION_PENDING',
    'CANCELLED'
);


--
-- Name: purpose; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.purpose AS ENUM (
    'NEED_HELP',
    'WANT_JOBS',
    'BOTH'
);


--
-- Name: report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.report_status AS ENUM (
    'OPEN',
    'RESOLVED'
);


--
-- Name: report_target; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.report_target AS ENUM (
    'USER',
    'LISTING',
    'PROPOSAL',
    'MESSAGE',
    'REVIEW',
    'NOTICE',
    'COMMENT'
);


--
-- Name: task_recurrence; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_recurrence AS ENUM (
    'WEEKLY',
    'BIWEEKLY',
    'MONTHLY'
);


--
-- Name: verification_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.verification_kind AS ENUM (
    'PHONE',
    'EMAIL',
    'BUSINESS'
);


--
-- Name: admin_businesses(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_businesses() RETURNS TABLE(profile_id uuid, org_nr text, company_name text, contact_person text, email text, phone text, category_slugs text[], status text, created_at timestamp with time zone, decided_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  return query
    select b.profile_id, b.org_nr, b.company_name, b.contact_person, b.email, b.phone,
           b.category_slugs, b.status::text, b.created_at, b.decided_at
      from business_profiles b
     where b.status = 'PENDING' or b.decided_at > now() - interval '30 days'
     order by b.created_at;
end $$;


--
-- Name: admin_decide_business(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_decide_business(p_profile_id uuid, p_approve boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  perform moderation_decide_business(p_profile_id, p_approve);
end $$;


--
-- Name: admin_decide_report(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_decide_report(p_report_id uuid, p_outcome text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  perform moderation_decide_report(p_report_id, p_outcome, auth.uid());
end $$;


--
-- Name: admin_flagged_listings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_flagged_listings() RETURNS TABLE(id uuid, title text, category_slug text, report_count integer, last_reason text, hidden boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  return query
    select l.id, l.title, l.category_slug, count(r.id)::int,
           (select r2.reason from reports r2 where r2.target_type = 'LISTING' and r2.target_id = l.id::text
             order by r2.created_at desc limit 1),
           l.admin_hidden
      from listings l
      join reports r on r.target_type = 'LISTING' and r.target_id = l.id::text
     group by l.id
     order by max(r.created_at) desc
     limit 100;
end $$;


--
-- Name: admin_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_guard() RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception 'Kun administratorer.' using errcode = '42501'; end if;
end $$;


--
-- Name: admin_overview(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_overview() RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  return json_build_object(
    'open_reports', (select count(*) from reports where status = 'OPEN'),
    'pending_businesses', (select count(*) from business_profiles where status = 'PENDING'),
    'new_users_today', (select count(*) from profiles
        where deleted_at is null and created_at >= date_trunc('day', now() at time zone 'Europe/Oslo') at time zone 'Europe/Oslo'),
    'active_listings', (select count(*) from listings
        where not admin_hidden and status in ('PUBLISHED','RECEIVING_OFFERS','ACTIVE'))
  );
end $$;


--
-- Name: admin_partners(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_partners() RETURNS TABLE(id uuid, name text, blurb text, municipality text, main boolean, active boolean, hero boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  return query
    select p.id, p.name, p.blurb, p.municipality,
           exists (select 1 from partner_placements pp
                    where pp.partner_id = p.id and pp.surface = 'fellesskap' and pp.active),
           p.active,
           p.local_hero
      from partners p order by p.name;
end $$;


--
-- Name: admin_reopen_report(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_reopen_report(p_report_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  perform moderation_reopen_report(p_report_id);
end $$;


--
-- Name: admin_report_attachments(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_report_attachments() RETURNS TABLE(report_id uuid, path text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  return query select r.id, r.attachment_path from reports r where r.attachment_path is not null;
end $$;


--
-- Name: admin_reports(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_reports() RETURNS TABLE(id uuid, target_type text, target_id text, reason text, details text, target_text text, by_name text, created_at timestamp with time zone, status text, outcome text, resolved_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  return query
    select r.id, r.target_type::text, r.target_id, r.reason, r.details,
           report_target_text(r.target_type, r.target_id),
           coalesce(p.display_name, 'Slettet bruker'), r.created_at, r.status::text, r.outcome, r.resolved_at
      from reports r left join profiles p on p.id = r.by_profile_id
     where r.status = 'OPEN' or r.resolved_at > now() - interval '14 days'
     order by r.created_at desc
     limit 200;
end $$;


--
-- Name: admin_set_listing_hidden(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_listing_hidden(p_listing_id uuid, p_hidden boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  perform moderation_set_listing_hidden(p_listing_id, p_hidden);
end $$;


--
-- Name: admin_set_main_partner(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_main_partner(p_partner_id uuid, p_main boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  if p_main then
    perform pg_advisory_xact_lock(hashtext('minnabo.hovedpartner_slots'));
    if hovedpartner_taken(p_partner_id) >= setting_int('partners.max_hovedpartnere', 4) then
      raise exception 'Maks % hovedpartnere.', setting_int('partners.max_hovedpartnere', 4);
    end if;
    update partner_placements set active = true where partner_id = p_partner_id and surface = 'fellesskap';
    if not found then
      insert into partner_placements (partner_id, surface, headline, active)
        values (p_partner_id, 'fellesskap', 'Hovedpartner', true);
    end if;
    -- a hovedpartner is not also a lokal helt
    update partners set active = true, local_hero = false where id = p_partner_id;
  else
    update partner_placements set active = false where partner_id = p_partner_id and surface = 'fellesskap';
  end if;
end $$;


--
-- Name: admin_set_partner_active(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_partner_active(p_partner_id uuid, p_active boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  update partners set active = p_active where id = p_partner_id;
end $$;


--
-- Name: admin_set_partner_hero(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_partner_hero(p_partner_id uuid, p_hero boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  update partners set local_hero = p_hero, active = active or p_hero where id = p_partner_id;
end $$;


--
-- Name: admin_set_suspended(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_suspended(p_profile_id uuid, p_suspended boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_guard();
  if p_profile_id = auth.uid() then raise exception 'Du kan ikke suspendere deg selv.'; end if;
  perform moderation_set_suspended(p_profile_id, p_suspended);
end $$;


--
-- Name: admin_users(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_users(p_q text DEFAULT ''::text) RETURNS TABLE(id uuid, display_name text, initials text, avatar_path text, place text, municipality text, member_since text, rating numeric, rating_count integer, suspended boolean, role text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_q text := '%' || lower(trim(coalesce(p_q, ''))) || '%';
begin
  perform admin_guard();
  return query
    select p.id, p.display_name, p.initials, p.avatar_path, p.place, p.municipality,
           p.member_since, pr.average, coalesce(pr.count, 0), p.suspended_at is not null, p.role
      from profiles p left join profile_ratings pr on pr.profile_id = p.id
     where p.deleted_at is null
       and lower(p.display_name || ' ' || coalesce(p.place, '') || ' ' || coalesce(p.municipality, '')) like v_q
     order by p.suspended_at desc nulls last, p.created_at desc
     limit 100;
end $$;


--
-- Name: admin_waitlist(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_waitlist() RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_admin() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  return coalesce((select json_agg(json_build_object('kommune', kommune, 'count', n) order by n desc, kommune)
                     from (select kommune, count(*) as n from kommune_waitlist group by kommune) x), '[]'::json);
end $$;


--
-- Name: admin_week_stats(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_week_stats(p_day date DEFAULT NULL::date) RETURNS TABLE(stat_day date, n_listings integer, n_offers integer, n_completed integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_mon date := date_trunc('week', coalesce(p_day, (now() at time zone 'Europe/Oslo')::date))::date;
begin
  perform admin_guard();
  return query
    select d::date,
      (select count(*)::int from listings l
        where l.type = 'TASK_REQUEST' and l.status <> 'DRAFT'
          and (l.created_at at time zone 'Europe/Oslo')::date = d::date),
      (select count(*)::int from proposals p
        where p.status <> 'DRAFT' and (p.created_at at time zone 'Europe/Oslo')::date = d::date),
      (select count(*)::int from (
          select c.agreement_proposal_id, max(c.confirmed_at) as at
            from completion_confirmations c group by c.agreement_proposal_id having count(*) >= 2
        ) done where (done.at at time zone 'Europe/Oslo')::date = d::date)
    from generate_series(v_mon, v_mon + 6, interval '1 day') d
    order by 1;
end $$;


--
-- Name: agreement_cancelled_by(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agreement_cancelled_by() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.cancelled_at is not null and old.cancelled_at is null then
    new.cancelled_by := auth.uid();
  end if;
  return new;
end $$;


--
-- Name: agreement_copy_schedule(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agreement_copy_schedule() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  select p.scheduled_at, p.duration_text into new.scheduled_at, new.duration_text
    from proposals p where p.id = new.proposal_id;
  return new;
end $$;


--
-- Name: badge_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.badge_count(p_profile uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select (
    (select count(*) from notifications n where n.profile_id = p_profile and not n.read)
    +
    (select count(*) from conversation_participants cp
      where cp.profile_id = p_profile
        and exists (select 1 from messages m
                     where m.conversation_id = cp.conversation_id
                       and m.author_id <> p_profile and m.kind <> 'SYSTEM'
                       and m.created_at > coalesce(cp.last_read_at, 'epoch'::timestamptz)))
  )::int;
$$;


--
-- Name: block_banned_words(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_banned_words() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_row jsonb := to_jsonb(new);
begin
  -- tg_argv starts at 0
  for i in 0 .. tg_nargs - 1 loop
    if has_banned_word(v_row ->> tg_argv[i]) then
      raise exception 'Teksten inneholder ord som ikke er tillatt på MinNabo.';
    end if;
  end loop;
  return new;
end $$;


--
-- Name: block_suspended_writes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_suspended_writes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and exists (
    select 1 from profiles where id = auth.uid() and suspended_at is not null
  ) then
    raise exception 'Kontoen din er suspendert. Kontakt MinNabo.' using errcode = '42501';
  end if;
  return new;
end $$;


--
-- Name: block_youth_listing_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_youth_listing_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and new.owner_id = auth.uid() and is_youth(auth.uid()) then
    raise exception 'Dette er ikke tilgjengelig for ungdomskontoer.' using errcode = '42501';
  end if;
  return new;
end $$;


--
-- Name: block_youth_writes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_youth_writes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and is_youth(auth.uid()) then
    raise exception 'Dette er ikke tilgjengelig for ungdomskontoer.' using errcode = '42501';
  end if;
  return new;
end $$;


--
-- Name: bump_completed_counter(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_completed_counter() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_from uuid; v_to uuid;
begin
  -- exactly when the second party confirms (both have confirmed now)
  if (select count(*) from completion_confirmations
       where agreement_proposal_id = new.agreement_proposal_id) <> 2 then
    return new;
  end if;
  select from_profile_id, to_profile_id into v_from, v_to
    from proposals where id = new.agreement_proposal_id;
  update profiles set reliability_completed = reliability_completed + 1
   where id in (v_from, v_to);
  return new;
end $$;


--
-- Name: bump_conversation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_conversation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update conversations set
    last_message_at = new.created_at,
    last_message_preview = case new.kind::text
      when 'TEXT' then left(new.text, 120)
      when 'IMAGE' then '📷 Bilde'
      when 'PROPOSAL' then 'Sendte et tilbud'
      else left(coalesce(new.text, ''), 120) end
  where id = new.conversation_id
    -- an older message arriving late (offline outbox) must not replace a newer preview
    and last_message_at <= new.created_at;
  return new;
end $$;


--
-- Name: bump_no_show_counter(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_no_show_counter() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update profiles
     set reliability_no_shows = reliability_no_shows + 1
   where id = new.reported_id;
  return new;
end;
$$;


--
-- Name: bump_partners_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_partners_version() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into app_settings(key, value, updated_at) values ('partners.version', to_jsonb(now()::text), now())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  return null;
end $$;


--
-- Name: call_send_push(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.call_send_push(p_body jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare v_url text; v_secret text;
begin
  select value into v_url from app_secrets where key = 'functions_url';
  select value into v_secret from app_secrets where key = 'push_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/send-push',
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret));
exception when others then
  -- a push that can't be queued must never block the write that caused it
  null;
end $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    from_profile_id uuid NOT NULL,
    to_profile_id uuid NOT NULL,
    price_amount_minor bigint NOT NULL,
    price_currency text DEFAULT 'NOK'::text NOT NULL,
    message text,
    scheduled_text text,
    caveats text,
    status public.proposal_status DEFAULT 'SENT'::public.proposal_status NOT NULL,
    client_token text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone,
    scheduled_at timestamp with time zone,
    duration_text text,
    responded_at timestamp with time zone,
    seen_at timestamp with time zone,
    expires_at timestamp with time zone
);


--
-- Name: cancel_agreement(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_agreement(p_proposal_id uuid, p_reason text DEFAULT NULL::text) RETURNS public.proposals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid := auth.uid(); p proposals; v_actor text; v_other uuid; v_reason text;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found then raise exception 'Fant ikke tilbudet.'; end if;
  if not is_participant(p.conversation_id) then raise exception 'Ikke tilgang.'; end if;

  if v_me = p.from_profile_id then v_actor := 'PROPOSER'; v_other := p.to_profile_id;
  elsif v_me = p.to_profile_id then v_actor := 'RECIPIENT'; v_other := p.from_profile_id;
  else raise exception 'Feil rolle for denne handlingen.';
  end if;

  update proposals set status = proposal_next(p.status, 'CANCEL', v_actor)
   where id = p.id returning * into p;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  update agreement_snapshots set cancelled_at = now(), cancel_reason = v_reason
   where proposal_id = p.id;

  -- the oppdrag is open for offers again
  update listings set status = 'RECEIVING_OFFERS' where id = p.listing_id;

  insert into messages (conversation_id, author_id, kind, text)
    values (p.conversation_id, v_me, 'SYSTEM',
            'Avtalen er avlyst' || coalesce(' · ' || v_reason, ''));
  perform notify(v_other, 'AGREEMENT_CANCELLED', 'Avtalen er avlyst',
    coalesce('Grunn: ' || lower(v_reason) || '.', 'Den andre parten har avlyst avtalen.'),
    '/avtale/' || p.id);
  return p;
end $$;


--
-- Name: completion_confirmations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.completion_confirmations (
    agreement_proposal_id uuid NOT NULL,
    by_profile_id uuid NOT NULL,
    confirmed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: confirm_completion(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_completion(p_agreement_proposal_id uuid) RETURNS SETOF public.completion_confirmations
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid := auth.uid(); p proposals; v_both int; v_party uuid; v_new int;
begin
  select * into p from proposals where id = p_agreement_proposal_id;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Ikke tilgang.'; end if;

  insert into completion_confirmations (agreement_proposal_id, by_profile_id)
    values (p_agreement_proposal_id, v_me)
  on conflict do nothing;
  get diagnostics v_new = row_count;

  -- confirming twice changes nothing and sends nothing again
  if v_new = 0 then
    return query select * from completion_confirmations
      where agreement_proposal_id = p_agreement_proposal_id;
    return;
  end if;

  select count(*) into v_both from completion_confirmations
   where agreement_proposal_id = p_agreement_proposal_id;
  if v_both >= 2 then
    update listings set status = 'COMPLETED' where id = p.listing_id;
    foreach v_party in array array[p.from_profile_id, p.to_profile_id] loop
      if is_youth(v_party) then
        perform notify(v_party,'REVIEW_RECEIVED','Oppdrag fullført',
          'Oppdraget er markert som fullført. Bra jobbet!','/ung');
      else
        perform notify(v_party,'REVIEW_RECEIVED','Oppdrag fullført',
          'Oppdraget er markert som fullført. Legg gjerne igjen en vurdering.','/vurder/'||p.id);
      end if;
    end loop;
  else
    perform notify(case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end,
      'COMPLETION_REQUESTED','Bekreft fullføring',
      'Den andre parten markerte oppdraget som fullført.','/fullfor/'||p.id);
  end if;

  return query select * from completion_confirmations
    where agreement_proposal_id = p_agreement_proposal_id;
end $$;


--
-- Name: delete_my_account(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_my_account(p_reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_me uuid := auth.uid();
  p proposals;
begin
  if v_me is null then
    raise exception 'Ikke innlogget.';
  end if;

  insert into account_deletions (reason) values (nullif(btrim(coalesce(p_reason, '')), ''));

  -- Active agreements are cancelled, and the other party is told.
  for p in
    select * from proposals
    where status = 'ACCEPTED' and (from_profile_id = v_me or to_profile_id = v_me)
  loop
    perform cancel_agreement(p.id, 'Kontoen er slettet');
  end loop;

  -- Open offers I sent are withdrawn.
  update proposals set status = 'WITHDRAWN'
   where from_profile_id = v_me and status in ('SENT', 'REVISION_PENDING');

  -- My oppdrag disappear for everyone (soft delete keeps the others' chats).
  update listings set status = 'REMOVED' where owner_id = v_me;

  -- Private and personal data.
  delete from noticeboard_posts where author_id = v_me;
  delete from neighbourhood_members where profile_id = v_me;
  delete from saved_listings where profile_id = v_me;
  delete from saved_searches where profile_id = v_me;
  delete from follows where follower_id = v_me or followed_id = v_me;
  delete from skill_endorsements where endorser_id = v_me or target_id = v_me;
  delete from trusted_contacts where owner_id = v_me;
  delete from safe_trips where owner_id = v_me;
  delete from profile_settings where profile_id = v_me;
  delete from push_tokens where profile_id = v_me;
  delete from blocks where by_profile_id = v_me;
  delete from verifications where profile_id = v_me;

  -- What others still see in old chats and reviews.
  update profiles set
    display_name = 'Slettet bruker',
    initials = '?',
    avatar_path = null,
    presentation = null,
    place = null,
    home_notes = null,
    portfolio = '{}',
    phone = null,
    paused = true,
    deleted_at = now(),
    updated_at = now()
  where id = v_me;
end;
$$;


--
-- Name: edit_proposal(uuid, bigint, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edit_proposal(p_proposal_id uuid, p_price_minor bigint, p_scheduled_text text, p_message text, p_caveats text) RETURNS public.proposals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare p proposals; v_title text;
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found or p.from_profile_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if p.status not in ('SENT','REVISION_PENDING') then
    raise exception 'Tilbudet kan ikke endres nå.';
  end if;
  if p_price_minor is not null and p_price_minor <= 0 then raise exception 'Prisen må være over 0.'; end if;

  update proposals set
    price_amount_minor = coalesce(p_price_minor, price_amount_minor),
    scheduled_text = nullif(p_scheduled_text, ''),
    message = nullif(p_message, ''),
    caveats = nullif(p_caveats, ''),
    status = 'SENT',
    edited_at = now(),
    updated_at = now()
  where id = p.id
  returning * into p;

  insert into proposal_revisions (proposal_id, actor_id, note, price_amount_minor, scheduled_text, caveats)
    values (p.id, auth.uid(), nullif(p_message,''), p.price_amount_minor, p.scheduled_text, p.caveats);
  insert into messages (conversation_id, author_id, kind, proposal_id, text)
    values (p.conversation_id, auth.uid(), 'PROPOSAL', p.id, '');
  update conversations set last_message_at = now(), last_message_preview = 'Tilbudet er endret'
   where id = p.conversation_id;

  select title into v_title from listings where id = p.listing_id;
  perform notify(p.to_profile_id, 'OFFER_CHANGED', 'Tilbudet er endret',
    'Et tilbud på «' || coalesce(v_title, 'oppdraget ditt') || '» er oppdatert.', '/tilbud/' || p.id);
  return p;
end $$;


--
-- Name: enforce_offer_audience(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_offer_audience() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if exists (select 1 from listings where id = new.listing_id and offer_audience = 'VERIFIED')
     and not exists (select 1 from verifications where profile_id = new.from_profile_id and verified) then
    raise exception 'Bare verifiserte naboer kan gi tilbud på dette oppdraget.' using errcode = '42501';
  end if;
  return new;
end $$;


--
-- Name: guard_listing_hidden(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_listing_hidden() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if not is_admin() and current_user = 'authenticated' then
    new.admin_hidden  := old.admin_hidden;
    new.hidden_reason := old.hidden_reason;
    new.hidden_at     := old.hidden_at;
    new.hidden_by     := old.hidden_by;
  end if;
  return new;
end $$;


--
-- Name: guard_moderation_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_moderation_columns() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if not is_admin() and current_user = 'authenticated' then
    new.suspended_at := old.suspended_at;
    new.role := old.role;
    new.is_business := old.is_business;
    new.youth_age := old.youth_age;
    new.reliability_completed := old.reliability_completed;
    new.reliability_no_shows := old.reliability_no_shows;
  end if;
  return new;
end $$;


--
-- Name: guard_notice_hidden(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_notice_hidden() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if not is_admin() and current_user = 'authenticated' then
    new.hidden_at := old.hidden_at;
  end if;
  return new;
end $$;


--
-- Name: guardian_invite_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guardian_invite_code() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid := auth.uid(); v_code text;
begin
  if v_me is null or not is_youth(v_me) then
    raise exception 'Bare ungdomskontoer kan invitere en foresatt.';
  end if;
  delete from guardian_links where youth_id = v_me and guardian_id is null;
  loop
    -- 6 characters without the look-alikes (0/O, 1/I)
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from guardian_links where code = v_code);
  end loop;
  insert into guardian_links (youth_id, code, code_expires_at) values (v_me, v_code, now() + interval '7 days');
  return v_code;
end $$;


--
-- Name: guardian_link(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guardian_link(p_code text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid := auth.uid(); g guardian_links; v_name text; v_mine text;
begin
  if v_me is null then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if is_youth(v_me) then raise exception 'En foresatt må være over 18 år.'; end if;
  select * into g from guardian_links
   where code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) and guardian_id is null for update;
  if not found or g.code_expires_at < now() then
    raise exception 'Koden er feil eller har utløpt. Be om en ny kode.';
  end if;
  if g.youth_id = v_me then raise exception 'Du kan ikke være foresatt for deg selv.'; end if;
  if exists (select 1 from guardian_links where youth_id = g.youth_id and guardian_id = v_me) then
    delete from guardian_links where id = g.id;
  else
    update guardian_links set guardian_id = v_me, linked_at = now(), code = null, code_expires_at = null where id = g.id;
  end if;
  select display_name into v_name from profiles where id = g.youth_id;
  select display_name into v_mine from profiles where id = v_me;
  insert into notifications (profile_id, kind, title, body, route)
    values (g.youth_id, 'MODERATION', 'Foresatt koblet til',
            coalesce(v_mine, 'En foresatt') || ' får nå beskjed når du får en avtale.', '/ung');
  return v_name;
end $$;


--
-- Name: guardian_unlink(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guardian_unlink(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from guardian_links where id = p_id and auth.uid() in (youth_id, guardian_id);
end $$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare nm text; ini text;
begin
  nm := coalesce(new.raw_user_meta_data->>'display_name',
                 split_part(new.email,'@',1), 'Nabo');
  ini := upper(left(regexp_replace(nm,'[^A-Za-zÆØÅæøå]','','g'), 2));
  insert into public.profiles (id, display_name, initials)
    values (new.id, nm, coalesce(nullif(ini,''),'N'));
  -- only a real, confirmed address counts (not the test login, not Vipps' internal address)
  if new.email is not null
     and new.email not like '%@vipps.minnabo.invalid'
     and coalesce(new.is_anonymous, false) = false then
    insert into public.verifications (profile_id, kind, verified, explanation, verified_at)
      values (new.id,'EMAIL', true,
              'E-postadressen din er bekreftet ved innlogging.', now());
  end if;
  return new;
end $$;


--
-- Name: has_banned_word(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_banned_word(p_text text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
  select p_text is not null and exists (
    select 1 from banned_words b
     where lower(p_text) ~ ('(^|[^a-zæøå0-9])' || b.word || '($|[^a-zæøå0-9])'));
$_$;


--
-- Name: hovedpartner_slots(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hovedpartner_slots() RETURNS TABLE(max_slots integer, taken integer, free integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select setting_int('partners.max_hovedpartnere', 4), hovedpartner_taken(),
         greatest(setting_int('partners.max_hovedpartnere', 4) - hovedpartner_taken(), 0)
$$;


--
-- Name: hovedpartner_taken(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hovedpartner_taken(p_exclude uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select ((select count(*) from partner_accounts a
            where a.package = 'hoved' and a.partner_id is distinct from p_exclude
              and (a.status in ('pending_approval','active','paused')
                   or (a.status = 'pending_payment' and a.hold_expires_at > now())))
        + (select count(distinct pp.partner_id) from partner_placements pp
            where pp.surface = 'fellesskap' and pp.active and pp.partner_id is distinct from p_exclude
              and not exists (select 1 from partner_accounts a where a.partner_id = pp.partner_id)))::int
$$;


--
-- Name: instant_book(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.instant_book(p_listing_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_owner uuid;
  v_price_minor bigint;
  v_price_currency text;
  v_conversation uuid;
  v_proposal uuid;
begin
  select l.owner_id, l.price_amount_minor, l.price_currency
    into v_owner, v_price_minor, v_price_currency
  from listings l
  join service_offer_details s on s.listing_id = l.id and s.instant_book
  where l.id = p_listing_id;

  if v_owner is null then
    raise exception 'Direktebooking er ikke tilgjengelig.';
  end if;
  if v_owner = auth.uid() then
    raise exception 'Du kan ikke booke deg selv.';
  end if;

  -- reuse or create the conversation
  select c.id into v_conversation
  from conversations c where c.listing_id = p_listing_id
  and exists (select 1 from conversation_participants p
              where p.conversation_id = c.id and p.profile_id = auth.uid());

  if v_conversation is null then
    insert into conversations (listing_id) values (p_listing_id) returning id into v_conversation;
    insert into conversation_participants (conversation_id, profile_id)
    values (v_conversation, auth.uid()), (v_conversation, v_owner);
  end if;

  insert into proposals (listing_id, conversation_id, from_profile_id, to_profile_id,
    price_amount_minor, price_currency, status)
  values (p_listing_id, v_conversation, v_owner, auth.uid(),
    coalesce(v_price_minor, 0), coalesce(v_price_currency, 'NOK'), 'ACCEPTED')
  returning id into v_proposal;

  insert into agreement_snapshots (proposal_id, listing_id, price_amount_minor, price_currency, description, agreed_at)
  values (v_proposal, p_listing_id, coalesce(v_price_minor, 0), coalesce(v_price_currency, 'NOK'), '', now());

  return v_proposal;
end;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;


--
-- Name: is_open_listing(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_open_listing(p_listing_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from listings
                  where id = p_listing_id
                    and status::text in ('PUBLISHED','RECEIVING_OFFERS','ACTIVE')
                    and not admin_hidden);
$$;


--
-- Name: is_participant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_participant(conv uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = conv and profile_id = auth.uid()
  );
$$;


--
-- Name: is_youth(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_youth(p_profile uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select birth_date + interval '18 years' > now()
                     from profile_private where profile_id = p_profile), false);
$$;


--
-- Name: join_neighbourhood(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_neighbourhood(p_municipality text, p_place text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into neighbourhoods (name, place, municipality, created_by)
  values (p_place || ' nabolag', p_place, p_municipality, auth.uid())
  on conflict (municipality, place) do nothing;
  select n.id into v_id from neighbourhoods n
  where n.municipality = p_municipality and n.place = p_place;
  insert into neighbourhood_members (neighbourhood_id, profile_id)
  values (v_id, auth.uid())
  on conflict do nothing;
  return v_id;
end;
$$;


--
-- Name: leave_neighbourhood(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.leave_neighbourhood(p_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  delete from neighbourhood_members where neighbourhood_id = p_id and profile_id = auth.uid();
$$;


--
-- Name: lift_expired_suspensions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lift_expired_suspensions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid; v_n int := 0;
begin
  for v_id in
    select m.profile_id from profile_moderation m join profiles p on p.id = m.profile_id
     where p.suspended_at is not null and m.suspended_until is not null and m.suspended_until <= now()
  loop
    perform moderation_set_suspended(v_id, false, null, null, 'system');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;


--
-- Name: listing_offer_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listing_offer_count(p_listing_id uuid) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select json_build_object(
    'count', count(distinct from_profile_id),
    'mine', coalesce(bool_or(from_profile_id = auth.uid()), false))
    from proposals
   where listing_id = p_listing_id and status in ('SENT','REVISION_PENDING','ACCEPTED');
$$;


--
-- Name: listings_guard_agreement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listings_guard_agreement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.status is not distinct from old.status then return new; end if;

  -- the owner (a direct update from the app) can't remove, archive, pause or reopen
  -- an oppdrag that has an avtale; the avtale has to be called off first
  if current_user = 'authenticated'
     and old.status::text in ('OFFER_ACCEPTED','AGREED','IN_PROGRESS','COMPLETION_SENT') then
    raise exception 'Oppdraget har en avtale. Avlys avtalen før du endrer oppdraget.' using errcode = '42501';
  end if;

  -- calling an avtale off reopens the oppdrag – but never one the owner has removed or archived
  if current_user <> 'authenticated'
     and new.status::text = 'RECEIVING_OFFERS'
     and old.status::text in ('REMOVED','ARCHIVED','PAUSED') then
    new.status := old.status;
  end if;
  return new;
end $$;


--
-- Name: listings_rate_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listings_rate_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_short int; v_day int;
begin
  if auth.uid() is null or is_admin() then return new; end if;
  select count(*) filter (where created_at > now() - interval '10 minutes'),
         count(*) filter (where created_at > now() - interval '24 hours')
    into v_short, v_day from listings where owner_id = new.owner_id;
  if v_short >= 3 then raise exception 'For mange oppdrag på kort tid. Vent litt og prøv igjen.'; end if;
  if v_day >= 8 then raise exception 'Du har lagt ut mange oppdrag i dag. Prøv igjen i morgen.'; end if;
  return new;
end $$;


--
-- Name: listings_search_tsv(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listings_search_tsv() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.search := to_tsvector('simple',
    coalesce(new.title,'') || ' ' || coalesce(new.place,'') || ' ' || coalesce(new.category_slug,''));
  return new;
end $$;


--
-- Name: log_partner_event(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_partner_event(p_partner uuid, p_kind text, p_kommune text DEFAULT NULL::text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into partner_events(partner_id, kind, source, kommune)
  select p_partner, p_kind, 'app', p_kommune
   where p_kind in ('impression','click') and partner_is_visible(p_partner)
$$;


--
-- Name: mark_conversation_read(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_conversation_read(p_conversation_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_participant(p_conversation_id) then raise exception 'Ikke tilgang.'; end if;
  update conversation_participants set last_read_at = now()
   where conversation_id = p_conversation_id and profile_id = auth.uid();
  insert into message_reads (conversation_id, profile_id, last_read_at)
    values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, profile_id) do update set last_read_at = now();
end $$;


--
-- Name: mark_conversations_delivered(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_conversations_delivered() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update conversation_participants cp set last_delivered_at = now()
   where cp.profile_id = auth.uid()
     and exists (select 1 from messages m
                  where m.conversation_id = cp.conversation_id
                    and m.author_id <> auth.uid()
                    and m.created_at > cp.last_delivered_at);
$$;


--
-- Name: mark_proposal_seen(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_proposal_seen(p_proposal_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update proposals set seen_at = now()
   where id = p_proposal_id and to_profile_id = auth.uid() and seen_at is null;
$$;


--
-- Name: mark_saved_search_run(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_saved_search_run(p_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update saved_searches set last_run_at = now() where id = p_id and profile_id = auth.uid();
$$;


--
-- Name: message_author_read(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.message_author_read() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update conversation_participants set last_read_at = greatest(last_read_at, new.created_at)
   where conversation_id = new.conversation_id and profile_id = new.author_id;
  insert into message_reads (conversation_id, profile_id, last_read_at)
    values (new.conversation_id, new.author_id, new.created_at)
  on conflict (conversation_id, profile_id) do update
    set last_read_at = greatest(message_reads.last_read_at, excluded.last_read_at);
  return new;
end $$;


--
-- Name: message_rate_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.message_rate_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare v_recent int;
begin
  if new.kind in ('TEXT','IMAGE') then
    select count(*) into v_recent from messages
     where author_id = new.author_id and created_at > now() - interval '10 seconds';
    perform rate_check(v_recent, 10, 'meldinger');
  end if;
  return new;
end $$;


--
-- Name: messages_respect_blocks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.messages_respect_blocks() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.kind::text = 'SYSTEM' then return new; end if;
  if exists (
    select 1 from conversation_participants cp
      join blocks b on (b.by_profile_id = cp.profile_id and b.blocked_profile_id = new.author_id)
                    or (b.by_profile_id = new.author_id and b.blocked_profile_id = cp.profile_id)
     where cp.conversation_id = new.conversation_id and cp.profile_id <> new.author_id
  ) then
    raise exception 'Du kan ikke sende meldinger til denne personen.' using errcode = '42501';
  end if;
  return new;
end $$;


--
-- Name: moderation_decide_business(uuid, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.moderation_decide_business(p_profile_id uuid, p_approve boolean, p_reason text DEFAULT NULL::text, p_by text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare b business_profiles;
begin
  update business_profiles
     set status = case when p_approve then 'APPROVED' else 'REJECTED' end::business_status,
         decided_at = now(),
         rejection_reason = case when p_approve then null else p_reason end,
         decided_by_staff = p_by
   where profile_id = p_profile_id returning * into b;
  if not found then raise exception 'Fant ikke bedriften.'; end if;
  update profiles set is_business = p_approve where id = p_profile_id;
  insert into verifications (profile_id, kind, verified, explanation, verified_at)
    values (p_profile_id, 'BUSINESS', p_approve,
      case when p_approve then 'Organisasjonsnummeret er sjekket mot Enhetsregisteret.'
           else 'Bedriften ble ikke godkjent.' end,
      case when p_approve then now() end)
  on conflict (profile_id, kind) do update
    set verified = excluded.verified, explanation = excluded.explanation, verified_at = excluded.verified_at;
  if p_approve then
    perform notify_moderation(p_profile_id, 'Bedriften er verifisert',
      b.company_name || ' er verifisert. Verifisert-merket vises nå på profilen din.', '/bedrift');
  else
    perform notify_moderation(p_profile_id, 'Bedriften ble ikke godkjent',
      'Sjekk opplysningene om ' || b.company_name || ' og send inn på nytt.'
      || coalesce(' Grunn: ' || nullif(btrim(p_reason), '') || '.', ''), '/bedrift');
  end if;
end $$;


--
-- Name: moderation_decide_report(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.moderation_decide_report(p_report_id uuid, p_outcome text, p_resolved_by uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r reports; v_owner uuid; v_undo jsonb := null;
begin
  if p_outcome not in ('dismiss','remove','warn') then raise exception 'Ukjent utfall.'; end if;
  select * into r from reports where id = p_report_id for update;
  if not found then raise exception 'Fant ikke rapporten.'; end if;
  if r.status = 'RESOLVED' then return; end if;
  v_owner := report_target_owner(r.target_type, r.target_id);

  if p_outcome = 'remove' then
    case r.target_type::text
      when 'LISTING' then
        -- added: hidden_reason / hidden_at
        update listings set admin_hidden = true, hidden_reason = r.reason, hidden_at = now() where id::text = r.target_id;
      when 'NOTICE' then
        update noticeboard_posts set hidden_at = now() where id::text = r.target_id;
      when 'MESSAGE' then
        select jsonb_build_object('text', messages.text) into v_undo from messages where id::text = r.target_id;
        update messages set text = 'Meldingen er fjernet av MinNabo.' where id::text = r.target_id;
      when 'COMMENT' then
        select jsonb_build_object('body', body) into v_undo from notice_comments where id::text = r.target_id;
        update notice_comments set body = 'Svaret er fjernet av MinNabo.' where id::text = r.target_id;
      when 'REVIEW' then
        select jsonb_build_object('comment', comment) into v_undo from reviews where id::text = r.target_id;
        update reviews set comment = null where id::text = r.target_id;
      when 'PROPOSAL' then
        select jsonb_build_object('status', status) into v_undo from proposals where id::text = r.target_id;
        update proposals set status = 'WITHDRAWN', updated_at = now()
         where id::text = r.target_id and status in ('SENT','REVISION_PENDING');
      when 'USER' then
        select jsonb_build_object('suspended_at', suspended_at) into v_undo from profiles where id = v_owner;
        update profiles set suspended_at = coalesce(suspended_at, now()) where id = v_owner;
      else null;
    end case;
    perform notify_moderation(v_owner, 'Innhold er fjernet',
      'Noe du har lagt ut bryter med reglene for MinNabo og er fjernet. Grunn: ' || r.reason || '.', '/vilkar');
  elsif p_outcome = 'warn' then
    perform notify_moderation(v_owner, 'Du har fått en advarsel',
      'Vi har fått en rapport om deg: ' || r.reason || '. Gjentatte brudd på reglene kan føre til at kontoen blir suspendert.', '/vilkar');
    -- added: count warnings for Admin › Brukere («Advart»)
    if v_owner is not null then
      insert into profile_moderation (profile_id, warning_count, last_warned_at) values (v_owner, 1, now())
      on conflict (profile_id) do update
        set warning_count = profile_moderation.warning_count + 1, last_warned_at = now(), updated_at = now();
    end if;
  end if;

  update reports set status = 'RESOLVED', outcome = p_outcome, undo = v_undo,
         resolved_by = p_resolved_by, resolved_at = now()
   where id = p_report_id;

  perform notify_moderation(r.by_profile_id, 'Rapporten din er behandlet',
    'Takk for at du sa fra. Vi har sett på rapporten om «' || r.reason || '».', null);
end $$;


--
-- Name: moderation_reopen_report(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.moderation_reopen_report(p_report_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r reports; v_owner uuid;
begin
  select * into r from reports where id = p_report_id for update;
  if not found or r.status = 'OPEN' then return; end if;
  if r.outcome = 'remove' then
    v_owner := report_target_owner(r.target_type, r.target_id);
    case r.target_type::text
      when 'LISTING' then
        update listings set admin_hidden = false, hidden_reason = null, hidden_at = null, hidden_by = null
         where id::text = r.target_id;
      when 'NOTICE' then update noticeboard_posts set hidden_at = null where id::text = r.target_id;
      when 'MESSAGE' then
        if r.undo ? 'text' then update messages set text = r.undo->>'text' where id::text = r.target_id; end if;
      when 'COMMENT' then
        if r.undo ? 'body' then update notice_comments set body = r.undo->>'body' where id::text = r.target_id; end if;
      when 'REVIEW' then
        if r.undo ? 'comment' then update reviews set comment = r.undo->>'comment' where id::text = r.target_id; end if;
      when 'PROPOSAL' then
        if r.undo ? 'status' then
          update proposals set status = (r.undo->>'status')::proposal_status where id::text = r.target_id;
        end if;
      when 'USER' then
        update profiles set suspended_at = (r.undo->>'suspended_at')::timestamptz where id = v_owner;
      else null;
    end case;
  end if;
  update reports set status = 'OPEN', outcome = null, undo = null, resolved_by = null, resolved_at = null,
         resolved_by_staff = null, resolution_note = null
   where id = p_report_id;
end $$;


--
-- Name: moderation_set_listing_hidden(uuid, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.moderation_set_listing_hidden(p_listing_id uuid, p_hidden boolean, p_reason text DEFAULT NULL::text, p_by text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_owner uuid; v_title text;
begin
  update listings set admin_hidden = p_hidden,
         hidden_reason = case when p_hidden then p_reason end,
         hidden_at     = case when p_hidden then now() end,
         hidden_by     = case when p_hidden then p_by end
   where id = p_listing_id returning owner_id, title into v_owner, v_title;
  if p_hidden then
    perform notify_moderation(v_owner, 'Oppdraget ditt er skjult',
      '«' || v_title || '» bryter med reglene for MinNabo og vises ikke for andre.', '/mine');
  end if;
end $$;


--
-- Name: moderation_set_suspended(uuid, boolean, timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.moderation_set_suspended(p_profile_id uuid, p_suspended boolean, p_until timestamp with time zone DEFAULT NULL::timestamp with time zone, p_reason text DEFAULT NULL::text, p_by text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update profiles set suspended_at = case when p_suspended then coalesce(suspended_at, now()) end
   where id = p_profile_id;
  insert into profile_moderation (profile_id, suspended_until, suspension_reason, updated_by)
    values (p_profile_id, case when p_suspended then p_until end, case when p_suspended then p_reason end, p_by)
  on conflict (profile_id) do update
    set suspended_until = excluded.suspended_until, suspension_reason = excluded.suspension_reason,
        updated_by = excluded.updated_by, updated_at = now();
  if p_suspended then
    perform notify_moderation(p_profile_id, 'Kontoen din er suspendert',
      'Du kan ikke legge ut, gi tilbud eller sende meldinger før saken er behandlet. Kontakt MinNabo hvis du mener dette er feil.', '/vilkar');
  else
    perform notify_moderation(p_profile_id, 'Kontoen din er aktiv igjen', 'Du kan bruke MinNabo som vanlig.', null);
  end if;
end $$;


--
-- Name: my_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_account() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare pp profile_private; v_age int;
begin
  if auth.uid() is null then return null; end if;
  perform refresh_youth_age(auth.uid());
  select * into pp from profile_private where profile_id = auth.uid();
  if not found then
    return json_build_object('vipps', false, 'youth', false);
  end if;
  v_age := case when pp.birth_date is null then null else extract(year from age(now(), pp.birth_date))::int end;
  return json_build_object(
    'vipps', pp.vipps_sub is not null,
    'youth', coalesce(v_age < 18, false),
    'age', v_age,
    'birthYear', extract(year from pp.birth_date)::int,
    'fullName', pp.full_name,
    'phoneMasked', case when pp.phone is null then null
                        else '+47 ••• •• ' || right(regexp_replace(pp.phone, '\D', '', 'g'), 3) end,
    'emailMasked', case when pp.email is null or position('@' in pp.email) < 2 then null
                        else left(pp.email, 1) || '•••' || substring(pp.email from position('@' in pp.email)) end);
end $$;


--
-- Name: my_account_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_account_status() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select json_build_object(
    'suspended', coalesce((select suspended_at is not null from profiles where id = auth.uid()), false),
    'deleted', coalesce((select deleted_at is not null from profiles where id = auth.uid()), false));
$$;


--
-- Name: my_conversation_meta(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_conversation_meta() RETURNS TABLE(conversation_id uuid, unread_count integer, last_author_id uuid, last_kind text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: my_guardian_links(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_guardian_links() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select json_build_object(
    'youth', is_youth(auth.uid()),
    'code', (select json_build_object('code', code, 'expiresAt', code_expires_at) from guardian_links
              where youth_id = auth.uid() and guardian_id is null and code_expires_at > now() limit 1),
    'guardians', coalesce((select json_agg(json_build_object('id', g.id, 'name', p.display_name) order by g.linked_at)
                             from guardian_links g join profiles p on p.id = g.guardian_id
                            where g.youth_id = auth.uid()), '[]'::json),
    'youths', coalesce((select json_agg(json_build_object('id', g.id, 'name', p.display_name, 'age', p.youth_age) order by g.linked_at)
                          from guardian_links g join profiles p on p.id = g.youth_id
                         where g.guardian_id = auth.uid()), '[]'::json));
$$;


--
-- Name: neighbourhood_info(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.neighbourhood_info(p_municipality text, p_place text) RETURNS TABLE(id uuid, name text, place text, municipality text, created_at timestamp with time zone, member_count integer, is_member boolean, member_ids uuid[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    n.id,
    n.name,
    n.place,
    n.municipality,
    n.created_at,
    (select count(*)::int from neighbourhood_members m where m.neighbourhood_id = n.id),
    exists (
      select 1 from neighbourhood_members m
      where m.neighbourhood_id = n.id and m.profile_id = auth.uid()
    ),
    coalesce((
      select array_agg(s.profile_id) from (
        select m.profile_id from neighbourhood_members m
        where m.neighbourhood_id = n.id
        order by m.joined_at desc
        limit 5
      ) s
    ), '{}')
  from neighbourhoods n
  where n.municipality = p_municipality and n.place = p_place;
$$;


--
-- Name: notice_comment_added(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notice_comment_added() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

  if n.author_id <> new.author_id then
    select display_name into v_name from profiles where id = new.author_id;
    insert into notifications (profile_id, kind, title, body, route)
      values (n.author_id, 'NOTICE_REPLY'::text::notification_kind,
              coalesce(v_name, 'En nabo') || ' svarte på oppslaget ditt',
              '«' || n.title || '»: ' || left(new.body, 100), '/oppslagstavle?oppslag=' || n.id);
  end if;
  return new;
end $$;


--
-- Name: notice_touch_edit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notice_touch_edit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.title is distinct from old.title or new.body is distinct from old.body or new.kind is distinct from old.kind then
    new.edited_at := now();
  end if;
  return new;
end $$;


--
-- Name: noticeboard_reply_counts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.noticeboard_reply_counts() RETURNS TABLE(notice_id uuid, replies integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.notice_id, count(*)::int
    from notice_comments c
    join noticeboard_posts n on n.id = c.notice_id and n.hidden_at is null
   group by c.notice_id;
$$;


--
-- Name: notices_rate_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notices_rate_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_day int;
begin
  if auth.uid() is null or is_admin() then return new; end if;
  select count(*) into v_day from noticeboard_posts
   where author_id = new.author_id and created_at > now() - interval '24 hours';
  if v_day >= 5 then raise exception 'Du har lagt ut mange oppslag i dag. Prøv igjen i morgen.'; end if;
  return new;
end $$;


--
-- Name: notify(uuid, public.notification_kind, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify(p_profile uuid, p_kind public.notification_kind, p_title text, p_body text, p_route text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into notifications (profile_id, kind, title, body, route)
  values (p_profile, p_kind, p_title, p_body, p_route);
end $$;


--
-- Name: notify_matching_helpers(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_matching_helpers(p_listing_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: notify_moderation(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_moderation(p_profile uuid, p_title text, p_body text, p_route text DEFAULT NULL::text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into notifications (profile_id, kind, title, body, route)
  select p_profile, 'MODERATION', p_title, p_body, p_route where p_profile is not null;
$$;


--
-- Name: notify_saved_searches(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_saved_searches() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare s record; v_owner_verified boolean;
begin
  if new.type::text <> 'TASK_REQUEST' or new.status::text not in ('PUBLISHED','RECEIVING_OFFERS') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status::text in ('PUBLISHED','RECEIVING_OFFERS') then
    return new; -- only when it becomes visible, not on every edit
  end if;

  select exists (select 1 from verifications v where v.profile_id = new.owner_id and v.verified)
    into v_owner_verified;

  for s in
    select distinct on (ss.profile_id) ss.profile_id, ss.name, ss.filter
      from saved_searches ss
      join profiles p on p.id = ss.profile_id and p.deleted_at is null and p.suspended_at is null
     where ss.alert
       and ss.profile_id <> new.owner_id
       and (coalesce(ss.filter->>'categorySlug', 'alle') in ('alle', '') or ss.filter->>'categorySlug' = new.category_slug)
       and (coalesce(jsonb_array_length(case when jsonb_typeof(ss.filter->'municipalities') = 'array'
                                             then ss.filter->'municipalities' else '[]'::jsonb end), 0) = 0
            or ss.filter->'municipalities' ? new.municipality)
       and (coalesce(trim(ss.filter->>'query'), '') = ''
            or new.title ilike '%' || trim(ss.filter->>'query') || '%'
            or new.place ilike '%' || trim(ss.filter->>'query') || '%')
       and (coalesce((ss.filter->>'verifiedOnly')::boolean, false) = false or v_owner_verified)
       and not exists (select 1 from blocks b
                        where (b.by_profile_id = ss.profile_id and b.blocked_profile_id = new.owner_id)
                           or (b.by_profile_id = new.owner_id and b.blocked_profile_id = ss.profile_id))
       and not exists (select 1 from notifications n
                        where n.profile_id = ss.profile_id and n.kind::text = 'NEW_MATCH'
                          and n.route = '/oppdrag/' || new.id)
     order by ss.profile_id, ss.created_at desc
     limit 500
  loop
    insert into notifications (profile_id, kind, title, body, route)
      values (s.profile_id, 'NEW_MATCH'::text::notification_kind,
              'Nytt treff i «' || coalesce(nullif(trim(s.filter->>'query'), ''), s.name) || '»',
              '«' || new.title || '» i ' || new.place, '/oppdrag/' || new.id);
  end loop;
  return new;
exception when others then
  -- an alert must never stop an oppdrag from being published
  return new;
end $$;


--
-- Name: owns_listing(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_listing(l uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from listings where id = l and owner_id = auth.uid());
$$;


--
-- Name: partner_accounts_before(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.partner_accounts_before() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_holding boolean := new.package = 'hoved' and (new.status in ('pending_approval','active','paused')
                       or (new.status = 'pending_payment' and new.hold_expires_at > now()));
  v_was     boolean := tg_op = 'UPDATE' and old.package = 'hoved' and (old.status in ('pending_approval','active','paused')
                       or (old.status = 'pending_payment' and old.hold_expires_at > now()));
begin
  -- only check when the row starts holding a slot, so lowering the max never blocks existing partners
  if v_holding and not v_was then
    perform pg_advisory_xact_lock(hashtext('minnabo.hovedpartner_slots'));
    if hovedpartner_taken(new.partner_id) >= setting_int('partners.max_hovedpartnere', 4) then
      raise exception 'HOVEDPARTNER_FULL' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;


--
-- Name: partner_accounts_sync(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.partner_accounts_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update partners set
    local_hero    = (new.package = 'helt'),
    active        = (new.status = 'active'),
    partner_since = case when new.status = 'active' then coalesce(partner_since, (now() at time zone 'Europe/Oslo')::date)
                         else partner_since end,
    updated_at    = now()
   where id = new.partner_id;
  if new.package = 'hoved' then
    update partner_placements set active = true where partner_id = new.partner_id and surface = 'fellesskap';
    if not found then
      insert into partner_placements (partner_id, surface, headline, active)
        values (new.partner_id, 'fellesskap', 'Hovedpartner', true);
    end if;
  else
    update partner_placements set active = false where partner_id = new.partner_id and surface = 'fellesskap';
  end if;
  return new;
end $$;


--
-- Name: partner_is_visible(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.partner_is_visible(p_partner_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((
    select p.active and (
             a.partner_id is null
             or (a.status = 'active' and not a.admin_hidden and (
                   a.billing_mode = 'free'
                   or a.admin_force_visible
                   or a.payment_state in ('paid','upcoming')
                   or (a.payment_state in ('failed','overdue')
                       and a.payment_due_since > now() - make_interval(days => setting_int('billing.grace_days', 7))))))
      from partners p left join partner_accounts a on a.partner_id = p.id
     where p.id = p_partner_id), false)
$$;


--
-- Name: price_guidance(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.price_guidance(p_category_slug text) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with x as (
    select pr.price_amount_minor / 100.0 as kr
      from proposals pr join listings l on l.id = pr.listing_id
     where l.category_slug = p_category_slug
       and pr.price_amount_minor > 0
       and pr.status::text <> 'WITHDRAWN'
       and pr.created_at > now() - interval '18 months'
  )
  select case when count(*) >= 5 then json_build_object(
           'low',  (round(percentile_cont(0.25) within group (order by kr) / 50) * 50)::int,
           'high', (round(percentile_cont(0.75) within group (order by kr) / 50) * 50)::int,
           'sampleSize', count(*))
         end
    from x;
$$;


--
-- Name: profile_deleted_cleanup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profile_deleted_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    delete from profile_private where profile_id = new.id;
    new.youth_age := null;
  end if;
  return new;
end $$;


--
-- Name: profile_private_sync(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profile_private_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform refresh_youth_age(new.profile_id);
  return new;
end $$;


--
-- Name: profile_reliability(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profile_reliability(p_profile_id uuid) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with mine as (
    select a.proposal_id, a.cancelled_at, a.cancelled_by, a.scheduled_at,
           p.from_profile_id = p_profile_id as is_helper,
           (select count(*) from completion_confirmations c where c.agreement_proposal_id = a.proposal_id) >= 2 as done,
           exists (select 1 from no_show_reports n
                    where n.agreement_proposal_id = a.proposal_id and n.reported_id = p_profile_id) as no_show,
           (select w.first_started_at from job_workspaces w where w.proposal_id = a.proposal_id) as started_at
      from agreement_snapshots a
      join proposals p on p.id = a.proposal_id
     where (p.from_profile_id = p_profile_id or p.to_profile_id = p_profile_id)
       and a.agreed_at > now() - interval '12 months'
  ), s as (
    select count(*) filter (where done) as completed,
           count(*) filter (where done or no_show) as judged,
           count(*) filter (where no_show) as no_shows,
           count(*) filter (where is_helper and scheduled_at is not null and started_at is not null) as timed,
           count(*) filter (where is_helper and scheduled_at is not null and started_at is not null
                              and started_at <= scheduled_at + interval '15 minutes') as on_time,
           count(*) filter (where done or cancelled_by = p_profile_id) as ended,
           count(*) filter (where cancelled_by = p_profile_id) as called_off
      from mine
  )
  select json_build_object(
    'completed', completed,
    'showsUp',   case when judged >= 3 then round(100.0 * (judged - no_shows) / judged)::int end,
    'onTime',    case when timed  >= 3 then round(100.0 * on_time / timed)::int end,
    'completes', case when ended  >= 3 then round(100.0 * (ended - called_off) / ended)::int end)
    from s;
$$;


--
-- Name: profile_reply_minutes(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profile_reply_minutes(p_profile_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: proposal_next(public.proposal_status, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proposal_next(p_from public.proposal_status, p_event text, p_actor text) RETURNS public.proposal_status
    LANGUAGE plpgsql
    AS $$
begin
  if p_from = 'DRAFT' and p_event = 'SEND' and p_actor = 'PROPOSER' then return 'SENT'; end if;
  if p_from = 'SENT' then
    if p_event = 'WITHDRAW' and p_actor = 'PROPOSER'  then return 'WITHDRAWN'; end if;
    if p_event = 'DECLINE'  and p_actor = 'RECIPIENT' then return 'DECLINED';  end if;
    if p_event = 'ACCEPT'   and p_actor = 'RECIPIENT' then return 'ACCEPTED';  end if;
    if p_event = 'REQUEST_REVISION' and p_actor = 'RECIPIENT' then return 'REVISION_PENDING'; end if;
  end if;
  if p_from = 'ACCEPTED' then
    if p_event = 'REQUEST_REVISION' and p_actor = 'RECIPIENT' then return 'REVISION_PENDING'; end if;
    -- either party may cancel an agreement
    if p_event = 'CANCEL' and p_actor in ('PROPOSER', 'RECIPIENT') then return 'CANCELLED'; end if;
  end if;
  if p_from = 'REVISION_PENDING' then
    if p_event = 'SUBMIT_REVISION'  and p_actor = 'PROPOSER'  then return 'SENT';      end if;
    if p_event = 'CONFIRM_REVISION' and p_actor = 'PROPOSER'  then return 'ACCEPTED';  end if;
    if p_event = 'WITHDRAW'         and p_actor = 'PROPOSER'  then return 'WITHDRAWN'; end if;
    if p_event = 'DECLINE'          and p_actor = 'RECIPIENT' then return 'DECLINED';  end if;
  end if;
  raise exception 'Ugyldig endring av tilbudet.' using errcode = 'check_violation';
end $$;


--
-- Name: proposal_revision_notify(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proposal_revision_notify() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if old.status::text = 'REVISION_PENDING' and new.status::text = 'SENT'
     and new.edited_at is not distinct from old.edited_at then
    insert into notifications (profile_id, kind, title, body, route)
      values (new.to_profile_id, 'OFFER_CHANGED', 'Tilbudet er oppdatert',
              'Du har fått et oppdatert tilbud etter endringen du ba om.', '/tilbud/' || new.id);
  end if;
  return new;
end $$;


--
-- Name: proposals_accept_needs_open_listing(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proposals_accept_needs_open_listing() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_status text;
begin
  if new.status::text = 'ACCEPTED' and old.status::text <> 'ACCEPTED' and not is_open_listing(new.listing_id) then
    select status::text into v_status from listings where id = new.listing_id;
    if v_status in ('PAUSED','ARCHIVED','REMOVED','EXPIRED') then
      raise exception 'Oppdraget er satt på pause eller fjernet. Aktiver det igjen for å godta tilbud.' using errcode = '42501';
    end if;
    raise exception 'Oppdraget har allerede en avtale.' using errcode = '42501';
  end if;
  return new;
end $$;


--
-- Name: proposals_need_open_listing(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proposals_need_open_listing() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not is_open_listing(new.listing_id) then
    raise exception 'Oppdraget er ikke lenger åpent for tilbud.' using errcode = '42501';
  end if;
  return new;
end $$;


--
-- Name: proposals_notify_guardians(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proposals_notify_guardians() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_youth uuid; v_other uuid; v_yname text; v_oname text; v_title text; v_when text; g record;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status::text <> 'ACCEPTED' and not (old.status::text = 'ACCEPTED' and new.status::text = 'CANCELLED') then
    return new;
  end if;
  if is_youth(new.from_profile_id) then v_youth := new.from_profile_id; v_other := new.to_profile_id;
  elsif is_youth(new.to_profile_id) then v_youth := new.to_profile_id; v_other := new.from_profile_id;
  else return new;
  end if;
  if not exists (select 1 from guardian_links where youth_id = v_youth and guardian_id is not null) then return new; end if;

  select split_part(display_name, ' ', 1) into v_yname from profiles where id = v_youth;
  select display_name into v_oname from profiles where id = v_other;
  select title into v_title from listings where id = new.listing_id;
  v_when := coalesce(nullif(trim(coalesce(new.scheduled_text, '')), ''), 'tid ikke avtalt ennå');

  for g in select guardian_id from guardian_links where youth_id = v_youth and guardian_id is not null loop
    if new.status::text = 'ACCEPTED' then
      insert into notifications (profile_id, kind, title, body, route)
        values (g.guardian_id, 'OFFER_ACCEPTED', coalesce(v_yname, 'Ungdommen') || ' har fått en avtale',
                '«' || coalesce(v_title, 'Oppdrag') || '» med ' || coalesce(v_oname, 'en nabo') || ' · ' || v_when || '.',
                '/innstillinger');
    else
      insert into notifications (profile_id, kind, title, body, route)
        values (g.guardian_id, 'AGREEMENT_CANCELLED', 'Avtalen til ' || coalesce(v_yname, 'ungdommen') || ' er avlyst',
                '«' || coalesce(v_title, 'Oppdrag') || '» med ' || coalesce(v_oname, 'en nabo') || ' blir ikke noe av.',
                '/innstillinger');
    end if;
  end loop;
  return new;
end $$;


--
-- Name: proposals_notify_others(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proposals_notify_others() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_title text; o record;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status::text <> 'ACCEPTED' and not (old.status::text = 'ACCEPTED' and new.status::text = 'CANCELLED') then
    return new;
  end if;
  select title into v_title from listings where id = new.listing_id;

  for o in
    select id, from_profile_id from proposals
     where listing_id = new.listing_id and id <> new.id and status in ('SENT','REVISION_PENDING')
  loop
    if new.status::text = 'ACCEPTED' then
      insert into notifications (profile_id, kind, title, body, route)
        values (o.from_profile_id, 'OFFER_CHANGED', 'Oppdraget har fått en avtale',
                '«' || coalesce(v_title, 'Oppdraget') || '» har en avtale med en annen nabo. Tilbudet ditt står på vent.',
                '/tilbud/' || o.id);
    else
      insert into notifications (profile_id, kind, title, body, route)
        values (o.from_profile_id, 'OFFER_CHANGED', 'Oppdraget er åpent igjen',
                'Avtalen på «' || coalesce(v_title, 'oppdraget') || '» ble avlyst. Tilbudet ditt gjelder igjen.',
                '/tilbud/' || o.id);
    end if;
  end loop;
  return new;
end $$;


--
-- Name: proposals_respect_invite(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proposals_respect_invite() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_invited uuid;
begin
  select invited_profile_id into v_invited from listings where id = new.listing_id;
  if v_invited is not null and new.from_profile_id <> v_invited then
    raise exception 'Dette oppdraget er sendt til en bestemt nabo.';
  end if;
  return new;
end $$;


--
-- Name: proposals_stamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proposals_stamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if tg_op = 'INSERT' then
    if new.expires_at is null then new.expires_at := now() + interval '14 days'; end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status::text = 'ACCEPTED' and old.expires_at is not null and old.expires_at < now() then
      raise exception 'Tilbudet har utløpt. Be om et nytt tilbud.';
    end if;
    if new.status::text in ('ACCEPTED','DECLINED') then
      new.responded_at := now();
    end if;
    -- a changed / re-sent tilbud is new to the recipient and valid for 14 more days
    if new.status::text = 'SENT' then
      new.seen_at := null;
      new.responded_at := null;
      new.expires_at := now() + interval '14 days';
    end if;
  elsif new.status::text = 'SENT' and new.edited_at is distinct from old.edited_at then
    new.seen_at := null;
    new.expires_at := now() + interval '14 days';
  end if;
  return new;
end $$;


--
-- Name: agreement_time_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agreement_time_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    proposed_by uuid NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    scheduled_text text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    CONSTRAINT agreement_time_proposals_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'ACCEPTED'::text, 'DECLINED'::text, 'WITHDRAWN'::text])))
);


--
-- Name: propose_agreement_time(uuid, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.propose_agreement_time(p_proposal_id uuid, p_scheduled_at timestamp with time zone, p_scheduled_text text) RETURNS public.agreement_time_proposals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_me uuid := auth.uid();
  p proposals; a agreement_snapshots; r agreement_time_proposals;
  v_other uuid; v_title text; v_status text; v_name text;
  v_text text := nullif(trim(coalesce(p_scheduled_text, '')), '');
begin
  select * into p from proposals where id = p_proposal_id;
  if not found or v_me is null or v_me not in (p.from_profile_id, p.to_profile_id) then
    raise exception 'Ikke tilgang.' using errcode = '42501';
  end if;
  select * into a from agreement_snapshots where proposal_id = p.id;
  if not found or a.cancelled_at is not null or p.status::text <> 'ACCEPTED' then
    raise exception 'Avtalen gjelder ikke lenger.';
  end if;
  select title, status::text into v_title, v_status from listings where id = p.listing_id;
  if v_status in ('COMPLETED','REVIEWED') then raise exception 'Oppdraget er allerede fullført.'; end if;
  if p_scheduled_at is null or p_scheduled_at <= now() or v_text is null then
    raise exception 'Velg et tidspunkt fram i tid.';
  end if;

  -- a new proposal replaces the open one (mine is withdrawn, theirs is answered with this)
  update agreement_time_proposals
     set status = case when proposed_by = v_me then 'WITHDRAWN' else 'DECLINED' end, responded_at = now()
   where proposal_id = p.id and status = 'PENDING';

  insert into agreement_time_proposals (proposal_id, proposed_by, scheduled_at, scheduled_text)
    values (p.id, v_me, p_scheduled_at, v_text) returning * into r;

  v_other := case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end;
  select split_part(display_name, ' ', 1) into v_name from profiles where id = v_me;
  insert into notifications (profile_id, kind, title, body, route)
    values (v_other, 'AGREED_TIME', 'Forslag om nytt tidspunkt',
            coalesce(v_name, 'Den andre') || ' foreslår ' || v_text || ' for «' || coalesce(v_title, 'oppdraget') || '».',
            '/avtale/' || p.id);
  return r;
end $$;


--
-- Name: push_on_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.push_on_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- tilbud and system lines already produce a notification row of their own
  if new.kind::text in ('TEXT', 'IMAGE') then
    perform call_send_push(jsonb_build_object('type', 'message', 'id', new.id));
  end if;
  return new;
end $$;


--
-- Name: push_on_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.push_on_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform call_send_push(jsonb_build_object('type', 'notification', 'id', new.id));
  return new;
end $$;


--
-- Name: rate_check(integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rate_check(p_count integer, p_max integer, p_what text) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  if p_count >= p_max then
    raise exception 'For mange %. Vent litt og prøv igjen.', p_what
      using errcode = 'check_violation';
  end if;
end $$;


--
-- Name: refresh_youth_age(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_youth_age(p_profile uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_birth date; v_age int;
begin
  select birth_date into v_birth from profile_private where profile_id = p_profile;
  v_age := case when v_birth is null then null else extract(year from age(now(), v_birth))::int end;
  update profiles set youth_age = case when v_age is not null and v_age < 18 then v_age end
   where id = p_profile
     and youth_age is distinct from case when v_age is not null and v_age < 18 then v_age end;
end $$;


--
-- Name: register_push_token(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_push_token(p_token text, p_platform text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception 'Ikke innlogget.'; end if;
  if coalesce(p_token, '') = '' then return; end if;
  insert into push_tokens (token, profile_id, platform, updated_at)
    values (p_token, auth.uid(), case when p_platform in ('ios','android','web') then p_platform else 'ios' end, now())
  on conflict (token) do update
    set profile_id = excluded.profile_id, platform = excluded.platform, updated_at = now();
end $$;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agreement_proposal_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    from_profile_id uuid NOT NULL,
    to_profile_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    reply text,
    replied_at timestamp with time zone,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: reply_to_review(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reply_to_review(p_review_id uuid, p_text text) RETURNS public.reviews
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r reviews; v_text text := trim(coalesce(p_text, ''));
begin
  select * into r from reviews where id = p_review_id for update;
  if not found or r.to_profile_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = auth.uid() and suspended_at is not null) then
    raise exception 'Kontoen din er suspendert. Kontakt MinNabo.' using errcode = '42501';
  end if;
  if length(v_text) < 2 then raise exception 'Skriv et svar.'; end if;
  if length(v_text) > 400 then raise exception 'Svaret kan ha høyst 400 tegn.'; end if;
  update reviews set reply = v_text, replied_at = now() where id = r.id returning * into r;
  return r;
end $$;


--
-- Name: report_no_show(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.report_no_show(p_agreement_proposal_id uuid, p_profile_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into no_show_reports (agreement_proposal_id, reporter_id, reported_id)
  values (p_agreement_proposal_id, auth.uid(), p_profile_id)
  on conflict (agreement_proposal_id, reporter_id) do nothing;
end;
$$;


--
-- Name: report_target_owner(public.report_target, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.report_target_owner(p_type public.report_target, p_id text) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v uuid;
begin
  case p_type::text
    when 'USER' then v := p_id::uuid;
    when 'LISTING' then select owner_id into v from listings where id::text = p_id;
    when 'MESSAGE' then select author_id into v from messages where id::text = p_id;
    when 'REVIEW' then select from_profile_id into v from reviews where id::text = p_id;
    when 'PROPOSAL' then select from_profile_id into v from proposals where id::text = p_id;
    when 'NOTICE' then select author_id into v from noticeboard_posts where id::text = p_id;
    when 'COMMENT' then select author_id into v from notice_comments where id::text = p_id;
    else v := null;
  end case;
  return v;
exception when invalid_text_representation then return null;
end $$;


--
-- Name: report_target_text(public.report_target, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.report_target_text(p_type public.report_target, p_id text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v text;
begin
  case p_type::text
    when 'USER' then
      select display_name || coalesce(' · ' || place, '') into v from profiles where id::text = p_id;
    when 'LISTING' then
      select '«' || title || '»' into v from listings where id::text = p_id;
    when 'MESSAGE' then
      select 'Samtale om «' || coalesce(l.title, c.notice_title, 'oppslag') || '» – «' || left(m.text, 120) || '»' into v
        from messages m join conversations c on c.id = m.conversation_id
        left join listings l on l.id = c.listing_id where m.id::text = p_id;
    when 'REVIEW' then
      select 'Vurdering: «' || coalesce(left(comment, 120), rating || ' stjerner') || '»' into v
        from reviews where id::text = p_id;
    when 'PROPOSAL' then
      select 'Tilbud på «' || l.title || '»' || coalesce(' – «' || left(p.message, 120) || '»', '') into v
        from proposals p join listings l on l.id = p.listing_id where p.id::text = p_id;
    when 'NOTICE' then
      select '«' || title || '» på oppslagstavla' || coalesce(' i ' || nullif(place, ''), '') into v
        from noticeboard_posts where id::text = p_id;
    when 'COMMENT' then
      select 'Svar på «' || n.title || '» – «' || left(c.body, 120) || '»' into v
        from notice_comments c join noticeboard_posts n on n.id = c.notice_id where c.id::text = p_id;
    else v := null;
  end case;
  return coalesce(v, 'Innholdet finnes ikke lenger');
end $$;


--
-- Name: request_help_again(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_help_again(p_proposal_id uuid, p_when text DEFAULT NULL::text, p_note text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_me uuid := auth.uid();
  p proposals;
  l listings;
  v_new uuid := gen_random_uuid();
  v_existing uuid;
  v_name text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_when text := nullif(trim(coalesce(p_when, '')), '');
begin
  select * into p from proposals where id = p_proposal_id;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me is distinct from p.to_profile_id then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  select * into l from listings where id = p.listing_id;
  if l.status::text not in ('COMPLETED','REVIEWED') then
    raise exception 'Du kan be om hjelp igjen når oppdraget er fullført.';
  end if;
  if exists (select 1 from profiles where id = p.from_profile_id and (deleted_at is not null or suspended_at is not null)) then
    raise exception 'Denne naboen er ikke lenger på MinNabo.';
  end if;
  if exists (select 1 from blocks b
              where (b.by_profile_id = v_me and b.blocked_profile_id = p.from_profile_id)
                 or (b.by_profile_id = p.from_profile_id and b.blocked_profile_id = v_me)) then
    raise exception 'Du kan ikke sende forespørsler til denne personen.';
  end if;

  -- asked already and still open → the same oppdrag
  select id into v_existing from listings
   where repeat_of = p.id and invited_profile_id = p.from_profile_id
     and status::text in ('PUBLISHED','RECEIVING_OFFERS','ACTIVE')
   limit 1;
  if v_existing is not null then return v_existing; end if;

  insert into listings
    select (jsonb_populate_record(null::listings, to_jsonb(l) || jsonb_build_object(
      'id', v_new, 'status', 'PUBLISHED', 'created_at', now(), 'updated_at', now(),
      'edited_at', null, 'admin_hidden', false,
      'invited_profile_id', p.from_profile_id, 'repeat_of', p.id))).*;

  insert into task_details
    select (jsonb_populate_record(null::task_details, to_jsonb(t) || jsonb_build_object(
      'listing_id', v_new,
      'scheduled_text', v_when,
      'description', coalesce(v_note, t.description)))).*
      from task_details t where t.listing_id = l.id;

  insert into listing_images
    select (jsonb_populate_record(null::listing_images, to_jsonb(i) || jsonb_build_object(
      'id', gen_random_uuid(), 'listing_id', v_new))).*
      from listing_images i where i.listing_id = l.id;

  select split_part(display_name, ' ', 1) into v_name from profiles where id = v_me;
  insert into notifications (profile_id, kind, title, body, route)
    values (p.from_profile_id, 'NEW_MATCH'::text::notification_kind,
            coalesce(v_name, 'En nabo') || ' ber om hjelp igjen',
            '«' || l.title || '» – bare du har fått denne forespørselen.',
            '/oppdrag/' || v_new);
  return v_new;
end $$;


--
-- Name: verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verifications (
    profile_id uuid NOT NULL,
    kind public.verification_kind NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    explanation text DEFAULT ''::text NOT NULL,
    verified_at timestamp with time zone
);


--
-- Name: request_verification(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_verification(p_kind text) RETURNS public.verifications
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v verifications;
begin
  insert into verifications (profile_id, kind, verified, explanation, verified_at)
  values (auth.uid(), p_kind::verification_kind,
    case when p_kind = 'EMAIL' then true else false end,
    case p_kind
      when 'EMAIL' then 'E-postadressen din er bekreftet ved innlogging.'
      when 'PHONE' then 'Telefonverifisering kommer snart.'
      when 'BUSINESS' then 'Bedriftsverifisering behandles manuelt.' end,
    case when p_kind = 'EMAIL' then now() else null end)
  on conflict (profile_id, kind) do update set explanation = excluded.explanation
  returning * into v;
  return v;
end $$;


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_type public.report_target NOT NULL,
    target_id text NOT NULL,
    reason text NOT NULL,
    details text,
    by_profile_id uuid NOT NULL,
    status public.report_status DEFAULT 'OPEN'::public.report_status NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    outcome text,
    undo jsonb,
    attachment_path text,
    claimed_at timestamp with time zone,
    claimed_by text,
    resolved_by_staff text,
    resolution_note text,
    CONSTRAINT reports_outcome_check CHECK ((outcome = ANY (ARRAY['dismiss'::text, 'remove'::text, 'warn'::text])))
);


--
-- Name: resolve_report(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_report(p_report_id uuid) RETURNS public.reports
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r reports;
begin
  if not is_admin() then raise exception 'Kun administratorer.'; end if;
  update reports set status = 'RESOLVED', resolved_by = auth.uid(), resolved_at = now()
   where id = p_report_id returning * into r;
  return r;
end $$;


--
-- Name: respond_agreement_time(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_agreement_time(p_id uuid, p_answer text) RETURNS public.agreement_time_proposals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_me uuid := auth.uid();
  r agreement_time_proposals; p proposals; a agreement_snapshots;
  v_title text; v_name text;
begin
  select * into r from agreement_time_proposals where id = p_id for update;
  if not found then raise exception 'Fant ikke forslaget.'; end if;
  select * into p from proposals where id = r.proposal_id;
  if v_me is null or v_me not in (p.from_profile_id, p.to_profile_id) then
    raise exception 'Ikke tilgang.' using errcode = '42501';
  end if;
  if r.status <> 'PENDING' then raise exception 'Forslaget er allerede besvart.'; end if;
  select title into v_title from listings where id = p.listing_id;
  select split_part(display_name, ' ', 1) into v_name from profiles where id = v_me;

  if p_answer = 'WITHDRAW' then
    if r.proposed_by <> v_me then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
    update agreement_time_proposals set status = 'WITHDRAWN', responded_at = now() where id = r.id returning * into r;
    return r;
  end if;

  if r.proposed_by = v_me then raise exception 'Den andre må svare på forslaget.'; end if;

  if p_answer = 'ACCEPT' then
    select * into a from agreement_snapshots where proposal_id = p.id;
    if a.cancelled_at is not null or p.status::text <> 'ACCEPTED' then raise exception 'Avtalen gjelder ikke lenger.'; end if;
    if r.scheduled_at <= now() then raise exception 'Tidspunktet har passert. Foreslå et nytt.'; end if;
    update agreement_snapshots set scheduled_at = r.scheduled_at, scheduled_text = r.scheduled_text
     where proposal_id = p.id;
    update agreement_time_proposals set status = 'ACCEPTED', responded_at = now() where id = r.id returning * into r;
    insert into notifications (profile_id, kind, title, body, route)
      values (r.proposed_by, 'AGREED_TIME', 'Nytt tidspunkt avtalt',
              coalesce(v_name, 'Den andre') || ' godtok ' || r.scheduled_text || ' for «' || coalesce(v_title, 'oppdraget') || '».',
              '/avtale/' || p.id);
    insert into messages (conversation_id, author_id, kind, text)
      values (p.conversation_id, v_me, 'SYSTEM', 'Nytt tidspunkt avtalt: ' || r.scheduled_text);
  elsif p_answer = 'DECLINE' then
    update agreement_time_proposals set status = 'DECLINED', responded_at = now() where id = r.id returning * into r;
    insert into notifications (profile_id, kind, title, body, route)
      values (r.proposed_by, 'AGREED_TIME', 'Tidspunktet passet ikke',
              coalesce(v_name, 'Den andre') || ' kan ikke ' || r.scheduled_text || '. Avtalen står som før.',
              '/avtale/' || p.id);
  else
    raise exception 'Ukjent svar.';
  end if;
  return r;
end $$;


--
-- Name: respond_to_proposal(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_to_proposal(p_proposal_id uuid, p_event text, p_actor text) RETURNS public.proposals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid := auth.uid(); p proposals; v_next proposal_status;
        v_actor_ok boolean; v_desc text;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found then raise exception 'Fant ikke tilbudet.'; end if;
  if not is_participant(p.conversation_id) then raise exception 'Ikke tilgang.'; end if;

  v_actor_ok := (p_actor = 'PROPOSER' and v_me = p.from_profile_id)
             or (p_actor = 'RECIPIENT' and v_me = p.to_profile_id);
  if not v_actor_ok then raise exception 'Feil rolle for denne handlingen.'; end if;

  v_next := proposal_next(p.status, p_event, p_actor);
  update proposals set status = v_next where id = p.id returning * into p;

  if v_next = 'ACCEPTED' then
    select coalesce(td.description, so.about, l.title) into v_desc
      from listings l
      left join task_details td on td.listing_id = l.id
      left join service_offer_details so on so.listing_id = l.id
     where l.id = p.listing_id;
    insert into agreement_snapshots (proposal_id, listing_id, price_amount_minor,
        price_currency, scheduled_text, description, caveats)
      values (p.id, p.listing_id, p.price_amount_minor, p.price_currency,
        p.scheduled_text, coalesce(v_desc,''), p.caveats)
      on conflict (proposal_id) do update set
        price_amount_minor = excluded.price_amount_minor,
        scheduled_text = excluded.scheduled_text, caveats = excluded.caveats,
        agreed_at = now();
    update listings set status = 'AGREED' where id = p.listing_id;
    insert into messages (conversation_id, author_id, kind, text)
      values (p.conversation_id, v_me, 'SYSTEM', 'Tilbud godtatt');
    perform notify(p.from_profile_id, 'OFFER_ACCEPTED', 'Tilbud godtatt',
      'Tilbudet ditt ble godtatt.', '/avtale/' || p.id);
  elsif v_next = 'DECLINED' then
    perform notify(p.from_profile_id, 'OFFER_DECLINED', 'Tilbud avslått',
      'Tilbudet ditt ble avslått.', '/chat/' || p.conversation_id);
  elsif v_next = 'WITHDRAWN' then
    perform notify(p.to_profile_id, 'OFFER_WITHDRAWN', 'Tilbud trukket',
      'Et tilbud ble trukket tilbake.', '/chat/' || p.conversation_id);
  elsif v_next = 'REVISION_PENDING' then
    perform notify(p.from_profile_id, 'OFFER_CHANGED', 'Endring ønsket',
      'Mottakeren ba om en endring.', '/tilbud/' || p.id);
  end if;
  return p;
end $$;


--
-- Name: review_notify(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_notify() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into notifications (profile_id, kind, title, body, route)
    values (new.to_profile_id, 'REVIEW_RECEIVED', 'Ny vurdering',
            'Du har fått en vurdering. Den vises når dere begge har vurdert, eller når fristen går ut.',
            '/profil?fane=vurderinger');
  return new;
end $$;


--
-- Name: revise_proposal(uuid, text, bigint, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revise_proposal(p_proposal_id uuid, p_note text, p_price_minor bigint, p_scheduled_text text, p_caveats text) RETURNS public.proposals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid := auth.uid(); p proposals;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found then raise exception 'Fant ikke tilbudet.'; end if;
  if not is_participant(p.conversation_id) then raise exception 'Ikke tilgang.'; end if;

  if v_me = p.to_profile_id then
    p := respond_to_proposal(p_proposal_id, 'REQUEST_REVISION', 'RECIPIENT');
    insert into proposal_revisions (proposal_id, actor_id, note)
      values (p.id, v_me, nullif(p_note,''));
    insert into messages (conversation_id, author_id, kind, text)
      values (p.conversation_id, v_me, 'TEXT',
              coalesce(nullif(p_note,''),'Kan vi endre litt på tilbudet?'));
  elsif v_me = p.from_profile_id then
    update proposals set
      price_amount_minor = coalesce(p_price_minor, price_amount_minor),
      scheduled_text = coalesce(nullif(p_scheduled_text,''), scheduled_text),
      caveats = coalesce(nullif(p_caveats,''), caveats)
    where id = p.id;
    p := respond_to_proposal(p_proposal_id, 'SUBMIT_REVISION', 'PROPOSER');
    insert into proposal_revisions (proposal_id, actor_id, note, price_amount_minor,
        scheduled_text, caveats)
      values (p.id, v_me, nullif(p_note,''), p_price_minor,
              nullif(p_scheduled_text,''), nullif(p_caveats,''));
    insert into messages (conversation_id, author_id, kind, proposal_id, text)
      values (p.conversation_id, v_me, 'PROPOSAL', p.id, '');
  else
    raise exception 'Ikke tilgang.';
  end if;
  return p;
end $$;


--
-- Name: send_agreement_reminders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_agreement_reminders() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  a record;
  v_n int := 0;
  v_now_local timestamp := now() at time zone 'Europe/Oslo';
  v_local timestamp;
  v_clock text;
  v_days int;
begin
  -- the evening before + about an hour before
  for a in
    select s.proposal_id, s.scheduled_at, p.from_profile_id, p.to_profile_id, l.title
      from agreement_snapshots s
      join proposals p on p.id = s.proposal_id
      join listings l on l.id = s.listing_id
     where s.cancelled_at is null and p.status::text = 'ACCEPTED'
       and s.scheduled_at is not null
       and s.scheduled_at > now() + interval '10 minutes'
       and s.scheduled_at < now() + interval '36 hours'
  loop
    v_local := a.scheduled_at at time zone 'Europe/Oslo';
    v_clock := to_char(v_local, 'HH24:MI');

    if a.scheduled_at <= now() + interval '65 minutes' then
      insert into agreement_reminders (proposal_id, kind, for_time)
        values (a.proposal_id, 'HOUR', a.scheduled_at) on conflict do nothing;
      if found then
        insert into notifications (profile_id, kind, title, body, route)
          select x, 'AGREED_TIME', 'Snart tid for oppdraget',
                 '«' || a.title || '» starter kl. ' || v_clock || '.', '/avtale/' || a.proposal_id
            from unnest(array[a.from_profile_id, a.to_profile_id]) x;
        v_n := v_n + 1;
      end if;
    elsif v_local::date = v_now_local::date + 1 and extract(hour from v_now_local) >= 18 then
      insert into agreement_reminders (proposal_id, kind, for_time)
        values (a.proposal_id, 'EVE', a.scheduled_at) on conflict do nothing;
      if found then
        insert into notifications (profile_id, kind, title, body, route)
          select x, 'AGREED_TIME', 'Husk avtalen i morgen',
                 '«' || a.title || '» i morgen kl. ' || v_clock || '.', '/avtale/' || a.proposal_id
            from unnest(array[a.from_profile_id, a.to_profile_id]) x;
        v_n := v_n + 1;
      end if;
    end if;
  end loop;

  -- a repeating oppdrag: two days before the next round is due, the poster is asked
  for a in
    select s.proposal_id, p.to_profile_id, p.from_profile_id, l.title, t.recurrence::text as recurrence,
           max(c.confirmed_at) as done_at,
           (select split_part(display_name, ' ', 1) from profiles where id = p.from_profile_id) as helper
      from agreement_snapshots s
      join proposals p on p.id = s.proposal_id
      join listings l on l.id = s.listing_id
      join task_details t on t.listing_id = l.id
      join completion_confirmations c on c.agreement_proposal_id = s.proposal_id
     where t.recurrence is not null and s.cancelled_at is null
       and l.status::text in ('COMPLETED','REVIEWED')
     group by s.proposal_id, p.to_profile_id, p.from_profile_id, l.title, t.recurrence
    having count(*) >= 2 and max(c.confirmed_at) > now() - interval '45 days'
  loop
    v_days := case a.recurrence when 'WEEKLY' then 7 when 'BIWEEKLY' then 14 else 30 end;
    if a.done_at + make_interval(days => v_days - 2) <= now()
       and extract(hour from v_now_local) between 9 and 20
       and not exists (select 1 from listings x where x.repeat_of = a.proposal_id) then
      insert into agreement_reminders (proposal_id, kind, for_time)
        values (a.proposal_id, 'REPEAT', a.done_at) on conflict do nothing;
      if found then
        insert into notifications (profile_id, kind, title, body, route)
          values (a.to_profile_id, 'AGREED_TIME', 'Tid for neste gang?',
                  '«' || a.title || '» ' ||
                  case a.recurrence when 'WEEKLY' then 'gjentas hver uke' when 'BIWEEKLY' then 'gjentas annenhver uke' else 'gjentas hver måned' end ||
                  '. Be ' || coalesce(a.helper, 'naboen') || ' om hjelp igjen.',
                  '/avtale/' || a.proposal_id);
        v_n := v_n + 1;
      end if;
    end if;
  end loop;
  return v_n;
end $$;


--
-- Name: send_proposal(uuid, uuid, bigint, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_proposal(p_conversation_id uuid, p_listing_id uuid, p_price_minor bigint, p_message text, p_scheduled_text text, p_caveats text, p_client_token text) RETURNS public.proposals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid := auth.uid(); v_owner uuid; v_to uuid; v_prop proposals; v_recent int;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;

  select * into v_prop from proposals where client_token = p_client_token;
  if found then return v_prop; end if;

  if not is_participant(p_conversation_id) then
    raise exception 'Du er ikke deltaker i denne samtalen.'; end if;

  select owner_id into v_owner from listings where id = p_listing_id;
  select profile_id into v_to from conversation_participants
   where conversation_id = p_conversation_id and profile_id <> v_me limit 1;

  if v_me = v_owner then
    raise exception 'Eieren av oppføringen kan ikke sende tilbud på den.'; end if;

  select count(*) into v_recent from proposals
   where from_profile_id = v_me and created_at > now() - interval '1 minute';
  perform rate_check(v_recent, 5, 'tilbud');

  insert into proposals (listing_id, conversation_id, from_profile_id, to_profile_id,
      price_amount_minor, message, scheduled_text, caveats, status, client_token)
    values (p_listing_id, p_conversation_id, v_me, v_to,
      p_price_minor, nullif(p_message,''), nullif(p_scheduled_text,''),
      nullif(p_caveats,''), 'SENT', p_client_token)
    returning * into v_prop;

  insert into messages (conversation_id, author_id, kind, proposal_id, text)
    values (p_conversation_id, v_me, 'PROPOSAL', v_prop.id, '');

  perform notify(v_to, 'NEW_OFFER', 'Nytt tilbud',
    'Du har fått et nytt tilbud.', '/tilbud/' || v_prop.id);
  return v_prop;
end $$;


--
-- Name: set_conversation_muted(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_conversation_muted(p_conversation_id uuid, p_muted boolean) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update conversation_participants set muted = p_muted
   where conversation_id = p_conversation_id and profile_id = auth.uid();
$$;


--
-- Name: set_proposal_extras(uuid, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_proposal_extras(p_proposal_id uuid, p_scheduled_at timestamp with time zone, p_duration_text text) RETURNS public.proposals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare p proposals;
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found or p.from_profile_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if p.status not in ('SENT','REVISION_PENDING') then raise exception 'Tilbudet kan ikke endres nå.'; end if;
  update proposals set scheduled_at = p_scheduled_at, duration_text = nullif(trim(p_duration_text), '')
   where id = p.id returning * into p;
  return p;
end $$;


--
-- Name: set_report_attachment(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_report_attachment(p_report_id uuid, p_path text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if p_path is null or split_part(p_path, '/', 1) <> auth.uid()::text then
    raise exception 'Ugyldig vedlegg.' using errcode = '42501';
  end if;
  update reports set attachment_path = p_path
   where id = p_report_id and by_profile_id = auth.uid();
  if not found then raise exception 'Fant ikke rapporten.'; end if;
end $$;


--
-- Name: setting_int(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.setting_int(p_key text, p_default integer) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = p_key), p_default)
$$;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_preview text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notice_id uuid,
    notice_title text,
    notice_place text
);


--
-- Name: start_conversation_for_listing(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_conversation_for_listing(p_listing_id uuid) RETURNS public.conversations
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_owner uuid; v_me uuid := auth.uid(); v_conv conversations;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  select owner_id into v_owner from listings where id = p_listing_id;
  if v_owner is null then raise exception 'Fant ikke oppføringen.'; end if;
  if v_owner = v_me then raise exception 'Du kan ikke kontakte deg selv.'; end if;

  select c.* into v_conv from conversations c
    join conversation_participants a on a.conversation_id = c.id and a.profile_id = v_me
    join conversation_participants b on b.conversation_id = c.id and b.profile_id = v_owner
   where c.listing_id = p_listing_id limit 1;
  if found then return v_conv; end if;

  insert into conversations (listing_id) values (p_listing_id) returning * into v_conv;
  insert into conversation_participants (conversation_id, profile_id)
    values (v_conv.id, v_me), (v_conv.id, v_owner);
  return v_conv;
end $$;


--
-- Name: start_conversation_for_notice(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_conversation_for_notice(p_notice_id uuid) RETURNS public.conversations
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n noticeboard_posts; v_me uuid := auth.uid(); v_conv conversations;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  if is_youth(v_me) then
    raise exception 'Dette er ikke tilgjengelig for ungdomskontoer.' using errcode = '42501';
  end if;
  select * into n from noticeboard_posts where id = p_notice_id and hidden_at is null;
  if not found then raise exception 'Fant ikke oppslaget.'; end if;
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


--
-- Name: business_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_profiles (
    profile_id uuid NOT NULL,
    org_nr text NOT NULL,
    company_name text NOT NULL,
    contact_person text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    status public.business_status DEFAULT 'PENDING'::public.business_status NOT NULL,
    category_slugs text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    rejection_reason text,
    decided_by_staff text
);


--
-- Name: submit_business_profile(text, text, text, text, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_business_profile(p_org_nr text, p_company_name text, p_contact_person text, p_email text, p_phone text, p_category_slugs text[]) RETURNS public.business_profiles
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare b business_profiles;
begin
  insert into business_profiles (profile_id, org_nr, company_name, contact_person,
      email, phone, category_slugs, status)
    values (auth.uid(), p_org_nr, p_company_name, p_contact_person, p_email, p_phone,
      coalesce(p_category_slugs,'{}'), 'PENDING')
  on conflict (profile_id) do update set
    org_nr = excluded.org_nr, company_name = excluded.company_name,
    contact_person = excluded.contact_person, email = excluded.email,
    phone = excluded.phone, category_slugs = excluded.category_slugs,
    status = 'PENDING', decided_at = null, created_at = now()
  returning * into b;
  return b;
end $$;


--
-- Name: submit_report(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_report(p_target_type text, p_target_id text, p_reason text, p_details text) RETURNS public.reports
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid := auth.uid(); v_recent int; r reports;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  select count(*) into v_recent from reports
   where by_profile_id = v_me and created_at > now() - interval '1 minute';
  perform rate_check(v_recent, 3, 'rapporter');
  insert into reports (target_type, target_id, reason, details, by_profile_id)
    values (p_target_type::report_target, p_target_id, p_reason, nullif(p_details,''), v_me)
  returning * into r;
  return r;
end $$;


--
-- Name: submit_review(uuid, integer, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_review(p_agreement_proposal_id uuid, p_rating integer, p_comment text, p_tags text[] DEFAULT '{}'::text[]) RETURNS public.reviews
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_me uuid := auth.uid(); p proposals; v_to uuid; v_done int; v_row reviews;
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

  v_to := case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end;
  insert into reviews (agreement_proposal_id, listing_id, from_profile_id, to_profile_id, rating, comment, tags)
  values (p_agreement_proposal_id, p.listing_id, v_me, v_to, p_rating, nullif(p_comment, ''), coalesce(p_tags, '{}'))
  returning * into v_row;

  update listings set status = 'REVIEWED' where id = p.listing_id and status = 'COMPLETED';
  return v_row;
end $$;


--
-- Name: sync_suspension_ban(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_suspension_ban() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
begin
  if new.suspended_at is distinct from old.suspended_at then
    update auth.users
       set banned_until = case when new.suspended_at is not null then 'infinity'::timestamptz end
     where id = new.id;
    if new.suspended_at is not null then
      -- end existing sessions so refresh tokens stop working right away
      delete from auth.refresh_tokens where user_id = new.id::text;
      delete from auth.sessions where user_id = new.id;
    end if;
  end if;
  return new;
end $$;


--
-- Name: toggle_endorsement(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_endorsement(p_target_id uuid, p_skill text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if exists (
    select 1 from skill_endorsements
    where target_id = p_target_id and endorser_id = auth.uid() and skill = p_skill
  ) then
    delete from skill_endorsements
    where target_id = p_target_id and endorser_id = auth.uid() and skill = p_skill;
  else
    insert into skill_endorsements (target_id, endorser_id, skill)
    values (p_target_id, auth.uid(), p_skill);
  end if;
end;
$$;


--
-- Name: toggle_follow(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_follow(p_followed_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if exists (select 1 from follows where follower_id = auth.uid() and followed_id = p_followed_id) then
    delete from follows where follower_id = auth.uid() and followed_id = p_followed_id;
  else
    insert into follows (follower_id, followed_id) values (auth.uid(), p_followed_id);
  end if;
end;
$$;


--
-- Name: toggle_message_reaction(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_message_reaction(p_message_id uuid, p_emoji text, p_profile_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_conversation uuid;
  v_members uuid[];
  v_current jsonb;
  v_people jsonb;
begin
  select conversation_id into v_conversation from messages where id = p_message_id;
  if v_conversation is null then
    raise exception 'Fant ikke meldingen.';
  end if;

  select array_agg(profile_id) into v_members
  from conversation_participants where conversation_id = v_conversation;

  if not (p_profile_id = any (v_members)) then
    raise exception 'Ikke tilgang.';
  end if;

  select reactions into v_current from messages where id = p_message_id for update;
  v_people := coalesce(v_current -> p_emoji, '[]'::jsonb);

  if v_people @> to_jsonb(p_profile_id::text) then
    v_people := (select coalesce(jsonb_agg(x), '[]'::jsonb)
                 from jsonb_array_elements(v_people) x
                 where x <> to_jsonb(p_profile_id::text));
  else
    v_people := v_people || to_jsonb(p_profile_id::text);
  end if;

  if jsonb_array_length(v_people) = 0 then
    v_current := v_current - p_emoji;
  else
    v_current := jsonb_set(v_current, array[p_emoji], v_people, true);
  end if;

  update messages set reactions = v_current where id = p_message_id;
  return v_current;
end;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end $$;


--
-- Name: unregister_push_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unregister_push_token(p_token text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  delete from push_tokens where token = p_token and profile_id = auth.uid();
$$;


--
-- Name: update_job_workspace(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_job_workspace(p_proposal_id uuid, p_action jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_kind text := p_action ->> 'kind';
  v_ws job_workspaces;
  v_who text := nullif(p_action ->> 'who', '');
  v_payer text := coalesce(nullif(p_action ->> 'payer', ''), 'CLIENT');
  v_phase text := coalesce(nullif(p_action ->> 'phase', ''), 'DURING');
begin
  if not exists (select 1 from proposals p
                  where p.id = p_proposal_id
                    and (p.from_profile_id = auth.uid() or p.to_profile_id = auth.uid())) then
    raise exception 'Ikke tilgang.' using errcode = '42501';
  end if;
  if v_who is not null and v_who not in ('CLIENT','HELPER') then v_who := null; end if;
  if v_payer not in ('CLIENT','HELPER','HELPER_OUTLAY') then v_payer := 'CLIENT'; end if;
  if v_phase not in ('BEFORE','AFTER','DURING') then v_phase := 'DURING'; end if;

  insert into job_workspaces (proposal_id) values (p_proposal_id)
  on conflict (proposal_id) do nothing;
  select * into v_ws from job_workspaces where proposal_id = p_proposal_id for update;

  if v_kind = 'addChecklist' then
    update job_workspaces set checklist = checklist || jsonb_strip_nulls(jsonb_build_object(
      'id', gen_random_uuid(), 'text', p_action ->> 'text', 'done', false, 'who', v_who))
      where proposal_id = p_proposal_id;
  elsif v_kind = 'setChecklistWho' then
    update job_workspaces set checklist = (
      select coalesce(jsonb_agg(case when c ->> 'id' = p_action ->> 'itemId'
        then jsonb_strip_nulls((c - 'who') || jsonb_build_object('who', v_who)) else c end), '[]'::jsonb)
      from jsonb_array_elements(checklist) c)
      where proposal_id = p_proposal_id;
  elsif v_kind = 'toggleChecklist' then
    update job_workspaces set checklist = (
      select coalesce(jsonb_agg(case when c ->> 'id' = p_action ->> 'itemId'
        then jsonb_set(c, '{done}', to_jsonb(not (c ->> 'done')::boolean)) else c end), '[]'::jsonb)
      from jsonb_array_elements(checklist) c)
      where proposal_id = p_proposal_id;
  elsif v_kind = 'removeChecklist' then
    update job_workspaces set checklist = (
      select coalesce(jsonb_agg(c), '[]'::jsonb) from jsonb_array_elements(checklist) c
      where c ->> 'id' <> p_action ->> 'itemId')
      where proposal_id = p_proposal_id;
  elsif v_kind = 'addMaterial' then
    update job_workspaces set materials = materials || jsonb_build_object(
      'id', gen_random_uuid(), 'label', p_action ->> 'label',
      'amountKr', coalesce((p_action ->> 'amountKr')::numeric, 0), 'payer', v_payer)
      where proposal_id = p_proposal_id;
  elsif v_kind = 'removeMaterial' then
    update job_workspaces set materials = (
      select coalesce(jsonb_agg(m), '[]'::jsonb) from jsonb_array_elements(materials) m
      where m ->> 'id' <> p_action ->> 'itemId')
      where proposal_id = p_proposal_id;
  elsif v_kind = 'addPhoto' then
    update job_workspaces set photos = photos || jsonb_strip_nulls(jsonb_build_object(
      'id', gen_random_uuid(), 'url', p_action ->> 'url', 'phase', v_phase,
      'caption', nullif(trim(p_action ->> 'caption'), ''), 'at', now()))
      where proposal_id = p_proposal_id;
  elsif v_kind = 'removePhoto' then
    update job_workspaces set photos = (
      select coalesce(jsonb_agg(p), '[]'::jsonb) from jsonb_array_elements(photos) p
      where p ->> 'id' <> p_action ->> 'itemId')
      where proposal_id = p_proposal_id;
  elsif v_kind = 'toggleTimer' then
    if v_ws.timer_started_at is null then
      -- start / continue: a running pause ends here
      update job_workspaces set
        timer_started_at = now(),
        first_started_at = coalesce(first_started_at, now()),
        paused_ms = paused_ms + case when paused_at is null then 0
                                     else (extract(epoch from (now() - paused_at)) * 1000)::bigint end,
        paused_at = null,
        timer_stopped_at = null
        where proposal_id = p_proposal_id;
    else
      -- pause
      update job_workspaces set
        timer_accum_ms = timer_accum_ms + (extract(epoch from (now() - v_ws.timer_started_at)) * 1000)::bigint,
        timer_started_at = null,
        paused_at = now()
        where proposal_id = p_proposal_id;
    end if;
  elsif v_kind = 'stopTimer' then
    update job_workspaces set
      timer_accum_ms = timer_accum_ms + case when timer_started_at is null then 0
                         else (extract(epoch from (now() - timer_started_at)) * 1000)::bigint end,
      timer_started_at = null,
      paused_ms = paused_ms + case when paused_at is null then 0
                                   else (extract(epoch from (now() - paused_at)) * 1000)::bigint end,
      paused_at = null,
      timer_stopped_at = now()
      where proposal_id = p_proposal_id;
  end if;

  update job_workspaces set updated_at = now() where proposal_id = p_proposal_id;
end;
$$;


--
-- Name: update_listing(uuid, text, text, public.price_mode, bigint, text, text, text, text, text, text, text, jsonb, text[], text, integer, bigint, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_listing(p_listing_id uuid, p_title text, p_category_slug text, p_price_mode public.price_mode, p_price_minor bigint, p_municipality text, p_place text, p_description text, p_equipment text, p_meeting_note text, p_duration_text text, p_scheduled_text text, p_intake jsonb, p_images text[], p_offer_audience text, p_max_distance_km integer, p_private_estimate_minor bigint, p_estimated_minutes integer, p_wizard jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare l listings; v_offerer uuid;
begin
  select * into l from listings where id = p_listing_id for update;
  if not found or l.owner_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if l.status not in ('DRAFT','PUBLISHED','RECEIVING_OFFERS','ACTIVE','PAUSED','EXPIRED') then
    raise exception 'Oppdraget kan ikke endres etter at et tilbud er godtatt.';
  end if;
  if length(trim(p_title)) < 5 then raise exception 'Tittelen må ha minst 5 tegn.'; end if;

  update listings set
    title = trim(p_title),
    category_slug = p_category_slug,
    price_mode = p_price_mode,
    price_amount_minor = p_price_minor,
    municipality = p_municipality,
    place = p_place,
    offer_audience = coalesce(p_offer_audience, 'ALL'),
    max_distance_km = p_max_distance_km,
    estimated_minutes = p_estimated_minutes,
    status = case when l.status = 'EXPIRED' then 'PUBLISHED'::listing_status else l.status end,
    edited_at = now(),
    updated_at = now()
  where id = p_listing_id;

  insert into task_details (listing_id, description, equipment, meeting_note, duration_text,
      scheduled_text, intake, wizard)
    values (p_listing_id, p_description, nullif(p_equipment,''), nullif(p_meeting_note,''),
      nullif(p_duration_text,''), nullif(p_scheduled_text,''), coalesce(p_intake,'[]'::jsonb), p_wizard)
  on conflict (listing_id) do update set
    description = excluded.description, equipment = excluded.equipment,
    meeting_note = excluded.meeting_note, duration_text = excluded.duration_text,
    scheduled_text = excluded.scheduled_text, intake = excluded.intake, wizard = excluded.wizard;

  insert into listing_private (listing_id, private_estimate_minor)
    values (p_listing_id, p_private_estimate_minor)
  on conflict (listing_id) do update set private_estimate_minor = excluded.private_estimate_minor;

  if p_images is not null then
    delete from listing_images where listing_id = p_listing_id
      and not (storage_path = any(p_images));
    update listing_images li set ord = x.ord - 1
      from unnest(p_images) with ordinality as x(path, ord)
     where li.listing_id = p_listing_id and li.storage_path = x.path;
    insert into listing_images (listing_id, storage_path, ord)
      select p_listing_id, x.path, x.ord - 1 from unnest(p_images) with ordinality as x(path, ord)
       where not exists (select 1 from listing_images li
                          where li.listing_id = p_listing_id and li.storage_path = x.path);
  end if;

  -- Everyone with an open offer hears about the change.
  for v_offerer in
    select distinct from_profile_id from proposals
     where listing_id = p_listing_id and status in ('SENT','REVISION_PENDING')
  loop
    perform notify(v_offerer, 'OFFER_CHANGED', 'Oppdraget er endret',
      '«' || trim(p_title) || '» er oppdatert. Sjekk at tilbudet ditt fortsatt passer.',
      '/oppdrag/' || p_listing_id);
  end loop;
end $$;


--
-- Name: youth_message_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.youth_message_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and new.author_id = auth.uid() and new.kind::text <> 'SYSTEM'
     and is_youth(auth.uid())
     and not exists (select 1 from proposals p
                      where p.conversation_id = new.conversation_id
                        and p.from_profile_id = auth.uid()) then
    raise exception 'Gi et tilbud først – da kan dere skrive sammen.' using errcode = '42501';
  end if;
  return new;
end $$;


--
-- Name: youth_role_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.youth_role_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.role = 'admin' and is_youth(new.id) then
    raise exception 'En ungdomskonto kan ikke være administrator.';
  end if;
  return new;
end $$;


--
-- Name: account_deletions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_deletions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log (
    id bigint NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    actor_id text,
    actor_email text,
    actor_role text,
    action text NOT NULL,
    target_type text,
    target_id text,
    before jsonb,
    after jsonb,
    ip inet,
    user_agent text
);


--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_audit_log_id_seq OWNED BY public.admin_audit_log.id;


--
-- Name: agreement_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agreement_reminders (
    proposal_id uuid NOT NULL,
    kind text NOT NULL,
    for_time timestamp with time zone NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agreement_reminders_kind_check CHECK ((kind = ANY (ARRAY['EVE'::text, 'HOUR'::text, 'REPEAT'::text])))
);


--
-- Name: agreement_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agreement_snapshots (
    proposal_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    price_amount_minor bigint NOT NULL,
    price_currency text DEFAULT 'NOK'::text NOT NULL,
    scheduled_text text,
    description text DEFAULT ''::text NOT NULL,
    caveats text,
    agreed_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    scheduled_at timestamp with time zone,
    duration_text text,
    cancelled_by uuid
);


--
-- Name: app_secrets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_secrets (
    key text NOT NULL,
    value text NOT NULL
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text
);


--
-- Name: banned_words; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banned_words (
    word text NOT NULL,
    CONSTRAINT banned_words_word_check CHECK (((word = lower(word)) AND (word ~ '^[a-zæøå]+$'::text)))
);


--
-- Name: blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocks (
    by_profile_id uuid NOT NULL,
    blocked_profile_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    slug text NOT NULL,
    label text NOT NULL,
    icon text NOT NULL,
    web_icon text,
    tile_bg text,
    icon_color text,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clubs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clubs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text,
    kommune text NOT NULL,
    org_nr text,
    active boolean DEFAULT true NOT NULL,
    suggested boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clubs_org_nr_check CHECK ((org_nr ~ '^[0-9]{9}$'::text))
);


--
-- Name: consent_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    terms boolean NOT NULL,
    privacy boolean NOT NULL,
    age boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tips boolean DEFAULT false NOT NULL
);


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind text NOT NULL,
    name text,
    company text,
    email text NOT NULL,
    subject text,
    message text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    handled boolean DEFAULT false NOT NULL,
    handled_by text,
    handled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contact_messages_kind_check CHECK ((kind = ANY (ARRAY['hjelp'::text, 'bedrift'::text, 'presse'::text, 'lag_forslag'::text])))
);


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participants (
    conversation_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    last_read_at timestamp with time zone DEFAULT '1970-01-01 01:00:00+01'::timestamp with time zone NOT NULL,
    muted boolean DEFAULT false NOT NULL,
    last_delivered_at timestamp with time zone DEFAULT '1970-01-01 01:00:00+01'::timestamp with time zone NOT NULL
);


--
-- Name: donation_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donation_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient text NOT NULL,
    amount_kr integer NOT NULL,
    period text NOT NULL,
    transferred_at timestamp with time zone DEFAULT now(),
    club_id uuid,
    status text DEFAULT 'transferred'::text NOT NULL,
    note text,
    reference text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT donation_records_status_check CHECK (((status = ANY (ARRAY['planned'::text, 'transferred'::text])) AND ((status = 'transferred'::text) = (transferred_at IS NOT NULL))))
);


--
-- Name: follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follows (
    follower_id uuid NOT NULL,
    followed_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT follows_check CHECK ((follower_id <> followed_id))
);


--
-- Name: guardian_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guardian_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    youth_id uuid NOT NULL,
    guardian_id uuid,
    code text,
    code_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    linked_at timestamp with time zone
);


--
-- Name: job_workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_workspaces (
    proposal_id uuid NOT NULL,
    checklist jsonb DEFAULT '[]'::jsonb NOT NULL,
    materials jsonb DEFAULT '[]'::jsonb NOT NULL,
    timer_started_at timestamp with time zone,
    timer_accum_ms bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    photos jsonb DEFAULT '[]'::jsonb NOT NULL,
    first_started_at timestamp with time zone,
    paused_at timestamp with time zone,
    paused_ms bigint DEFAULT 0 NOT NULL,
    timer_stopped_at timestamp with time zone
);


--
-- Name: kommune_waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kommune_waitlist (
    profile_id uuid NOT NULL,
    kommune text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kommune_waitlist_kommune_check CHECK (((length(TRIM(BOTH FROM kommune)) >= 2) AND (length(TRIM(BOTH FROM kommune)) <= 60)))
);


--
-- Name: kommuner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kommuner (
    id integer NOT NULL,
    name text NOT NULL,
    region text NOT NULL,
    active boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: kommuner_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kommuner_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kommuner_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kommuner_id_seq OWNED BY public.kommuner.id;


--
-- Name: listing_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    storage_path text NOT NULL,
    ord integer DEFAULT 0 NOT NULL
);


--
-- Name: listing_private; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_private (
    listing_id uuid NOT NULL,
    private_estimate_minor bigint,
    CONSTRAINT listing_private_private_estimate_minor_check CHECK ((private_estimate_minor >= 0))
);


--
-- Name: listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type public.listing_type NOT NULL,
    owner_id uuid NOT NULL,
    title text NOT NULL,
    category_slug text NOT NULL,
    price_amount_minor bigint,
    price_currency text DEFAULT 'NOK'::text NOT NULL,
    price_mode public.price_mode NOT NULL,
    municipality text NOT NULL,
    place text NOT NULL,
    status public.listing_status DEFAULT 'PUBLISHED'::public.listing_status NOT NULL,
    search tsvector,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_hidden boolean DEFAULT false NOT NULL,
    offer_audience text DEFAULT 'ALL'::text NOT NULL,
    max_distance_km integer,
    estimated_minutes integer,
    edited_at timestamp with time zone,
    invited_profile_id uuid,
    repeat_of uuid,
    hidden_reason text,
    hidden_at timestamp with time zone,
    hidden_by text,
    CONSTRAINT listings_estimated_minutes_check CHECK ((estimated_minutes > 0)),
    CONSTRAINT listings_max_distance_km_check CHECK (((max_distance_km >= 1) AND (max_distance_km <= 200))),
    CONSTRAINT listings_offer_audience_check CHECK ((offer_audience = ANY (ARRAY['ALL'::text, 'VERIFIED'::text])))
);


--
-- Name: message_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_reads (
    conversation_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    author_id uuid NOT NULL,
    kind public.message_kind DEFAULT 'TEXT'::public.message_kind NOT NULL,
    text text DEFAULT ''::text NOT NULL,
    proposal_id uuid,
    attachment_path text,
    client_token text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reactions jsonb DEFAULT '{}'::jsonb NOT NULL,
    pinned boolean DEFAULT false NOT NULL
);


--
-- Name: neighbourhood_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.neighbourhood_members (
    neighbourhood_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: neighbourhoods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.neighbourhoods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    place text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    municipality text
);


--
-- Name: news_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    excerpt text,
    body_html text DEFAULT ''::text NOT NULL,
    category text NOT NULL,
    cover_color text DEFAULT '#EDF8D6'::text NOT NULL,
    cover_icon text,
    cover_image text,
    author_name text DEFAULT 'MinNabo-teamet'::text NOT NULL,
    reading_min integer,
    status text DEFAULT 'draft'::text NOT NULL,
    publish_at timestamp with time zone,
    published_at timestamp with time zone,
    show_in_app boolean DEFAULT false NOT NULL,
    partner_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    helpful_yes integer DEFAULT 0 NOT NULL,
    helpful_no integer DEFAULT 0 NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT news_articles_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: news_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.news_public AS
 SELECT id,
    slug,
    title,
    excerpt,
    body_html,
    category,
    cover_color,
    cover_icon,
    cover_image,
    author_name,
    reading_min,
    published_at
   FROM public.news_articles
  WHERE ((status = 'published'::text) AND show_in_app);


--
-- Name: newsletter_subscribers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_subscribers (
    email text NOT NULL,
    topics text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    CONSTRAINT newsletter_subscribers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'unsubscribed'::text])))
);


--
-- Name: no_show_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.no_show_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agreement_proposal_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    reported_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notice_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notice_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notice_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notice_comments_body_check CHECK (((length(TRIM(BOTH FROM body)) >= 1) AND (length(TRIM(BOTH FROM body)) <= 500)))
);


--
-- Name: noticeboard_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.noticeboard_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid NOT NULL,
    kind public.notice_kind DEFAULT 'GENERAL'::public.notice_kind NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    place text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    municipality text DEFAULT ''::text NOT NULL,
    image_path text,
    hidden_at timestamp with time zone,
    done_at timestamp with time zone,
    edited_at timestamp with time zone
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    kind public.notification_kind NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    route text,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: partner_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_accounts (
    partner_id uuid NOT NULL,
    billing_mode text DEFAULT 'stripe'::text NOT NULL,
    org_nr text,
    legal_name text,
    org_form text,
    business_address text,
    contact_name text,
    contact_phone text,
    contact_email text,
    billing_email text,
    invoice_reference text,
    package text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    payment_method text,
    payment_state text DEFAULT 'none'::text NOT NULL,
    payment_due_since timestamp with time zone,
    admin_hidden boolean DEFAULT false NOT NULL,
    admin_hidden_reason text,
    admin_force_visible boolean DEFAULT false NOT NULL,
    paused_at timestamp with time zone,
    approved_at timestamp with time zone,
    approved_by text,
    rejected_reason text,
    stripe_customer_id text,
    stripe_subscription_id text,
    current_period_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    hold_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT partner_accounts_billing_mode_check CHECK ((billing_mode = ANY (ARRAY['stripe'::text, 'free'::text]))),
    CONSTRAINT partner_accounts_check CHECK (((billing_mode = 'free'::text) OR ((org_nr IS NOT NULL) AND (legal_name IS NOT NULL) AND (contact_name IS NOT NULL) AND (contact_email IS NOT NULL)))),
    CONSTRAINT partner_accounts_org_nr_check CHECK ((org_nr ~ '^[0-9]{9}$'::text)),
    CONSTRAINT partner_accounts_package_check CHECK ((package = ANY (ARRAY['stottespiller'::text, 'helt'::text, 'hoved'::text]))),
    CONSTRAINT partner_accounts_payment_method_check CHECK ((payment_method = ANY (ARRAY['card'::text, 'invoice'::text]))),
    CONSTRAINT partner_accounts_payment_state_check CHECK ((payment_state = ANY (ARRAY['none'::text, 'paid'::text, 'upcoming'::text, 'failed'::text, 'overdue'::text, 'cancelled'::text]))),
    CONSTRAINT partner_accounts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_payment'::text, 'pending_approval'::text, 'active'::text, 'paused'::text, 'cancelled'::text, 'rejected'::text])))
);


--
-- Name: partner_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_events (
    id bigint NOT NULL,
    partner_id uuid NOT NULL,
    kind text NOT NULL,
    source text NOT NULL,
    kommune text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT partner_events_kind_check CHECK ((kind = ANY (ARRAY['impression'::text, 'click'::text]))),
    CONSTRAINT partner_events_source_check CHECK ((source = ANY (ARRAY['app'::text, 'web'::text])))
);


--
-- Name: partner_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partner_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partner_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.partner_events_id_seq OWNED BY public.partner_events.id;


--
-- Name: partner_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_invoices (
    stripe_invoice_id text NOT NULL,
    partner_id uuid,
    number text,
    status text NOT NULL,
    collection_method text,
    amount_excl integer NOT NULL,
    vat integer NOT NULL,
    amount_incl integer NOT NULL,
    amount_remaining integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'nok'::text NOT NULL,
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    due_date timestamp with time zone,
    paid_at timestamp with time zone,
    hosted_invoice_url text,
    invoice_pdf text,
    last_payment_error text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: partner_placements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_placements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_id uuid NOT NULL,
    surface text NOT NULL,
    headline text NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: partner_profile_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_profile_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_id uuid NOT NULL,
    changes jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by text,
    CONSTRAINT partner_profile_changes_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: partner_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_reminders (
    id bigint NOT NULL,
    partner_id uuid NOT NULL,
    invoice_id text,
    step text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: partner_reminders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partner_reminders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partner_reminders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.partner_reminders_id_seq OWNED BY public.partner_reminders.id;


--
-- Name: partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    blurb text NOT NULL,
    logo_path text,
    url text,
    municipality text,
    active boolean DEFAULT true NOT NULL,
    local_hero boolean DEFAULT false NOT NULL,
    about text,
    offer text,
    address text,
    phone text,
    email text,
    opening_hours text,
    cover_path text,
    gallery text[] DEFAULT '{}'::text[] NOT NULL,
    category_slug text,
    sort_order integer DEFAULT 0 NOT NULL,
    partner_since date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: partners_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.partners_public AS
 SELECT p.id,
    p.name,
    p.blurb,
    p.url,
    p.logo_path,
    p.cover_path,
    p.municipality,
    k.region,
    p.category_slug,
        CASE
            WHEN (a.partner_id IS NOT NULL) THEN a.package
            WHEN (EXISTS ( SELECT 1
               FROM public.partner_placements pp
              WHERE ((pp.partner_id = p.id) AND (pp.surface = 'fellesskap'::text) AND pp.active))) THEN 'hoved'::text
            WHEN p.local_hero THEN 'helt'::text
            ELSE 'stottespiller'::text
        END AS package,
    p.about,
    p.offer,
    p.address,
    p.phone,
    p.email,
    p.opening_hours,
    p.gallery,
    p.partner_since,
    p.sort_order
   FROM ((public.partners p
     LEFT JOIN public.partner_accounts a ON ((a.partner_id = p.id)))
     LEFT JOIN public.kommuner k ON ((k.name = p.municipality)))
  WHERE public.partner_is_visible(p.id);


--
-- Name: portfolio_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portfolio_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    before_path text,
    after_path text NOT NULL,
    title text NOT NULL,
    place text,
    caption text,
    category_slug text,
    done_at date,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profile_moderation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_moderation (
    profile_id uuid NOT NULL,
    suspended_until timestamp with time zone,
    suspension_reason text,
    warning_count integer DEFAULT 0 NOT NULL,
    last_warned_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text
);


--
-- Name: profile_private; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_private (
    profile_id uuid NOT NULL,
    vipps_sub text,
    full_name text,
    phone text,
    email text,
    birth_date date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profile_ratings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profile_ratings AS
 SELECT to_profile_id AS profile_id,
    round(avg(rating), 1) AS average,
    (count(*))::integer AS count
   FROM public.reviews
  GROUP BY to_profile_id;


--
-- Name: profile_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_settings (
    profile_id uuid NOT NULL,
    email text,
    notification_prefs jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    display_name text DEFAULT 'Nabo'::text NOT NULL,
    avatar_path text,
    initials text DEFAULT 'N'::text NOT NULL,
    presentation text,
    member_since text DEFAULT to_char(now(), 'YYYY'::text) NOT NULL,
    municipality text,
    place text,
    purpose public.purpose DEFAULT 'BOTH'::public.purpose,
    max_distance_km integer DEFAULT 15,
    is_business boolean DEFAULT false NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    onboarded_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    paused boolean DEFAULT false NOT NULL,
    reliability_completed integer DEFAULT 0 NOT NULL,
    reliability_no_shows integer DEFAULT 0 NOT NULL,
    home_notes text,
    portfolio text[] DEFAULT '{}'::text[] NOT NULL,
    phone text,
    suspended_at timestamp with time zone,
    available_for_jobs boolean DEFAULT true NOT NULL,
    category_slugs text[] DEFAULT '{}'::text[] NOT NULL,
    youth_age smallint,
    languages text[] DEFAULT '{}'::text[] NOT NULL,
    has_car boolean DEFAULT false NOT NULL,
    availability_text text,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])))
);


--
-- Name: proposal_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposal_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    note text,
    price_amount_minor bigint,
    scheduled_text text,
    caveats text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: public_listings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_listings AS
 SELECT l.id,
    l.type,
    l.owner_id,
    l.title,
    l.category_slug,
    l.price_amount_minor,
    l.price_currency,
    l.price_mode,
    l.municipality,
    l.place,
    l.status,
    l.search,
    l.created_at,
    l.updated_at
   FROM (public.listings l
     JOIN public.profiles p ON ((p.id = l.owner_id)))
  WHERE (p.paused = false);


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    token text NOT NULL,
    profile_id uuid NOT NULL,
    platform text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_tokens_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])))
);


--
-- Name: safe_trips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.safe_trips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    proposal_id uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    due_at timestamp with time zone NOT NULL,
    checked_in_at timestamp with time zone,
    alerted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: saved_listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_listings (
    profile_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: saved_notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_notices (
    profile_id uuid NOT NULL,
    notice_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: saved_searches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_searches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    name text NOT NULL,
    filter jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort text DEFAULT 'RELEVANCE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    alert boolean DEFAULT false NOT NULL,
    last_run_at timestamp with time zone
);


--
-- Name: service_offer_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_offer_details (
    listing_id uuid NOT NULL,
    about text NOT NULL,
    experience_years integer,
    completed_jobs integer,
    services text[] DEFAULT '{}'::text[] NOT NULL,
    availability_text text,
    equipment_text text,
    max_distance_km integer,
    available_weekdays smallint[] DEFAULT '{}'::smallint[] NOT NULL,
    instant_book boolean DEFAULT false NOT NULL
);


--
-- Name: shared_contacts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.shared_contacts AS
 SELECT id AS profile_id,
    phone
   FROM public.profiles p
  WHERE ((id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.proposals pr
          WHERE ((pr.status = 'ACCEPTED'::public.proposal_status) AND (((pr.from_profile_id = auth.uid()) AND (pr.to_profile_id = p.id)) OR ((pr.to_profile_id = auth.uid()) AND (pr.from_profile_id = p.id)))))));


--
-- Name: skill_endorsements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_endorsements (
    target_id uuid NOT NULL,
    endorser_id uuid NOT NULL,
    skill text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT skill_endorsements_check CHECK ((target_id <> endorser_id))
);


--
-- Name: stripe_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_events (
    id text NOT NULL,
    type text NOT NULL,
    payload jsonb,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    error text
);


--
-- Name: task_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_details (
    listing_id uuid NOT NULL,
    description text NOT NULL,
    equipment text,
    meeting_note text,
    duration_text text,
    scheduled_text text,
    is_dugnad boolean DEFAULT false NOT NULL,
    recurrence public.task_recurrence,
    intake jsonb DEFAULT '[]'::jsonb NOT NULL,
    wizard jsonb
);


--
-- Name: trusted_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trusted_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: visible_reviews; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.visible_reviews AS
 SELECT id,
    agreement_proposal_id,
    listing_id,
    from_profile_id,
    to_profile_id,
    rating,
    comment,
    created_at,
    tags
   FROM public.reviews r
  WHERE (((now() - created_at) > '10 days'::interval) OR (EXISTS ( SELECT 1
           FROM public.reviews x
          WHERE ((x.agreement_proposal_id = r.agreement_proposal_id) AND (x.from_profile_id = r.to_profile_id)))));


--
-- Name: admin_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log ALTER COLUMN id SET DEFAULT nextval('public.admin_audit_log_id_seq'::regclass);


--
-- Name: kommuner id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kommuner ALTER COLUMN id SET DEFAULT nextval('public.kommuner_id_seq'::regclass);


--
-- Name: partner_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_events ALTER COLUMN id SET DEFAULT nextval('public.partner_events_id_seq'::regclass);


--
-- Name: partner_reminders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_reminders ALTER COLUMN id SET DEFAULT nextval('public.partner_reminders_id_seq'::regclass);


--
-- Name: account_deletions account_deletions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_deletions
    ADD CONSTRAINT account_deletions_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: agreement_reminders agreement_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_reminders
    ADD CONSTRAINT agreement_reminders_pkey PRIMARY KEY (proposal_id, kind, for_time);


--
-- Name: agreement_snapshots agreement_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_snapshots
    ADD CONSTRAINT agreement_snapshots_pkey PRIMARY KEY (proposal_id);


--
-- Name: agreement_time_proposals agreement_time_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_time_proposals
    ADD CONSTRAINT agreement_time_proposals_pkey PRIMARY KEY (id);


--
-- Name: app_secrets app_secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_secrets
    ADD CONSTRAINT app_secrets_pkey PRIMARY KEY (key);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: banned_words banned_words_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banned_words
    ADD CONSTRAINT banned_words_pkey PRIMARY KEY (word);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (by_profile_id, blocked_profile_id);


--
-- Name: business_profiles business_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_profiles
    ADD CONSTRAINT business_profiles_pkey PRIMARY KEY (profile_id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (slug);


--
-- Name: clubs clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);


--
-- Name: completion_confirmations completion_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.completion_confirmations
    ADD CONSTRAINT completion_confirmations_pkey PRIMARY KEY (agreement_proposal_id, by_profile_id);


--
-- Name: consent_records consent_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_pkey PRIMARY KEY (id);


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, profile_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: donation_records donation_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_records
    ADD CONSTRAINT donation_records_pkey PRIMARY KEY (id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (follower_id, followed_id);


--
-- Name: guardian_links guardian_links_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_links
    ADD CONSTRAINT guardian_links_code_key UNIQUE (code);


--
-- Name: guardian_links guardian_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_links
    ADD CONSTRAINT guardian_links_pkey PRIMARY KEY (id);


--
-- Name: job_workspaces job_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_workspaces
    ADD CONSTRAINT job_workspaces_pkey PRIMARY KEY (proposal_id);


--
-- Name: kommune_waitlist kommune_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kommune_waitlist
    ADD CONSTRAINT kommune_waitlist_pkey PRIMARY KEY (profile_id, kommune);


--
-- Name: kommuner kommuner_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kommuner
    ADD CONSTRAINT kommuner_name_key UNIQUE (name);


--
-- Name: kommuner kommuner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kommuner
    ADD CONSTRAINT kommuner_pkey PRIMARY KEY (id);


--
-- Name: listing_images listing_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_images
    ADD CONSTRAINT listing_images_pkey PRIMARY KEY (id);


--
-- Name: listing_private listing_private_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_private
    ADD CONSTRAINT listing_private_pkey PRIMARY KEY (listing_id);


--
-- Name: listings listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_pkey PRIMARY KEY (id);


--
-- Name: message_reads message_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_pkey PRIMARY KEY (conversation_id, profile_id);


--
-- Name: messages messages_conversation_id_author_id_client_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_author_id_client_token_key UNIQUE (conversation_id, author_id, client_token);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: neighbourhood_members neighbourhood_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.neighbourhood_members
    ADD CONSTRAINT neighbourhood_members_pkey PRIMARY KEY (neighbourhood_id, profile_id);


--
-- Name: neighbourhoods neighbourhoods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.neighbourhoods
    ADD CONSTRAINT neighbourhoods_pkey PRIMARY KEY (id);


--
-- Name: news_articles news_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_articles
    ADD CONSTRAINT news_articles_pkey PRIMARY KEY (id);


--
-- Name: news_articles news_articles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_articles
    ADD CONSTRAINT news_articles_slug_key UNIQUE (slug);


--
-- Name: newsletter_subscribers newsletter_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (email);


--
-- Name: no_show_reports no_show_reports_agreement_proposal_id_reporter_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.no_show_reports
    ADD CONSTRAINT no_show_reports_agreement_proposal_id_reporter_id_key UNIQUE (agreement_proposal_id, reporter_id);


--
-- Name: no_show_reports no_show_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.no_show_reports
    ADD CONSTRAINT no_show_reports_pkey PRIMARY KEY (id);


--
-- Name: notice_comments notice_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notice_comments
    ADD CONSTRAINT notice_comments_pkey PRIMARY KEY (id);


--
-- Name: noticeboard_posts noticeboard_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.noticeboard_posts
    ADD CONSTRAINT noticeboard_posts_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: partner_accounts partner_accounts_org_nr_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_accounts
    ADD CONSTRAINT partner_accounts_org_nr_key UNIQUE (org_nr);


--
-- Name: partner_accounts partner_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_accounts
    ADD CONSTRAINT partner_accounts_pkey PRIMARY KEY (partner_id);


--
-- Name: partner_accounts partner_accounts_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_accounts
    ADD CONSTRAINT partner_accounts_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: partner_accounts partner_accounts_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_accounts
    ADD CONSTRAINT partner_accounts_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: partner_events partner_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_events
    ADD CONSTRAINT partner_events_pkey PRIMARY KEY (id);


--
-- Name: partner_invoices partner_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_invoices
    ADD CONSTRAINT partner_invoices_pkey PRIMARY KEY (stripe_invoice_id);


--
-- Name: partner_placements partner_placements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_placements
    ADD CONSTRAINT partner_placements_pkey PRIMARY KEY (id);


--
-- Name: partner_profile_changes partner_profile_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_profile_changes
    ADD CONSTRAINT partner_profile_changes_pkey PRIMARY KEY (id);


--
-- Name: partner_reminders partner_reminders_invoice_id_step_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_reminders
    ADD CONSTRAINT partner_reminders_invoice_id_step_key UNIQUE (invoice_id, step);


--
-- Name: partner_reminders partner_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_reminders
    ADD CONSTRAINT partner_reminders_pkey PRIMARY KEY (id);


--
-- Name: partners partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_pkey PRIMARY KEY (id);


--
-- Name: portfolio_items portfolio_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_items
    ADD CONSTRAINT portfolio_items_pkey PRIMARY KEY (id);


--
-- Name: profile_moderation profile_moderation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_moderation
    ADD CONSTRAINT profile_moderation_pkey PRIMARY KEY (profile_id);


--
-- Name: profile_private profile_private_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_private
    ADD CONSTRAINT profile_private_pkey PRIMARY KEY (profile_id);


--
-- Name: profile_private profile_private_vipps_sub_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_private
    ADD CONSTRAINT profile_private_vipps_sub_key UNIQUE (vipps_sub);


--
-- Name: profile_settings profile_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_settings
    ADD CONSTRAINT profile_settings_pkey PRIMARY KEY (profile_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: proposal_revisions proposal_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_revisions
    ADD CONSTRAINT proposal_revisions_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_client_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_client_token_key UNIQUE (client_token);


--
-- Name: proposals proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (token);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_agreement_proposal_id_from_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_agreement_proposal_id_from_profile_id_key UNIQUE (agreement_proposal_id, from_profile_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: safe_trips safe_trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safe_trips
    ADD CONSTRAINT safe_trips_pkey PRIMARY KEY (id);


--
-- Name: saved_listings saved_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_listings
    ADD CONSTRAINT saved_listings_pkey PRIMARY KEY (profile_id, listing_id);


--
-- Name: saved_notices saved_notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_notices
    ADD CONSTRAINT saved_notices_pkey PRIMARY KEY (profile_id, notice_id);


--
-- Name: saved_searches saved_searches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_searches
    ADD CONSTRAINT saved_searches_pkey PRIMARY KEY (id);


--
-- Name: service_offer_details service_offer_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_offer_details
    ADD CONSTRAINT service_offer_details_pkey PRIMARY KEY (listing_id);


--
-- Name: skill_endorsements skill_endorsements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_endorsements
    ADD CONSTRAINT skill_endorsements_pkey PRIMARY KEY (target_id, endorser_id, skill);


--
-- Name: stripe_events stripe_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_events
    ADD CONSTRAINT stripe_events_pkey PRIMARY KEY (id);


--
-- Name: task_details task_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_details
    ADD CONSTRAINT task_details_pkey PRIMARY KEY (listing_id);


--
-- Name: trusted_contacts trusted_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_contacts
    ADD CONSTRAINT trusted_contacts_pkey PRIMARY KEY (id);


--
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (profile_id, kind);


--
-- Name: admin_audit_log_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_log_at_idx ON public.admin_audit_log USING btree (at DESC);


--
-- Name: admin_audit_log_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_log_target_idx ON public.admin_audit_log USING btree (target_type, target_id);


--
-- Name: agreement_time_one_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX agreement_time_one_pending ON public.agreement_time_proposals USING btree (proposal_id) WHERE (status = 'PENDING'::text);


--
-- Name: contact_messages_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contact_messages_kind_idx ON public.contact_messages USING btree (kind, handled, created_at DESC);


--
-- Name: conv_participants_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conv_participants_profile_idx ON public.conversation_participants USING btree (profile_id);


--
-- Name: conversations_listing_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_listing_idx ON public.conversations USING btree (listing_id);


--
-- Name: conversations_notice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_notice_idx ON public.conversations USING btree (notice_id);


--
-- Name: guardian_links_guardian_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guardian_links_guardian_idx ON public.guardian_links USING btree (guardian_id);


--
-- Name: guardian_links_youth_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guardian_links_youth_idx ON public.guardian_links USING btree (youth_id);


--
-- Name: listings_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listings_category_idx ON public.listings USING btree (category_slug);


--
-- Name: listings_invited_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listings_invited_idx ON public.listings USING btree (invited_profile_id) WHERE (invited_profile_id IS NOT NULL);


--
-- Name: listings_municipality_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listings_municipality_idx ON public.listings USING btree (municipality);


--
-- Name: listings_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listings_owner_idx ON public.listings USING btree (owner_id);


--
-- Name: listings_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listings_search_idx ON public.listings USING gin (search);


--
-- Name: listings_type_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listings_type_status_idx ON public.listings USING btree (type, status);


--
-- Name: messages_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation_idx ON public.messages USING btree (conversation_id, created_at);


--
-- Name: messages_one_pin_per_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX messages_one_pin_per_conversation ON public.messages USING btree (conversation_id) WHERE pinned;


--
-- Name: neighbourhoods_area_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX neighbourhoods_area_uidx ON public.neighbourhoods USING btree (municipality, place);


--
-- Name: news_articles_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX news_articles_published_idx ON public.news_articles USING btree (status, published_at DESC);


--
-- Name: notice_comments_notice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notice_comments_notice_idx ON public.notice_comments USING btree (notice_id, created_at);


--
-- Name: noticeboard_posts_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX noticeboard_posts_created_idx ON public.noticeboard_posts USING btree (created_at DESC);


--
-- Name: notifications_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_profile_idx ON public.notifications USING btree (profile_id, created_at DESC);


--
-- Name: partner_accounts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX partner_accounts_status_idx ON public.partner_accounts USING btree (status, package);


--
-- Name: partner_events_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX partner_events_idx ON public.partner_events USING btree (partner_id, created_at);


--
-- Name: partner_invoices_partner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX partner_invoices_partner_idx ON public.partner_invoices USING btree (partner_id, created_at DESC);


--
-- Name: partner_profile_changes_one_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX partner_profile_changes_one_pending ON public.partner_profile_changes USING btree (partner_id) WHERE (status = 'pending'::text);


--
-- Name: portfolio_items_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX portfolio_items_profile_idx ON public.portfolio_items USING btree (profile_id, created_at DESC);


--
-- Name: proposals_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX proposals_conversation_idx ON public.proposals USING btree (conversation_id);


--
-- Name: proposals_listing_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX proposals_listing_idx ON public.proposals USING btree (listing_id);


--
-- Name: proposals_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX proposals_to_idx ON public.proposals USING btree (to_profile_id);


--
-- Name: push_tokens_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_tokens_profile_idx ON public.push_tokens USING btree (profile_id);


--
-- Name: reports_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_status_idx ON public.reports USING btree (status, created_at DESC);


--
-- Name: reviews_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reviews_to_idx ON public.reviews USING btree (to_profile_id);


--
-- Name: safe_trips_one_open_per_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX safe_trips_one_open_per_owner ON public.safe_trips USING btree (owner_id) WHERE (checked_in_at IS NULL);


--
-- Name: business_profiles business_profiles_block_youth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER business_profiles_block_youth BEFORE INSERT ON public.business_profiles FOR EACH ROW EXECUTE FUNCTION public.block_youth_writes();


--
-- Name: listings listings_block_suspended; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER listings_block_suspended BEFORE INSERT ON public.listings FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();


--
-- Name: listings listings_block_youth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER listings_block_youth BEFORE INSERT ON public.listings FOR EACH ROW EXECUTE FUNCTION public.block_youth_writes();


--
-- Name: listings listings_block_youth_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER listings_block_youth_update BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.block_youth_listing_update();


--
-- Name: listings listings_guard_agreement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER listings_guard_agreement BEFORE UPDATE OF status ON public.listings FOR EACH ROW EXECUTE FUNCTION public.listings_guard_agreement();


--
-- Name: listings listings_guard_hidden; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER listings_guard_hidden BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.guard_listing_hidden();


--
-- Name: messages messages_block_suspended; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_block_suspended BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();


--
-- Name: messages messages_respect_blocks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_respect_blocks BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.messages_respect_blocks();


--
-- Name: messages messages_youth_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_youth_guard BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.youth_message_guard();


--
-- Name: neighbourhood_members neighbourhood_members_block_youth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER neighbourhood_members_block_youth BEFORE INSERT ON public.neighbourhood_members FOR EACH ROW EXECUTE FUNCTION public.block_youth_writes();


--
-- Name: notice_comments notice_comments_block_suspended; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notice_comments_block_suspended BEFORE INSERT ON public.notice_comments FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();


--
-- Name: notice_comments notice_comments_block_youth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notice_comments_block_youth BEFORE INSERT ON public.notice_comments FOR EACH ROW EXECUTE FUNCTION public.block_youth_writes();


--
-- Name: noticeboard_posts noticeboard_guard_hidden; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER noticeboard_guard_hidden BEFORE UPDATE ON public.noticeboard_posts FOR EACH ROW EXECUTE FUNCTION public.guard_notice_hidden();


--
-- Name: noticeboard_posts noticeboard_posts_block_suspended; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER noticeboard_posts_block_suspended BEFORE INSERT ON public.noticeboard_posts FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();


--
-- Name: noticeboard_posts noticeboard_posts_block_youth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER noticeboard_posts_block_youth BEFORE INSERT ON public.noticeboard_posts FOR EACH ROW EXECUTE FUNCTION public.block_youth_writes();


--
-- Name: partner_accounts partner_accounts_before; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER partner_accounts_before BEFORE INSERT OR UPDATE ON public.partner_accounts FOR EACH ROW EXECUTE FUNCTION public.partner_accounts_before();


--
-- Name: partner_accounts partner_accounts_bump_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER partner_accounts_bump_version AFTER INSERT OR DELETE OR UPDATE ON public.partner_accounts FOR EACH STATEMENT EXECUTE FUNCTION public.bump_partners_version();


--
-- Name: partner_accounts partner_accounts_sync; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER partner_accounts_sync AFTER INSERT OR UPDATE OF package, status ON public.partner_accounts FOR EACH ROW EXECUTE FUNCTION public.partner_accounts_sync();


--
-- Name: partner_placements partner_placements_bump_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER partner_placements_bump_version AFTER INSERT OR DELETE OR UPDATE ON public.partner_placements FOR EACH STATEMENT EXECUTE FUNCTION public.bump_partners_version();


--
-- Name: partners partners_bump_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER partners_bump_version AFTER INSERT OR DELETE OR UPDATE ON public.partners FOR EACH STATEMENT EXECUTE FUNCTION public.bump_partners_version();


--
-- Name: profiles profiles_deleted_cleanup; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_deleted_cleanup BEFORE UPDATE OF deleted_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profile_deleted_cleanup();


--
-- Name: profiles profiles_guard_moderation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_guard_moderation BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_moderation_columns();


--
-- Name: profiles profiles_suspension_ban; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_suspension_ban AFTER UPDATE OF suspended_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_suspension_ban();


--
-- Name: profiles profiles_youth_role_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_youth_role_guard BEFORE UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.youth_role_guard();


--
-- Name: proposals proposals_accept_open_listing; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER proposals_accept_open_listing BEFORE UPDATE OF status ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.proposals_accept_needs_open_listing();


--
-- Name: proposals proposals_block_suspended; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER proposals_block_suspended BEFORE INSERT ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();


--
-- Name: proposals proposals_offer_audience; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER proposals_offer_audience BEFORE INSERT ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_audience();


--
-- Name: proposals proposals_open_listing; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER proposals_open_listing BEFORE INSERT ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.proposals_need_open_listing();


--
-- Name: reviews reviews_block_suspended; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reviews_block_suspended BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();


--
-- Name: reviews reviews_block_youth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reviews_block_youth BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.block_youth_writes();


--
-- Name: saved_searches saved_searches_block_youth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER saved_searches_block_youth BEFORE INSERT ON public.saved_searches FOR EACH ROW EXECUTE FUNCTION public.block_youth_writes();


--
-- Name: agreement_snapshots t_agreement_cancelled_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_agreement_cancelled_by BEFORE UPDATE OF cancelled_at ON public.agreement_snapshots FOR EACH ROW EXECUTE FUNCTION public.agreement_cancelled_by();


--
-- Name: agreement_snapshots t_agreement_copy_schedule; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_agreement_copy_schedule BEFORE INSERT ON public.agreement_snapshots FOR EACH ROW EXECUTE FUNCTION public.agreement_copy_schedule();


--
-- Name: completion_confirmations t_completed_counter; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_completed_counter AFTER INSERT ON public.completion_confirmations FOR EACH ROW EXECUTE FUNCTION public.bump_completed_counter();


--
-- Name: listings t_listings_rate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_listings_rate BEFORE INSERT ON public.listings FOR EACH ROW EXECUTE FUNCTION public.listings_rate_guard();


--
-- Name: listings t_listings_saved_search_alerts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_listings_saved_search_alerts AFTER INSERT OR UPDATE OF status ON public.listings FOR EACH ROW WHEN ((new.invited_profile_id IS NULL)) EXECUTE FUNCTION public.notify_saved_searches();


--
-- Name: listings t_listings_search; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_listings_search BEFORE INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.listings_search_tsv();


--
-- Name: listings t_listings_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_listings_touch BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: messages t_messages_author_read; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_messages_author_read AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.message_author_read();


--
-- Name: messages t_messages_bump; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_messages_bump AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.bump_conversation();


--
-- Name: messages t_messages_push; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_messages_push AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.push_on_message();


--
-- Name: messages t_messages_rate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_messages_rate BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.message_rate_guard();


--
-- Name: no_show_reports t_no_show_counter; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_no_show_counter AFTER INSERT ON public.no_show_reports FOR EACH ROW EXECUTE FUNCTION public.bump_no_show_counter();


--
-- Name: notice_comments t_notice_comment_added; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_notice_comment_added BEFORE INSERT ON public.notice_comments FOR EACH ROW EXECUTE FUNCTION public.notice_comment_added();


--
-- Name: noticeboard_posts t_notice_touch_edit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_notice_touch_edit BEFORE UPDATE ON public.noticeboard_posts FOR EACH ROW EXECUTE FUNCTION public.notice_touch_edit();


--
-- Name: noticeboard_posts t_notices_rate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_notices_rate BEFORE INSERT ON public.noticeboard_posts FOR EACH ROW EXECUTE FUNCTION public.notices_rate_guard();


--
-- Name: notifications t_notifications_push; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_notifications_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.push_on_notification();


--
-- Name: profile_private t_profile_private_sync; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_profile_private_sync AFTER INSERT OR UPDATE ON public.profile_private FOR EACH ROW EXECUTE FUNCTION public.profile_private_sync();


--
-- Name: profiles t_profiles_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: proposals t_proposal_revision_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_proposal_revision_notify AFTER UPDATE OF status ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.proposal_revision_notify();


--
-- Name: proposals t_proposals_notify_guardians; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_proposals_notify_guardians AFTER UPDATE OF status ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.proposals_notify_guardians();


--
-- Name: proposals t_proposals_notify_others; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_proposals_notify_others AFTER UPDATE OF status ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.proposals_notify_others();


--
-- Name: proposals t_proposals_respect_invite; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_proposals_respect_invite BEFORE INSERT ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.proposals_respect_invite();


--
-- Name: proposals t_proposals_stamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_proposals_stamp BEFORE INSERT OR UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.proposals_stamp();


--
-- Name: proposals t_proposals_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_proposals_touch BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: reviews t_review_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_review_notify AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.review_notify();


--
-- Name: listings t_words_listings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_words_listings BEFORE INSERT OR UPDATE OF title ON public.listings FOR EACH ROW EXECUTE FUNCTION public.block_banned_words('title');


--
-- Name: notice_comments t_words_notice_comments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_words_notice_comments BEFORE INSERT OR UPDATE OF body ON public.notice_comments FOR EACH ROW EXECUTE FUNCTION public.block_banned_words('body');


--
-- Name: noticeboard_posts t_words_notices; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_words_notices BEFORE INSERT OR UPDATE OF title, body ON public.noticeboard_posts FOR EACH ROW EXECUTE FUNCTION public.block_banned_words('title', 'body');


--
-- Name: profiles t_words_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_words_profiles BEFORE UPDATE OF display_name, presentation ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.block_banned_words('display_name', 'presentation');


--
-- Name: reviews t_words_reviews; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_words_reviews BEFORE INSERT OR UPDATE OF comment ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.block_banned_words('comment');


--
-- Name: task_details t_words_task_details; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER t_words_task_details BEFORE INSERT OR UPDATE OF description ON public.task_details FOR EACH ROW EXECUTE FUNCTION public.block_banned_words('description');


--
-- Name: agreement_reminders agreement_reminders_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_reminders
    ADD CONSTRAINT agreement_reminders_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.agreement_snapshots(proposal_id) ON DELETE CASCADE;


--
-- Name: agreement_snapshots agreement_snapshots_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_snapshots
    ADD CONSTRAINT agreement_snapshots_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: agreement_snapshots agreement_snapshots_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_snapshots
    ADD CONSTRAINT agreement_snapshots_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: agreement_snapshots agreement_snapshots_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_snapshots
    ADD CONSTRAINT agreement_snapshots_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: agreement_time_proposals agreement_time_proposals_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_time_proposals
    ADD CONSTRAINT agreement_time_proposals_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.agreement_snapshots(proposal_id) ON DELETE CASCADE;


--
-- Name: agreement_time_proposals agreement_time_proposals_proposed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_time_proposals
    ADD CONSTRAINT agreement_time_proposals_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_blocked_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_blocked_profile_id_fkey FOREIGN KEY (blocked_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_by_profile_id_fkey FOREIGN KEY (by_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: business_profiles business_profiles_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_profiles
    ADD CONSTRAINT business_profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: completion_confirmations completion_confirmations_agreement_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.completion_confirmations
    ADD CONSTRAINT completion_confirmations_agreement_proposal_id_fkey FOREIGN KEY (agreement_proposal_id) REFERENCES public.agreement_snapshots(proposal_id) ON DELETE CASCADE;


--
-- Name: completion_confirmations completion_confirmations_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.completion_confirmations
    ADD CONSTRAINT completion_confirmations_by_profile_id_fkey FOREIGN KEY (by_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: consent_records consent_records_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_notice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_notice_id_fkey FOREIGN KEY (notice_id) REFERENCES public.noticeboard_posts(id) ON DELETE SET NULL;


--
-- Name: donation_records donation_records_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donation_records
    ADD CONSTRAINT donation_records_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;


--
-- Name: follows follows_followed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: guardian_links guardian_links_guardian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_links
    ADD CONSTRAINT guardian_links_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: guardian_links guardian_links_youth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_links
    ADD CONSTRAINT guardian_links_youth_id_fkey FOREIGN KEY (youth_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: job_workspaces job_workspaces_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_workspaces
    ADD CONSTRAINT job_workspaces_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: kommune_waitlist kommune_waitlist_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kommune_waitlist
    ADD CONSTRAINT kommune_waitlist_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: listing_images listing_images_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_images
    ADD CONSTRAINT listing_images_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: listing_private listing_private_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_private
    ADD CONSTRAINT listing_private_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: listings listings_category_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_category_slug_fkey FOREIGN KEY (category_slug) REFERENCES public.categories(slug);


--
-- Name: listings listings_invited_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_invited_profile_id_fkey FOREIGN KEY (invited_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: listings listings_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: listings listings_repeat_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_repeat_of_fkey FOREIGN KEY (repeat_of) REFERENCES public.proposals(id) ON DELETE SET NULL;


--
-- Name: message_reads message_reads_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: message_reads message_reads_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE SET NULL;


--
-- Name: neighbourhood_members neighbourhood_members_neighbourhood_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.neighbourhood_members
    ADD CONSTRAINT neighbourhood_members_neighbourhood_id_fkey FOREIGN KEY (neighbourhood_id) REFERENCES public.neighbourhoods(id) ON DELETE CASCADE;


--
-- Name: neighbourhood_members neighbourhood_members_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.neighbourhood_members
    ADD CONSTRAINT neighbourhood_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: neighbourhoods neighbourhoods_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.neighbourhoods
    ADD CONSTRAINT neighbourhoods_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: no_show_reports no_show_reports_agreement_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.no_show_reports
    ADD CONSTRAINT no_show_reports_agreement_proposal_id_fkey FOREIGN KEY (agreement_proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: no_show_reports no_show_reports_reported_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.no_show_reports
    ADD CONSTRAINT no_show_reports_reported_id_fkey FOREIGN KEY (reported_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: no_show_reports no_show_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.no_show_reports
    ADD CONSTRAINT no_show_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notice_comments notice_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notice_comments
    ADD CONSTRAINT notice_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notice_comments notice_comments_notice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notice_comments
    ADD CONSTRAINT notice_comments_notice_id_fkey FOREIGN KEY (notice_id) REFERENCES public.noticeboard_posts(id) ON DELETE CASCADE;


--
-- Name: noticeboard_posts noticeboard_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.noticeboard_posts
    ADD CONSTRAINT noticeboard_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: partner_accounts partner_accounts_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_accounts
    ADD CONSTRAINT partner_accounts_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE;


--
-- Name: partner_events partner_events_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_events
    ADD CONSTRAINT partner_events_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE;


--
-- Name: partner_invoices partner_invoices_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_invoices
    ADD CONSTRAINT partner_invoices_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL;


--
-- Name: partner_placements partner_placements_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_placements
    ADD CONSTRAINT partner_placements_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE;


--
-- Name: partner_profile_changes partner_profile_changes_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_profile_changes
    ADD CONSTRAINT partner_profile_changes_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE;


--
-- Name: partner_reminders partner_reminders_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_reminders
    ADD CONSTRAINT partner_reminders_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE;


--
-- Name: partners partners_category_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_category_slug_fkey FOREIGN KEY (category_slug) REFERENCES public.categories(slug);


--
-- Name: portfolio_items portfolio_items_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_items
    ADD CONSTRAINT portfolio_items_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profile_moderation profile_moderation_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_moderation
    ADD CONSTRAINT profile_moderation_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profile_private profile_private_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_private
    ADD CONSTRAINT profile_private_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profile_settings profile_settings_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_settings
    ADD CONSTRAINT profile_settings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: proposal_revisions proposal_revisions_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_revisions
    ADD CONSTRAINT proposal_revisions_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: proposal_revisions proposal_revisions_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_revisions
    ADD CONSTRAINT proposal_revisions_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_from_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_from_profile_id_fkey FOREIGN KEY (from_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_to_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_to_profile_id_fkey FOREIGN KEY (to_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: push_tokens push_tokens_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reports reports_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_by_profile_id_fkey FOREIGN KEY (by_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reports reports_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id);


--
-- Name: reviews reviews_agreement_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_agreement_proposal_id_fkey FOREIGN KEY (agreement_proposal_id) REFERENCES public.agreement_snapshots(proposal_id) ON DELETE CASCADE;


--
-- Name: reviews reviews_from_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_from_profile_id_fkey FOREIGN KEY (from_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_to_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_to_profile_id_fkey FOREIGN KEY (to_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: safe_trips safe_trips_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safe_trips
    ADD CONSTRAINT safe_trips_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: safe_trips safe_trips_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safe_trips
    ADD CONSTRAINT safe_trips_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE SET NULL;


--
-- Name: saved_listings saved_listings_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_listings
    ADD CONSTRAINT saved_listings_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: saved_listings saved_listings_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_listings
    ADD CONSTRAINT saved_listings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: saved_notices saved_notices_notice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_notices
    ADD CONSTRAINT saved_notices_notice_id_fkey FOREIGN KEY (notice_id) REFERENCES public.noticeboard_posts(id) ON DELETE CASCADE;


--
-- Name: saved_notices saved_notices_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_notices
    ADD CONSTRAINT saved_notices_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: saved_searches saved_searches_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_searches
    ADD CONSTRAINT saved_searches_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: service_offer_details service_offer_details_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_offer_details
    ADD CONSTRAINT service_offer_details_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: skill_endorsements skill_endorsements_endorser_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_endorsements
    ADD CONSTRAINT skill_endorsements_endorser_id_fkey FOREIGN KEY (endorser_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: skill_endorsements skill_endorsements_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_endorsements
    ADD CONSTRAINT skill_endorsements_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: task_details task_details_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_details
    ADD CONSTRAINT task_details_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: trusted_contacts trusted_contacts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_contacts
    ADD CONSTRAINT trusted_contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: verifications verifications_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: account_deletions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agreement_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agreement_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement_time_proposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agreement_time_proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: app_secrets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings app_settings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_settings_read ON public.app_settings FOR SELECT TO anon, authenticated USING (((key ~~ 'platform.%'::text) OR (key = ANY (ARRAY['partners.version'::text, 'partners.max_hovedpartnere'::text]))));


--
-- Name: banned_words; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.banned_words ENABLE ROW LEVEL SECURITY;

--
-- Name: blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: business_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: clubs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

--
-- Name: completion_confirmations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.completion_confirmations ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: donation_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.donation_records ENABLE ROW LEVEL SECURITY;

--
-- Name: follows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

--
-- Name: follows follows_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY follows_read_own ON public.follows FOR SELECT TO authenticated USING ((follower_id = auth.uid()));


--
-- Name: follows follows_write_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY follows_write_own ON public.follows TO authenticated USING ((follower_id = auth.uid())) WITH CHECK ((follower_id = auth.uid()));


--
-- Name: guardian_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guardian_links ENABLE ROW LEVEL SECURITY;

--
-- Name: job_workspaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: job_workspaces job_workspaces_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_workspaces_participants ON public.job_workspaces TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.proposals p
  WHERE ((p.id = job_workspaces.proposal_id) AND ((p.from_profile_id = auth.uid()) OR (p.to_profile_id = auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.proposals p
  WHERE ((p.id = job_workspaces.proposal_id) AND ((p.from_profile_id = auth.uid()) OR (p.to_profile_id = auth.uid()))))));


--
-- Name: kommune_waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kommune_waitlist ENABLE ROW LEVEL SECURITY;

--
-- Name: kommuner; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kommuner ENABLE ROW LEVEL SECURITY;

--
-- Name: kommuner kommuner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kommuner_read ON public.kommuner FOR SELECT TO anon, authenticated USING (true);


--
-- Name: listing_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;

--
-- Name: listing_private; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.listing_private ENABLE ROW LEVEL SECURITY;

--
-- Name: listings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

--
-- Name: message_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: neighbourhood_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.neighbourhood_members ENABLE ROW LEVEL SECURITY;

--
-- Name: neighbourhood_members neighbourhood_members_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY neighbourhood_members_own ON public.neighbourhood_members TO authenticated USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: neighbourhoods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.neighbourhoods ENABLE ROW LEVEL SECURITY;

--
-- Name: neighbourhoods neighbourhoods_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY neighbourhoods_create ON public.neighbourhoods FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));


--
-- Name: neighbourhoods neighbourhoods_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY neighbourhoods_read_all ON public.neighbourhoods FOR SELECT TO authenticated USING (true);


--
-- Name: news_articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_subscribers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

--
-- Name: no_show_reports no_show_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY no_show_insert_own ON public.no_show_reports FOR INSERT TO authenticated WITH CHECK ((reporter_id = auth.uid()));


--
-- Name: no_show_reports no_show_read_involved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY no_show_read_involved ON public.no_show_reports FOR SELECT TO authenticated USING (((reporter_id = auth.uid()) OR (reported_id = auth.uid())));


--
-- Name: no_show_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.no_show_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: notice_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notice_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: noticeboard_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.noticeboard_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: noticeboard_posts noticeboard_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY noticeboard_read_all ON public.noticeboard_posts FOR SELECT TO authenticated USING (((hidden_at IS NULL) OR (author_id = auth.uid()) OR public.is_admin()));


--
-- Name: noticeboard_posts noticeboard_write_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY noticeboard_write_own ON public.noticeboard_posts TO authenticated USING ((author_id = auth.uid())) WITH CHECK ((author_id = auth.uid()));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement_snapshots p_agree_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_agree_read ON public.agreement_snapshots FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.proposals p
  WHERE ((p.id = agreement_snapshots.proposal_id) AND public.is_participant(p.conversation_id)))));


--
-- Name: banned_words p_banned_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_banned_admin ON public.banned_words TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: business_profiles p_biz_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_biz_read ON public.business_profiles FOR SELECT TO authenticated USING (((profile_id = auth.uid()) OR public.is_admin()));


--
-- Name: blocks p_blocks_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_blocks_all ON public.blocks TO authenticated USING ((by_profile_id = auth.uid())) WITH CHECK ((by_profile_id = auth.uid()));


--
-- Name: categories p_categories_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_categories_read ON public.categories FOR SELECT TO authenticated USING (true);


--
-- Name: completion_confirmations p_comp_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_comp_read ON public.completion_confirmations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.proposals p
  WHERE ((p.id = completion_confirmations.agreement_proposal_id) AND public.is_participant(p.conversation_id)))));


--
-- Name: consent_records p_consent_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_consent_all ON public.consent_records TO authenticated USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: conversations p_conv_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_conv_read ON public.conversations FOR SELECT TO authenticated USING (public.is_participant(id));


--
-- Name: conversation_participants p_convpart_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_convpart_read ON public.conversation_participants FOR SELECT TO authenticated USING (public.is_participant(conversation_id));


--
-- Name: donation_records p_donations_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_donations_read ON public.donation_records FOR SELECT TO authenticated USING ((status = 'transferred'::text));


--
-- Name: listing_images p_limg_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_limg_read ON public.listing_images FOR SELECT TO authenticated USING (true);


--
-- Name: listing_images p_limg_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_limg_write ON public.listing_images TO authenticated USING (public.owns_listing(listing_id)) WITH CHECK (public.owns_listing(listing_id));


--
-- Name: listing_private p_listing_private_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_listing_private_own ON public.listing_private TO authenticated USING (public.owns_listing(listing_id)) WITH CHECK (public.owns_listing(listing_id));


--
-- Name: listings p_listings_del; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_listings_del ON public.listings FOR DELETE TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: listings p_listings_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_listings_ins ON public.listings FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: listings p_listings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_listings_read ON public.listings FOR SELECT TO authenticated USING ((((status <> 'REMOVED'::public.listing_status) AND (NOT admin_hidden) AND ((invited_profile_id IS NULL) OR (invited_profile_id = auth.uid()))) OR (owner_id = auth.uid()) OR public.is_admin()));


--
-- Name: listings p_listings_upd; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_listings_upd ON public.listings FOR UPDATE TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: messages p_msg_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_msg_ins ON public.messages FOR INSERT TO authenticated WITH CHECK ((public.is_participant(conversation_id) AND (author_id = auth.uid()) AND (kind = ANY (ARRAY['TEXT'::public.message_kind, 'IMAGE'::public.message_kind]))));


--
-- Name: messages p_msg_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_msg_read ON public.messages FOR SELECT TO authenticated USING (public.is_participant(conversation_id));


--
-- Name: notice_comments p_notice_comments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_notice_comments_delete ON public.notice_comments FOR DELETE TO authenticated USING (((author_id = auth.uid()) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.noticeboard_posts n
  WHERE ((n.id = notice_comments.notice_id) AND (n.author_id = auth.uid()))))));


--
-- Name: notice_comments p_notice_comments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_notice_comments_insert ON public.notice_comments FOR INSERT TO authenticated WITH CHECK ((author_id = auth.uid()));


--
-- Name: notice_comments p_notice_comments_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_notice_comments_read ON public.notice_comments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.noticeboard_posts n
  WHERE ((n.id = notice_comments.notice_id) AND ((n.hidden_at IS NULL) OR (n.author_id = auth.uid()) OR public.is_admin())))));


--
-- Name: notifications p_notif_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_notif_all ON public.notifications TO authenticated USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: partners p_partners_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_partners_read ON public.partners FOR SELECT TO authenticated USING ((public.partner_is_visible(id) OR public.is_admin()));


--
-- Name: partner_placements p_placements_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_placements_read ON public.partner_placements FOR SELECT TO authenticated USING (true);


--
-- Name: portfolio_items p_portfolio_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_portfolio_own ON public.portfolio_items TO authenticated USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: portfolio_items p_portfolio_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_portfolio_read ON public.portfolio_items FOR SELECT TO authenticated USING (true);


--
-- Name: proposal_revisions p_prev_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_prev_read ON public.proposal_revisions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.proposals p
  WHERE ((p.id = proposal_revisions.proposal_id) AND public.is_participant(p.conversation_id)))));


--
-- Name: profile_private p_profile_private_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_profile_private_own ON public.profile_private FOR SELECT TO authenticated USING ((profile_id = auth.uid()));


--
-- Name: profiles p_profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: profiles p_profiles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_profiles_read ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: profiles p_profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_profiles_update ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: proposals p_prop_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_prop_read ON public.proposals FOR SELECT TO authenticated USING (public.is_participant(conversation_id));


--
-- Name: push_tokens p_push_tokens_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_push_tokens_own ON public.push_tokens TO authenticated USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: message_reads p_reads_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_reads_all ON public.message_reads TO authenticated USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: reports p_reports_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_reports_ins ON public.reports FOR INSERT TO authenticated WITH CHECK ((by_profile_id = auth.uid()));


--
-- Name: reports p_reports_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_reports_read ON public.reports FOR SELECT TO authenticated USING (((by_profile_id = auth.uid()) OR public.is_admin()));


--
-- Name: reports p_reports_upd; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_reports_upd ON public.reports FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: reviews p_reviews_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_reviews_read ON public.reviews FOR SELECT TO authenticated USING (true);


--
-- Name: saved_listings p_saved_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_saved_all ON public.saved_listings TO authenticated USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: saved_notices p_saved_notices_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_saved_notices_own ON public.saved_notices TO authenticated USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: saved_searches p_savedsearch_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_savedsearch_all ON public.saved_searches TO authenticated USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: profile_settings p_settings_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_settings_own ON public.profile_settings TO authenticated USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: service_offer_details p_soffer_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_soffer_read ON public.service_offer_details FOR SELECT TO authenticated USING (true);


--
-- Name: service_offer_details p_soffer_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_soffer_write ON public.service_offer_details TO authenticated USING (public.owns_listing(listing_id)) WITH CHECK (public.owns_listing(listing_id));


--
-- Name: task_details p_task_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_task_read ON public.task_details FOR SELECT TO authenticated USING (true);


--
-- Name: task_details p_task_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_task_write ON public.task_details TO authenticated USING (public.owns_listing(listing_id)) WITH CHECK (public.owns_listing(listing_id));


--
-- Name: agreement_time_proposals p_time_prop_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_time_prop_read ON public.agreement_time_proposals FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.proposals p
  WHERE ((p.id = agreement_time_proposals.proposal_id) AND ((auth.uid() = p.from_profile_id) OR (auth.uid() = p.to_profile_id))))));


--
-- Name: verifications p_verif_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_verif_read ON public.verifications FOR SELECT TO authenticated USING (((profile_id = auth.uid()) OR public.is_admin()));


--
-- Name: kommune_waitlist p_waitlist_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_waitlist_own ON public.kommune_waitlist TO authenticated USING (((profile_id = auth.uid()) OR public.is_admin())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: partner_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_events ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_placements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_placements ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_profile_changes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_profile_changes ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: partners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

--
-- Name: portfolio_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_moderation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_moderation ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_moderation profile_moderation_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_moderation_own ON public.profile_moderation FOR SELECT TO authenticated USING ((profile_id = auth.uid()));


--
-- Name: profile_private; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_revisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposal_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: proposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: push_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: safe_trips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.safe_trips ENABLE ROW LEVEL SECURITY;

--
-- Name: safe_trips safe_trips_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY safe_trips_own ON public.safe_trips TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: saved_listings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_notices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_notices ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_searches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

--
-- Name: service_offer_details; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_offer_details ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_endorsements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skill_endorsements ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_endorsements skill_endorsements_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY skill_endorsements_read ON public.skill_endorsements FOR SELECT TO authenticated USING (true);


--
-- Name: skill_endorsements skill_endorsements_write_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY skill_endorsements_write_own ON public.skill_endorsements TO authenticated USING ((endorser_id = auth.uid())) WITH CHECK ((endorser_id = auth.uid()));


--
-- Name: stripe_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

--
-- Name: task_details; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_details ENABLE ROW LEVEL SECURITY;

--
-- Name: trusted_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trusted_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: trusted_contacts trusted_contacts_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trusted_contacts_own ON public.trusted_contacts TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: FUNCTION admin_businesses(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_businesses() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_businesses() TO authenticated;


--
-- Name: FUNCTION admin_decide_business(p_profile_id uuid, p_approve boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_decide_business(p_profile_id uuid, p_approve boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_decide_business(p_profile_id uuid, p_approve boolean) TO authenticated;


--
-- Name: FUNCTION admin_decide_report(p_report_id uuid, p_outcome text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_decide_report(p_report_id uuid, p_outcome text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_decide_report(p_report_id uuid, p_outcome text) TO authenticated;


--
-- Name: FUNCTION admin_flagged_listings(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_flagged_listings() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_flagged_listings() TO authenticated;


--
-- Name: FUNCTION admin_overview(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_overview() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_overview() TO authenticated;


--
-- Name: FUNCTION admin_partners(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_partners() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_partners() TO authenticated;


--
-- Name: FUNCTION admin_reopen_report(p_report_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_reopen_report(p_report_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_reopen_report(p_report_id uuid) TO authenticated;


--
-- Name: FUNCTION admin_report_attachments(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_report_attachments() TO authenticated;


--
-- Name: FUNCTION admin_reports(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_reports() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_reports() TO authenticated;


--
-- Name: FUNCTION admin_set_listing_hidden(p_listing_id uuid, p_hidden boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_listing_hidden(p_listing_id uuid, p_hidden boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_listing_hidden(p_listing_id uuid, p_hidden boolean) TO authenticated;


--
-- Name: FUNCTION admin_set_main_partner(p_partner_id uuid, p_main boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_main_partner(p_partner_id uuid, p_main boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_main_partner(p_partner_id uuid, p_main boolean) TO authenticated;


--
-- Name: FUNCTION admin_set_partner_active(p_partner_id uuid, p_active boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_partner_active(p_partner_id uuid, p_active boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_partner_active(p_partner_id uuid, p_active boolean) TO authenticated;


--
-- Name: FUNCTION admin_set_partner_hero(p_partner_id uuid, p_hero boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_partner_hero(p_partner_id uuid, p_hero boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_partner_hero(p_partner_id uuid, p_hero boolean) TO authenticated;


--
-- Name: FUNCTION admin_set_suspended(p_profile_id uuid, p_suspended boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_suspended(p_profile_id uuid, p_suspended boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_suspended(p_profile_id uuid, p_suspended boolean) TO authenticated;


--
-- Name: FUNCTION admin_users(p_q text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_users(p_q text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_users(p_q text) TO authenticated;


--
-- Name: FUNCTION admin_waitlist(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_waitlist() TO authenticated;


--
-- Name: FUNCTION admin_week_stats(p_day date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_week_stats(p_day date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_week_stats(p_day date) TO authenticated;


--
-- Name: FUNCTION badge_count(p_profile uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.badge_count(p_profile uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.badge_count(p_profile uuid) TO service_role;


--
-- Name: FUNCTION bump_completed_counter(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.bump_completed_counter() FROM PUBLIC;


--
-- Name: FUNCTION bump_partners_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.bump_partners_version() FROM PUBLIC;


--
-- Name: FUNCTION call_send_push(p_body jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.call_send_push(p_body jsonb) FROM PUBLIC;


--
-- Name: FUNCTION delete_my_account(p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_my_account(p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_my_account(p_reason text) TO authenticated;


--
-- Name: FUNCTION edit_proposal(p_proposal_id uuid, p_price_minor bigint, p_scheduled_text text, p_message text, p_caveats text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.edit_proposal(p_proposal_id uuid, p_price_minor bigint, p_scheduled_text text, p_message text, p_caveats text) TO authenticated;


--
-- Name: FUNCTION guardian_invite_code(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guardian_invite_code() TO authenticated;


--
-- Name: FUNCTION guardian_link(p_code text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guardian_link(p_code text) TO authenticated;


--
-- Name: FUNCTION guardian_unlink(p_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guardian_unlink(p_id uuid) TO authenticated;


--
-- Name: FUNCTION hovedpartner_slots(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hovedpartner_slots() FROM PUBLIC;
GRANT ALL ON FUNCTION public.hovedpartner_slots() TO authenticated;


--
-- Name: FUNCTION hovedpartner_taken(p_exclude uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hovedpartner_taken(p_exclude uuid) FROM PUBLIC;


--
-- Name: FUNCTION instant_book(p_listing_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.instant_book(p_listing_id uuid) TO authenticated;


--
-- Name: FUNCTION join_neighbourhood(p_municipality text, p_place text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.join_neighbourhood(p_municipality text, p_place text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.join_neighbourhood(p_municipality text, p_place text) TO authenticated;


--
-- Name: FUNCTION leave_neighbourhood(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.leave_neighbourhood(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.leave_neighbourhood(p_id uuid) TO authenticated;


--
-- Name: FUNCTION lift_expired_suspensions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lift_expired_suspensions() FROM PUBLIC;


--
-- Name: FUNCTION listing_offer_count(p_listing_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.listing_offer_count(p_listing_id uuid) TO authenticated;


--
-- Name: FUNCTION log_partner_event(p_partner uuid, p_kind text, p_kommune text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_partner_event(p_partner uuid, p_kind text, p_kommune text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_partner_event(p_partner uuid, p_kind text, p_kommune text) TO authenticated;


--
-- Name: FUNCTION mark_conversation_read(p_conversation_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mark_conversation_read(p_conversation_id uuid) TO authenticated;


--
-- Name: FUNCTION mark_conversations_delivered(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mark_conversations_delivered() TO authenticated;


--
-- Name: FUNCTION mark_proposal_seen(p_proposal_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mark_proposal_seen(p_proposal_id uuid) TO authenticated;


--
-- Name: FUNCTION mark_saved_search_run(p_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mark_saved_search_run(p_id uuid) TO authenticated;


--
-- Name: FUNCTION moderation_decide_business(p_profile_id uuid, p_approve boolean, p_reason text, p_by text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.moderation_decide_business(p_profile_id uuid, p_approve boolean, p_reason text, p_by text) FROM PUBLIC;


--
-- Name: FUNCTION moderation_decide_report(p_report_id uuid, p_outcome text, p_resolved_by uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.moderation_decide_report(p_report_id uuid, p_outcome text, p_resolved_by uuid) FROM PUBLIC;


--
-- Name: FUNCTION moderation_reopen_report(p_report_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.moderation_reopen_report(p_report_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION moderation_set_listing_hidden(p_listing_id uuid, p_hidden boolean, p_reason text, p_by text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.moderation_set_listing_hidden(p_listing_id uuid, p_hidden boolean, p_reason text, p_by text) FROM PUBLIC;


--
-- Name: FUNCTION moderation_set_suspended(p_profile_id uuid, p_suspended boolean, p_until timestamp with time zone, p_reason text, p_by text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.moderation_set_suspended(p_profile_id uuid, p_suspended boolean, p_until timestamp with time zone, p_reason text, p_by text) FROM PUBLIC;


--
-- Name: FUNCTION my_account(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.my_account() TO authenticated;


--
-- Name: FUNCTION my_account_status(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.my_account_status() TO authenticated;


--
-- Name: FUNCTION my_conversation_meta(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.my_conversation_meta() TO authenticated;


--
-- Name: FUNCTION my_guardian_links(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.my_guardian_links() TO authenticated;


--
-- Name: FUNCTION neighbourhood_info(p_municipality text, p_place text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.neighbourhood_info(p_municipality text, p_place text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.neighbourhood_info(p_municipality text, p_place text) TO authenticated;


--
-- Name: FUNCTION noticeboard_reply_counts(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.noticeboard_reply_counts() TO authenticated;


--
-- Name: FUNCTION notify_matching_helpers(p_listing_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_matching_helpers(p_listing_id uuid) TO authenticated;


--
-- Name: FUNCTION notify_moderation(p_profile uuid, p_title text, p_body text, p_route text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_moderation(p_profile uuid, p_title text, p_body text, p_route text) FROM PUBLIC;


--
-- Name: FUNCTION partner_is_visible(p_partner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.partner_is_visible(p_partner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.partner_is_visible(p_partner_id uuid) TO authenticated;


--
-- Name: FUNCTION price_guidance(p_category_slug text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.price_guidance(p_category_slug text) TO authenticated;


--
-- Name: FUNCTION profile_reliability(p_profile_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.profile_reliability(p_profile_id uuid) TO authenticated;


--
-- Name: FUNCTION profile_reply_minutes(p_profile_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.profile_reply_minutes(p_profile_id uuid) TO authenticated;


--
-- Name: FUNCTION propose_agreement_time(p_proposal_id uuid, p_scheduled_at timestamp with time zone, p_scheduled_text text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.propose_agreement_time(p_proposal_id uuid, p_scheduled_at timestamp with time zone, p_scheduled_text text) TO authenticated;


--
-- Name: FUNCTION refresh_youth_age(p_profile uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.refresh_youth_age(p_profile uuid) FROM PUBLIC;


--
-- Name: FUNCTION register_push_token(p_token text, p_platform text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.register_push_token(p_token text, p_platform text) TO authenticated;


--
-- Name: FUNCTION reply_to_review(p_review_id uuid, p_text text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reply_to_review(p_review_id uuid, p_text text) TO authenticated;


--
-- Name: FUNCTION report_no_show(p_agreement_proposal_id uuid, p_profile_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.report_no_show(p_agreement_proposal_id uuid, p_profile_id uuid) TO authenticated;


--
-- Name: FUNCTION request_help_again(p_proposal_id uuid, p_when text, p_note text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.request_help_again(p_proposal_id uuid, p_when text, p_note text) TO authenticated;


--
-- Name: FUNCTION respond_agreement_time(p_id uuid, p_answer text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.respond_agreement_time(p_id uuid, p_answer text) TO authenticated;


--
-- Name: FUNCTION send_agreement_reminders(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.send_agreement_reminders() FROM PUBLIC;


--
-- Name: FUNCTION set_conversation_muted(p_conversation_id uuid, p_muted boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_conversation_muted(p_conversation_id uuid, p_muted boolean) TO authenticated;


--
-- Name: FUNCTION set_proposal_extras(p_proposal_id uuid, p_scheduled_at timestamp with time zone, p_duration_text text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_proposal_extras(p_proposal_id uuid, p_scheduled_at timestamp with time zone, p_duration_text text) TO authenticated;


--
-- Name: FUNCTION set_report_attachment(p_report_id uuid, p_path text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_report_attachment(p_report_id uuid, p_path text) TO authenticated;


--
-- Name: FUNCTION setting_int(p_key text, p_default integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.setting_int(p_key text, p_default integer) FROM PUBLIC;


--
-- Name: FUNCTION start_conversation_for_notice(p_notice_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.start_conversation_for_notice(p_notice_id uuid) TO authenticated;


--
-- Name: FUNCTION submit_review(p_agreement_proposal_id uuid, p_rating integer, p_comment text, p_tags text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_review(p_agreement_proposal_id uuid, p_rating integer, p_comment text, p_tags text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_review(p_agreement_proposal_id uuid, p_rating integer, p_comment text, p_tags text[]) TO authenticated;


--
-- Name: FUNCTION toggle_endorsement(p_target_id uuid, p_skill text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.toggle_endorsement(p_target_id uuid, p_skill text) TO authenticated;


--
-- Name: FUNCTION toggle_follow(p_followed_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.toggle_follow(p_followed_id uuid) TO authenticated;


--
-- Name: FUNCTION toggle_message_reaction(p_message_id uuid, p_emoji text, p_profile_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.toggle_message_reaction(p_message_id uuid, p_emoji text, p_profile_id uuid) TO authenticated;


--
-- Name: FUNCTION unregister_push_token(p_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.unregister_push_token(p_token text) TO authenticated;


--
-- Name: FUNCTION update_job_workspace(p_proposal_id uuid, p_action jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_job_workspace(p_proposal_id uuid, p_action jsonb) TO authenticated;


--
-- Name: FUNCTION update_listing(p_listing_id uuid, p_title text, p_category_slug text, p_price_mode public.price_mode, p_price_minor bigint, p_municipality text, p_place text, p_description text, p_equipment text, p_meeting_note text, p_duration_text text, p_scheduled_text text, p_intake jsonb, p_images text[], p_offer_audience text, p_max_distance_km integer, p_private_estimate_minor bigint, p_estimated_minutes integer, p_wizard jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_listing(p_listing_id uuid, p_title text, p_category_slug text, p_price_mode public.price_mode, p_price_minor bigint, p_municipality text, p_place text, p_description text, p_equipment text, p_meeting_note text, p_duration_text text, p_scheduled_text text, p_intake jsonb, p_images text[], p_offer_audience text, p_max_distance_km integer, p_private_estimate_minor bigint, p_estimated_minutes integer, p_wizard jsonb) TO authenticated;


--
-- Name: TABLE news_public; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.news_public TO authenticated;


--
-- Name: TABLE partners_public; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.partners_public TO anon;
GRANT SELECT ON TABLE public.partners_public TO authenticated;


--


-- -----------------------------------------------------------------------------
-- 3. Trigger on auth.users – creates the profile row for every new login
-- -----------------------------------------------------------------------------
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 4. Storage
-- -----------------------------------------------------------------------------
-- Files are stored under "<user id>/…" in each bucket. The public buckets are
-- readable by any signed-in user; who may see a file's *reference* is decided by
-- RLS on the row that holds the path (listing_images, messages, profiles …).
-- report-attachments is private: only the uploader and admins can read it.
-- Noticeboard images and portfolio photos use the listing-images bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('avatars', 'avatars', true, NULL, NULL)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('chat-attachments', 'chat-attachments', true, NULL, NULL)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('listing-images', 'listing-images', true, NULL, NULL)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('public-web', 'public-web', true, '2097152', '{image/png,image/jpeg,image/webp}')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('report-attachments', 'report-attachments', false, NULL, NULL)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "report attachments delete own" ON storage.objects FOR DELETE TO authenticated
  USING (((bucket_id = 'report-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "report attachments read own or admin" ON storage.objects FOR SELECT TO authenticated
  USING (((bucket_id = 'report-attachments'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin())));

CREATE POLICY "report attachments write own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'report-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "storage delete own folder" ON storage.objects FOR DELETE TO authenticated
  USING (((bucket_id = ANY (ARRAY['avatars'::text, 'listing-images'::text, 'chat-attachments'::text])) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "storage read" ON storage.objects FOR SELECT TO authenticated
  USING ((bucket_id = ANY (ARRAY['avatars'::text, 'listing-images'::text, 'chat-attachments'::text])));

CREATE POLICY "storage update own folder" ON storage.objects FOR UPDATE TO authenticated
  USING (((bucket_id = ANY (ARRAY['avatars'::text, 'listing-images'::text, 'chat-attachments'::text])) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "storage write own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = ANY (ARRAY['avatars'::text, 'listing-images'::text, 'chat-attachments'::text])) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


-- -----------------------------------------------------------------------------
-- 5. Realtime – tables streamed to the app (supabase_realtime publication)
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.donation_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kommuner;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_placements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.partners;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals;


-- -----------------------------------------------------------------------------
-- 6. Scheduled jobs (pg_cron)
-- -----------------------------------------------------------------------------
SELECT cron.schedule('minnabo-reminders', '*/10 * * * *', 'select public.send_agreement_reminders()');
SELECT cron.schedule('minnabo-lift-suspensions', '*/10 * * * *', 'select public.lift_expired_suspensions()');


-- -----------------------------------------------------------------------------
-- 7. Seed data: categories (0023_seed_categories.sql + 0035_more_categories.sql)
-- -----------------------------------------------------------------------------
-- Mirrors CATEGORIES in src/domain/categories.ts (the app's source of truth).
-- Only these reference rows are included; partner seed rows (0025) are
-- placeholders and are left out.
INSERT INTO public.categories (slug, label, icon) VALUES
  ('annet', 'Annet', 'more-horizontal'),
  ('arrangement', 'Arrangementshjelp', 'calendar'),
  ('barnevakt', 'Barnevakt', 'barnevakt'),
  ('bilpleie', 'Bilpleie', 'bilpleie'),
  ('bortkjoring', 'Bortkjøring og rydding', 'bortkjoring'),
  ('datahjelp', 'Datahjelp', 'monitor'),
  ('dyrepass', 'Dyrepass', 'heart'),
  ('flytting', 'Flytting/bæring', 'package'),
  ('hage', 'Hage', 'feather'),
  ('handling', 'Handling og ærender', 'handling'),
  ('husvakt', 'Hus- og plantevakt', 'husvakt'),
  ('leksehjelp', 'Leksehjelp', 'leksehjelp'),
  ('maling', 'Maling/vedlikehold', 'edit-3'),
  ('matlaging', 'Matlaging og baking', 'matlaging'),
  ('montering', 'Montering', 'tool'),
  ('renhold', 'Rengjøring', 'droplet'),
  ('selskap', 'Selskap og følge', 'selskap'),
  ('snekring', 'Snekring/småreparasjoner', 'snekring'),
  ('snomaking', 'Snømåking', 'cloud-snow'),
  ('sykkel', 'Sykkelreparasjon', 'sykkel'),
  ('transport', 'Transport/levering', 'truck'),
  ('ved', 'Ved og fyring', 'ved'),
  ('vinduspuss', 'Vinduspuss', 'vinduspuss')
ON CONFLICT DO NOTHING;
