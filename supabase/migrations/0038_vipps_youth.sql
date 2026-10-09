-- 0038_vipps_youth.sql
--  * Vipps login: what Vipps confirmed about a person lives in profile_private
--    (owner-only). Only the `vipps-login` edge function (service role) writes it.
--  * Youth accounts (under 18, product rule 5): the age comes from the Vipps
--    birth date and the limits are enforced here, not in the app.
--      allowed: browse oppdrag, give / withdraw tilbud, chat in conversations
--               created by their own tilbud, profile, safety, privacy
--      blocked: create / edit oppdrag, write in a conversation without a tilbud,
--               Nabolag, Oppslagstavle, giving reviews, saved searches, bedrift
--    profiles.youth_age is the public marker ("Ungdomskonto · 16 år"); it is
--    null for adults and cleared automatically on the 18th birthday.

create table if not exists profile_private (
  profile_id uuid primary key references profiles(id) on delete cascade,
  vipps_sub text unique,
  full_name text,
  phone text,
  email text,
  birth_date date,
  updated_at timestamptz not null default now()
);
alter table profile_private enable row level security;
drop policy if exists p_profile_private_own on profile_private;
create policy p_profile_private_own on profile_private for select to authenticated
  using (profile_id = auth.uid());
-- no insert / update / delete policy: service role only

alter table profiles add column if not exists youth_age smallint;

-- Exact check, straight from the birth date.
create or replace function is_youth(p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select birth_date + interval '18 years' > now()
                     from profile_private where profile_id = p_profile), false);
$$;

-- Keep the public marker in step with the birth date.
create or replace function refresh_youth_age(p_profile uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_birth date; v_age int;
begin
  select birth_date into v_birth from profile_private where profile_id = p_profile;
  v_age := case when v_birth is null then null else extract(year from age(now(), v_birth))::int end;
  update profiles set youth_age = case when v_age is not null and v_age < 18 then v_age end
   where id = p_profile
     and youth_age is distinct from case when v_age is not null and v_age < 18 then v_age end;
end $$;
revoke all on function refresh_youth_age(uuid) from public, anon, authenticated;

create or replace function profile_private_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform refresh_youth_age(new.profile_id);
  return new;
end $$;
drop trigger if exists t_profile_private_sync on profile_private;
create trigger t_profile_private_sync after insert or update on profile_private
  for each row execute function profile_private_sync();

-- Users can't set the marker themselves.
create or replace function guard_moderation_columns() returns trigger
language plpgsql as $$
begin
  if not is_admin() and current_user = 'authenticated' then
    new.suspended_at := old.suspended_at;
    new.role := old.role;
    new.is_business := old.is_business;
    new.youth_age := old.youth_age;
  end if;
  return new;
end $$;

-- What the app needs to know about the signed-in person (called at every start).
create or replace function my_account()
returns json language plpgsql security definer set search_path = public as $$
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
grant execute on function my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- youth limits
-- ---------------------------------------------------------------------------
create or replace function block_youth_writes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and is_youth(auth.uid()) then
    raise exception 'Dette er ikke tilgjengelig for ungdomskontoer.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['listings','noticeboard_posts','reviews','saved_searches',
                           'business_profiles','neighbourhood_members'] loop
    execute format('drop trigger if exists %I on %I', t || '_block_youth', t);
    execute format(
      'create trigger %I before insert on %I for each row execute function block_youth_writes()',
      t || '_block_youth', t);
  end loop;
end $$;

-- editing an oppdrag (a youth has none, but the door stays shut)
create or replace function block_youth_listing_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.owner_id = auth.uid() and is_youth(auth.uid()) then
    raise exception 'Dette er ikke tilgjengelig for ungdomskontoer.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists listings_block_youth_update on listings;
create trigger listings_block_youth_update before update on listings
  for each row execute function block_youth_listing_update();

-- A youth can only write in a conversation that their own tilbud created.
create or replace function youth_message_guard() returns trigger
language plpgsql security definer set search_path = public as $$
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
drop trigger if exists messages_youth_guard on messages;
create trigger messages_youth_guard before insert on messages
  for each row execute function youth_message_guard();

-- A youth can't be the one who accepts an offer (they have no oppdrag) and can't be admin.
create or replace function youth_role_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'admin' and is_youth(new.id) then
    raise exception 'En ungdomskonto kan ikke være administrator.';
  end if;
  return new;
end $$;
drop trigger if exists profiles_youth_role_guard on profiles;
create trigger profiles_youth_role_guard before update of role on profiles
  for each row execute function youth_role_guard();

-- A deleted account keeps nothing from Vipps (the same person can start over).
create or replace function profile_deleted_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    delete from profile_private where profile_id = new.id;
    new.youth_age := null;
  end if;
  return new;
end $$;
drop trigger if exists profiles_deleted_cleanup on profiles;
create trigger profiles_deleted_cleanup before update of deleted_at on profiles
  for each row execute function profile_deleted_cleanup();
