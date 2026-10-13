-- 0064_retention.sql
-- Makes the storage periods in Personvern true. Until now nothing was ever cleaned up.
--
-- When an account is deleted (at once, in the same transaction):
--  * what delete_my_account (0031) left behind goes too: kommune, categories, languages,
--    availability, portfolio items, varsler, svar on oppslag, foresatt links, partner
--    thanks, photos on own oppdrag and vurderinger the person had received
--  * the files (profile photo, portfolio, photos on own oppdrag) are queued for deletion
--  The anonymous «Slettet bruker» row stays, so the other party keeps the avtale, the
--  messages and the vurdering they got.
--
-- Every night (run_retention, 03:15):
--  * conversations with no message for 24 months: the messages and their photos go.
--    The conversation row stays (tilbud, avtaler and vurderinger hang on it).
--  * closed oppdrag untouched for 24 months: photos go. If the oppdrag never became an
--    avtale, the whole oppdrag goes (with its tilbud and conversations).
--  * handled rapporter older than 24 months go (with the attached screenshot),
--    and so do «møtte ikke opp» reports older than 24 months
--  * varsler older than 12 months go
--  * accounts not used for 23 months get a varsel; 30 days later, if still unused and
--    24 months have passed, the account is deleted the same way as «Slett konto»
--
-- Files cannot be deleted from SQL (Supabase blocks it), so they are put in
-- storage_purge_queue and the edge function `retention` removes them. It also closes the
-- login of accounts deleted for inactivity. Uses the same app_secrets rows as push (0039).
--
-- Vurderinger and the record that a job was done are never deleted here: they belong to
-- the profile and live as long as the account.

-- ---------------------------------------------------------------------------
-- 1. Files waiting to be deleted
-- ---------------------------------------------------------------------------
create table if not exists storage_purge_queue (
  id bigint generated always as identity primary key,
  bucket text not null,
  path text not null,
  queued_at timestamptz not null default now(),
  unique (bucket, path)
);
alter table storage_purge_queue enable row level security;
-- no policies: only the service role (edge function) and the functions below use it
revoke all on storage_purge_queue from anon, authenticated, public;

-- Columns hold either the object name ("<user id>/<file>") or a full storage URL.
create or replace function queue_file_purge(p_bucket text, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare m text[]; v_bucket text := p_bucket; v_path text := btrim(coalesce(p_path, ''));
begin
  if v_path = '' then return; end if;
  m := regexp_match(v_path, '/storage/v1/object/(?:public|sign|authenticated)/([^/]+)/([^?]+)');
  if m is not null then
    v_bucket := m[1]; v_path := m[2];
  elsif v_path ~* '^https?://' then
    return; -- not one of our files
  end if;
  insert into storage_purge_queue (bucket, path) values (v_bucket, v_path)
  on conflict do nothing;
end $$;
revoke all on function queue_file_purge(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Account deletion finishes the job
-- ---------------------------------------------------------------------------
create or replace function profile_deleted_scrub() returns trigger
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if new.deleted_at is null or old.deleted_at is not null then return new; end if;

  perform queue_file_purge('avatars', old.avatar_path);
  foreach v in array coalesce(old.portfolio, '{}') loop
    perform queue_file_purge('listing-images', v);
  end loop;
  perform queue_file_purge('listing-images', i.before_path), queue_file_purge('listing-images', i.after_path)
     from portfolio_items i where i.profile_id = new.id;
  perform queue_file_purge('listing-images', li.storage_path)
     from listing_images li join listings l on l.id = li.listing_id where l.owner_id = new.id;

  delete from portfolio_items where profile_id = new.id;
  delete from listing_images where listing_id in (select id from listings where owner_id = new.id);
  delete from notifications where profile_id = new.id;
  delete from notice_comments where author_id = new.id;
  delete from guardian_links where youth_id = new.id or guardian_id = new.id;
  delete from partner_thanks where profile_id = new.id;
  delete from reviews where to_profile_id = new.id;

  new.avatar_path := null;
  new.portfolio := '{}';
  new.municipality := null;
  new.category_slugs := '{}';
  new.languages := '{}';
  new.availability_text := null;
  new.has_car := false;
  new.available_for_jobs := false;
  return new;
end $$;
revoke all on function profile_deleted_scrub() from public, anon, authenticated;

-- runs after profiles_deleted_cleanup (0038) and before the guards (triggers fire by name)
drop trigger if exists profiles_deleted_scrub on profiles;
create trigger profiles_deleted_scrub before update of deleted_at on profiles
  for each row execute function profile_deleted_scrub();

-- Bug in 0031: a tilbud stays ACCEPTED after the job is done, so deleting the account
-- «avlyste» every finished job too – the other party got «Avtalen er avlyst» and their
-- finished oppdrag was opened for tilbud again. Only avtaler that are not finished are
-- cancelled now. Everything else in the function is unchanged.
create or replace function delete_my_account(p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
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
    select pr.* from proposals pr
    where pr.status = 'ACCEPTED' and (pr.from_profile_id = v_me or pr.to_profile_id = v_me)
      and (select count(*) from completion_confirmations c where c.agreement_proposal_id = pr.id) < 2
      and not exists (select 1 from agreement_snapshots a where a.proposal_id = pr.id and a.cancelled_at is not null)
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

-- Accounts deleted before this migration: the same clean-up, once.
do $$
declare r record; v text;
begin
  for r in select * from profiles where deleted_at is not null loop
    perform queue_file_purge('avatars', r.avatar_path);
    foreach v in array coalesce(r.portfolio, '{}') loop
      perform queue_file_purge('listing-images', v);
    end loop;
    perform queue_file_purge('listing-images', i.before_path), queue_file_purge('listing-images', i.after_path)
       from portfolio_items i where i.profile_id = r.id;
    perform queue_file_purge('listing-images', li.storage_path)
       from listing_images li join listings l on l.id = li.listing_id where l.owner_id = r.id;
    delete from portfolio_items where profile_id = r.id;
    delete from listing_images where listing_id in (select id from listings where owner_id = r.id);
    delete from notifications where profile_id = r.id;
    delete from notice_comments where author_id = r.id;
    delete from guardian_links where youth_id = r.id or guardian_id = r.id;
    delete from partner_thanks where profile_id = r.id;
    delete from reviews where to_profile_id = r.id;
    update profiles set avatar_path = null, portfolio = '{}', municipality = null, category_slugs = '{}',
           languages = '{}', availability_text = null, has_car = false, available_for_jobs = false
     where id = r.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Inactive accounts
-- ---------------------------------------------------------------------------
-- Who has been told that the account is about to be deleted.
create table if not exists inactivity_notices (
  profile_id uuid primary key references profiles(id) on delete cascade,
  warned_at timestamptz not null default now()
);
alter table inactivity_notices enable row level security;
revoke all on inactivity_notices from anon, authenticated, public;

-- Last time the account was used: the last login, or the last time the app renewed its
-- session (it does that every time it is opened).
create or replace function account_last_active(p_profile uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select greatest(
    u.created_at,
    u.last_sign_in_at,
    (select max(greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'utc'))
       from auth.sessions s where s.user_id = u.id))
    from auth.users u where u.id = p_profile;
$$;
revoke all on function account_last_active(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The nightly job
-- ---------------------------------------------------------------------------
create or replace function run_retention()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_old timestamptz := now() - interval '24 months';
  v_warn timestamptz := now() - interval '23 months';
  v_grace timestamptz := now() - interval '30 days';
  v_messages int := 0; v_listings int := 0; v_photos int := 0; v_reports int := 0;
  v_no_shows int := 0; v_notifications int := 0; v_warned int := 0; v_deleted int := 0;
  v_n int; r record;
begin
  -- a) quiet conversations: messages and their photos
  for r in
    select c.id from conversations c
     where c.last_message_at < v_old
       and exists (select 1 from messages m where m.conversation_id = c.id)
       and not exists (select 1 from messages m where m.conversation_id = c.id and m.created_at >= v_old)
  loop
    perform queue_file_purge('chat-attachments', m.attachment_path)
       from messages m where m.conversation_id = r.id and m.attachment_path is not null;
    delete from messages where conversation_id = r.id;
    get diagnostics v_n = row_count;
    v_messages := v_messages + v_n;
    update conversations set last_message_preview = 'Eldre meldinger er slettet.' where id = r.id;
  end loop;

  -- b) closed oppdrag nobody has touched: photos, and the whole oppdrag if it never became an avtale
  for r in
    select l.id,
           exists (select 1 from agreement_snapshots a where a.listing_id = l.id) as agreed
      from listings l
     where l.status::text in ('COMPLETED','REVIEWED','CANCELLED','EXPIRED','REMOVED')
       and l.updated_at < v_old
       and not exists (select 1 from conversations c where c.listing_id = l.id and c.last_message_at >= v_old)
       and not exists (select 1 from reviews rv where rv.listing_id = l.id and rv.created_at >= v_old)
       and (exists (select 1 from listing_images li where li.listing_id = l.id)
            or not exists (select 1 from agreement_snapshots a where a.listing_id = l.id))
  loop
    perform queue_file_purge('listing-images', li.storage_path) from listing_images li where li.listing_id = r.id;
    delete from listing_images where listing_id = r.id;
    get diagnostics v_n = row_count;
    v_photos := v_photos + v_n;
    if not r.agreed then
      perform queue_file_purge('chat-attachments', m.attachment_path)
         from messages m join conversations c on c.id = m.conversation_id
        where c.listing_id = r.id and m.attachment_path is not null;
      delete from listings where id = r.id;
      v_listings := v_listings + 1;
    end if;
  end loop;

  -- c) rapporter
  perform queue_file_purge('report-attachments', attachment_path)
     from reports where status = 'RESOLVED' and coalesce(resolved_at, created_at) < v_old and attachment_path is not null;
  delete from reports where status = 'RESOLVED' and coalesce(resolved_at, created_at) < v_old;
  get diagnostics v_reports = row_count;
  delete from no_show_reports where created_at < v_old;
  get diagnostics v_no_shows = row_count;

  -- d) varsler
  delete from notifications where created_at < now() - interval '12 months';
  get diagnostics v_notifications = row_count;

  -- e) inactive accounts. Admins and suspended accounts are left alone (a suspended
  --    account must not come back as a new one).
  delete from inactivity_notices n where account_last_active(n.profile_id) > n.warned_at;

  for r in
    select p.id from profiles p
     where p.deleted_at is null and p.suspended_at is null and p.role <> 'admin'
       and account_last_active(p.id) < v_warn
       and not exists (select 1 from inactivity_notices n where n.profile_id = p.id)
  loop
    insert into inactivity_notices (profile_id) values (r.id);
    perform notify_moderation(r.id, 'Kontoen din slettes om 30 dager',
      'Du har ikke brukt MinNabo på lenge. Åpne appen innen 30 dager hvis du vil beholde kontoen.', '/');
    v_warned := v_warned + 1;
  end loop;

  for r in
    select p.id from profiles p join inactivity_notices n on n.profile_id = p.id
     where p.deleted_at is null and p.suspended_at is null and p.role <> 'admin'
       and n.warned_at < v_grace
       and account_last_active(p.id) < v_old
  loop
    -- delete_my_account works on the signed-in person: act as the account for this call
    perform set_config('request.jwt.claim.sub', r.id::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', r.id, 'role', 'authenticated')::text, true);
    begin
      perform delete_my_account('Ikke brukt på 24 måneder');
      v_deleted := v_deleted + 1;
    exception when others then
      raise warning 'retention: could not delete inactive account %: %', r.id, sqlerrm;
    end;
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '', true);
    delete from inactivity_notices where profile_id = r.id;
  end loop;

  return jsonb_build_object('messages', v_messages, 'listings', v_listings, 'photos', v_photos,
    'reports', v_reports, 'noShows', v_no_shows, 'notifications', v_notifications,
    'warned', v_warned, 'deleted', v_deleted);
end $$;
revoke all on function run_retention() from public, anon, authenticated;

-- Deleted accounts whose login is still open (inactive accounts: «Slett konto» in the app
-- closes its own). Read by the edge function.
create or replace function accounts_awaiting_auth_delete()
returns setof uuid language sql stable security definer set search_path = public as $$
  select p.id from profiles p join auth.users u on u.id = p.id
   where p.deleted_at is not null and u.deleted_at is null
   limit 200;
$$;
revoke all on function accounts_awaiting_auth_delete() from public, anon, authenticated;
grant execute on function accounts_awaiting_auth_delete() to service_role;
grant select, delete on storage_purge_queue to service_role;

-- Runs the clean-up, then asks the edge function to remove the queued files.
create or replace function retention_tick()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v jsonb; v_url text; v_secret text;
begin
  v := run_retention();
  begin
    select value into v_url from app_secrets where key = 'functions_url';
    select value into v_secret from app_secrets where key = 'push_secret';
    if v_url is not null and v_secret is not null then
      perform net.http_post(
        url := rtrim(v_url, '/') || '/retention',
        body := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret));
    end if;
  exception when others then
    null; -- the files stay queued and are taken the next night
  end;
  return v;
end $$;
revoke all on function retention_tick() from public, anon, authenticated;

do $$ begin
  begin
    perform cron.unschedule('minnabo-retention');
  exception when others then null;
  end;
  perform cron.schedule('minnabo-retention', '15 3 * * *', 'select public.retention_tick()');
exception when others then
  raise notice 'Retention is not scheduled (%). Enable pg_cron and run this block again.', sqlerrm;
end $$;
