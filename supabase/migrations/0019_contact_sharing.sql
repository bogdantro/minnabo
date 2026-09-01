-- New #28: phone numbers are private until two people have an agreement.
--
-- The number lives on profiles.phone (never selected by the default profile
-- policy). The `shared_contacts` view exposes it only to a counterpart on an
-- accepted proposal, and the client reads a profile's phone from there.

alter table profiles
  add column if not exists phone text;

create or replace view shared_contacts as
  select
    p.id as profile_id,
    p.phone
  from profiles p
  where p.id = auth.uid()
     or exists (
       select 1 from proposals pr
       where pr.status = 'ACCEPTED'
         and (
           (pr.from_profile_id = auth.uid() and pr.to_profile_id = p.id) or
           (pr.to_profile_id = auth.uid() and pr.from_profile_id = p.id)
         )
     );
