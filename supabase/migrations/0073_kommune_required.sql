-- 0073_kommune_required.sql
--  Every finished account has a kommune. Accounts were found with none: the profile row
--  is created at the Vipps login, before Oppsett, so someone who stopped half-way – or a
--  profile changed outside the app – ended up "registered" without one.
--
--  Rule: a profile can't be marked as onboarded without a kommune, and a kommune can't be
--  emptied afterwards. The trigger only looks at changes to onboarded_at / municipality,
--  so an existing profile without a kommune can still be updated in other ways (push
--  tokens, settings) – the app asks for the kommune with a banner on every screen
--  (KommuneBanner.tsx) until it is set.
--
--  To see the accounts this is about:
--    select id, display_name, created_at, onboarded_at from profiles
--     where coalesce(trim(municipality), '') = '' and deleted_at is null order by created_at;
--  onboarded_at null = they never finished Oppsett (the app sends them back there).

create or replace function enforce_profile_kommune() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.onboarded_at is not distinct from old.onboarded_at
     and new.municipality is not distinct from old.municipality then
    return new;
  end if;
  if new.onboarded_at is not null and coalesce(trim(new.municipality), '') = '' then
    raise exception 'Velg kommunen din for å fortsette.';
  end if;
  -- an empty place means the whole kommune
  if coalesce(trim(new.place), '') = '' and coalesce(trim(new.municipality), '') <> '' then
    new.place := new.municipality;
  end if;
  return new;
end $$;

drop trigger if exists profiles_kommune_required on profiles;
create trigger profiles_kommune_required before insert or update of onboarded_at, municipality on profiles
  for each row execute function enforce_profile_kommune();
