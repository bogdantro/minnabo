-- Users that signed up before the on_auth_user_created trigger existed have no
-- profiles row, so the onboarding upsert hit RLS (42501: no INSERT policy).
-- 1) Backfill a row for every auth user that is missing one.
insert into profiles (id)
select u.id from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);

-- 2) Let a signed-in user create their own row (onboarding upsert).
drop policy if exists p_profiles_insert_own on profiles;
create policy p_profiles_insert_own on profiles for insert to authenticated
  with check (id = auth.uid());
