-- 0057_private_contact.sql
-- Home notes ("Hjemmenotater – vises bare for den du har avtale med") and phone numbers
-- were columns on `profiles`, which every signed-in user can read (row security works per
-- row, not per column). The phone column was never filled – the number from Vipps lives in
-- profile_private – so Jobbdag's "Ring"/"SMS" never had a number either.
--  * home notes move to their own owner-only table
--  * profiles.home_notes / profiles.phone are emptied and can no longer be written
--  * shared_contact(profile) gives the Vipps phone and the home notes only to the person
--    themselves and to a counterpart on an accepted tilbud; the notes are hidden again
--    once the job is completed (design: RedigerProfil.dc.html)
--  * the old shared_contacts view (unused by the app) is replaced by the function

create table if not exists profile_home_notes (
  profile_id uuid primary key references profiles(id) on delete cascade,
  notes text not null check (char_length(notes) <= 1000),
  updated_at timestamptz not null default now()
);
alter table profile_home_notes enable row level security;
drop policy if exists p_home_notes_own on profile_home_notes;
create policy p_home_notes_own on profile_home_notes for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

insert into profile_home_notes (profile_id, notes)
  select id, left(btrim(home_notes), 1000) from profiles
   where home_notes is not null and btrim(home_notes) <> ''
on conflict (profile_id) do nothing;

update profiles set home_notes = null, phone = null
 where home_notes is not null or phone is not null;

-- the private columns stay empty (writes by users are ignored)
create or replace function guard_moderation_columns() returns trigger
language plpgsql as $$
begin
  if not is_admin() and current_user = 'authenticated' then
    new.suspended_at := old.suspended_at;
    new.role := old.role;
    new.is_business := old.is_business;
    new.youth_age := old.youth_age;
    new.reliability_completed := old.reliability_completed;
    new.reliability_no_shows := old.reliability_no_shows;
  end if;
  if current_user = 'authenticated' then
    new.home_notes := old.home_notes;
    new.phone := old.phone;
  end if;
  return new;
end $$;

-- a deleted account (anonymised, row kept – 0031) loses its notes
create or replace function drop_notes_on_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    delete from profile_home_notes where profile_id = new.id;
  end if;
  return new;
end $$;
revoke all on function drop_notes_on_delete() from public, anon, authenticated;
drop trigger if exists t_drop_notes_on_delete on profiles;
create trigger t_drop_notes_on_delete after update of deleted_at on profiles
  for each row execute function drop_notes_on_delete();

drop view if exists shared_contacts;

create or replace function shared_contact(p_profile_id uuid)
returns json language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  deal as (
    -- the newest accepted tilbud between the caller and this profile
    select pr.id, l.status::text as listing_status
      from proposals pr
      join listings l on l.id = pr.listing_id, me
     where pr.status = 'ACCEPTED'
       and ((pr.from_profile_id = me.id and pr.to_profile_id = p_profile_id)
         or (pr.to_profile_id = me.id and pr.from_profile_id = p_profile_id))
  ),
  access as (
    select (select id from me) is not null and (p_profile_id = (select id from me) or exists (select 1 from deal)) as phone_ok,
           (select id from me) is not null and (p_profile_id = (select id from me)
             or exists (select 1 from deal where listing_status not in ('COMPLETED', 'REVIEWED', 'CANCELLED', 'REMOVED'))) as notes_ok
  )
  select json_build_object(
    'phone', case when a.phone_ok then (select phone from profile_private where profile_id = p_profile_id) end,
    'homeNotes', case when a.notes_ok then (select notes from profile_home_notes where profile_id = p_profile_id) end)
  from access a;
$$;
revoke all on function shared_contact(uuid) from public, anon;
grant execute on function shared_contact(uuid) to authenticated;
