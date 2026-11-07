-- 0093_snow_alert_schedule.sql
--  Asked 2026-11-06: once a day in the snow season, ask the `snow-alert` edge function to read the
--  forecast for each launch kommune. It calls snow_alert() (0091) for those with snow tonight.
--  Same secret and URL as the push function (app_secrets, 0039).

create or replace function call_snow_alert() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_secret text;
begin
  select value into v_url from app_secrets where key = 'functions_url';
  select value into v_secret from app_secrets where key = 'push_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/snow-alert',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret));
exception when others then
  null;
end $$;
revoke all on function call_snow_alert() from public, anon, authenticated;

do $$ begin
  begin
    perform cron.unschedule('minnabo-snow-alert');
  exception when others then null;
  end;
  -- 15:00 UTC = 16:00 Norwegian winter time: before people plan the evening. October to April only.
  perform cron.schedule('minnabo-snow-alert', '0 15 * 10,11,12,1,2,3,4 *', 'select public.call_snow_alert()');
exception when others then
  raise notice 'The snow alert is not scheduled (%). Enable pg_cron and run this block again.', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- «Slett konto» also clears what 0088–0091 added. Personvern promises it: the profile row stays as
-- «Slettet bruker», so nothing here goes by cascade.
-- ---------------------------------------------------------------------------
create or replace function profile_deleted_new_data() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_path text;
begin
  if new.deleted_at is null or old.deleted_at is not null then return new; end if;
  delete from listing_questions where author_id = new.id;
  delete from notice_signups where profile_id = new.id;
  delete from tool_bookings where borrower_id = new.id and status in ('PENDING','APPROVED');
  delete from thank_cards where from_profile_id = new.id or to_profile_id = new.id;
  select file_path into v_path from police_certificates where profile_id = new.id;
  if v_path is not null then perform queue_file_purge('police-certificates', v_path); end if;
  delete from police_certificates where profile_id = new.id;
  return new;
end $$;
drop trigger if exists t_profiles_deleted_new_data on profiles;
create trigger t_profiles_deleted_new_data after update of deleted_at on profiles
  for each row execute function profile_deleted_new_data();
