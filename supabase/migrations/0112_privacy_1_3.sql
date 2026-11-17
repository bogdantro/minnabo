-- 0112_privacy_1_3.sql
--  Asked 2026-11-17 (Personvern for app 1.3): make the privacy page true for what 0108–0110 added.
--
--   1. «Slett konto» also removes what 1.3 stores about a person. The profile row stays as «Slettet bruker»
--      (0031), so nothing here goes by cascade: Ukas bilde and arrangement photos (files too), likes, «Jeg også»,
--      sign-ups (språkvenn, vennetjeneste, «Ta med min innkjørsel», «Hvem tar med hva»), project support,
--      hosting, «Si hei», follows and questions to partners, support votes, shared addresses, messages
--      waiting to be sent, away replies, held pushes and the away message. A «Tips en bedrift» is about the
--      business, so it stays without the name.
--   2. A nightly job (03:40):
--      * «Del adresse»: an address is deleted a day after it was withdrawn or stopped being shown
--        (the avtale was cancelled, or the job was confirmed done more than a day ago), and after 12 months at the latest.
--      * Search words (0110, never linked to a person): deleted after 90 days. Suggestions only use 30.
--      * Ukas bilde: photos are deleted 12 months after they were sent in.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. «Slett konto»
-- ---------------------------------------------------------------------------
create or replace function profile_deleted_1_3_data() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is null or old.deleted_at is not null then return new; end if;

  perform queue_file_purge('listing-images', a.path) from area_photos a where a.profile_id = new.id;
  delete from area_photos where profile_id = new.id;
  perform queue_file_purge('listing-images', p.path) from event_photos p where p.profile_id = new.id;
  delete from event_photos where profile_id = new.id;

  delete from area_photo_likes where profile_id = new.id;
  delete from notice_metoo where profile_id = new.id;
  delete from notice_comment_likes where profile_id = new.id;
  delete from listing_joiners where profile_id = new.id;
  delete from event_item_takers where profile_id = new.id;
  delete from buddy_signups where profile_id = new.id;
  delete from project_supporters where profile_id = new.id;
  delete from neighbourhood_hosts where profile_id = new.id;
  delete from neighbour_waves where from_profile_id = new.id or to_profile_id = new.id;
  delete from organisation_admins where profile_id = new.id;
  delete from support_votes where profile_id = new.id;
  delete from partner_follows where profile_id = new.id;
  delete from partner_questions where profile_id = new.id;
  update business_tips set profile_id = null where profile_id = new.id;

  delete from shared_addresses where from_profile_id = new.id;
  delete from scheduled_messages where author_id = new.id;
  delete from away_replies where profile_id = new.id;
  delete from held_pushes where profile_id = new.id;
  update profile_settings set away_until = null, away_message = null where profile_id = new.id;
  return new;
end $$;
revoke all on function profile_deleted_1_3_data() from public, anon, authenticated;

drop trigger if exists t_profiles_deleted_1_3_data on profiles;
create trigger t_profiles_deleted_1_3_data after update of deleted_at on profiles
  for each row execute function profile_deleted_1_3_data();

-- ---------------------------------------------------------------------------
-- 2. Nightly cleanup
-- ---------------------------------------------------------------------------
create or replace function privacy_cleanup() returns int
language plpgsql security definer set search_path = public as $$
declare v int := 0; k int;
begin
  -- the same rule conversation_addresses() (0109) shows them by, plus one day
  delete from shared_addresses a
   where a.created_at < now() - interval '12 months'
      or a.revoked_at < now() - interval '1 day'
      or (a.created_at < now() - interval '1 day' and conversation_agreement(a.conversation_id) is null)
      or exists (select 1 from completion_confirmations c
                  where c.agreement_proposal_id = conversation_agreement(a.conversation_id)
                  group by c.agreement_proposal_id having count(*) >= 2 and max(c.confirmed_at) < now() - interval '2 days');
  get diagnostics k = row_count; v := v + k;

  delete from search_terms where searched_on < (now() at time zone 'Europe/Oslo')::date - 90;
  get diagnostics k = row_count; v := v + k;

  perform queue_file_purge('listing-images', a.path) from area_photos a where a.created_at < now() - interval '12 months';
  delete from area_photos where created_at < now() - interval '12 months';
  get diagnostics k = row_count; v := v + k;
  return v;
end $$;
revoke all on function privacy_cleanup() from public, anon, authenticated;

do $$ begin
  begin perform cron.unschedule('minnabo-privacy-cleanup'); exception when others then null; end;
  perform cron.schedule('minnabo-privacy-cleanup', '40 3 * * *', 'select public.privacy_cleanup()');
exception when others then
  raise notice 'pg_cron not available – schedule privacy_cleanup() by hand';
end $$;
