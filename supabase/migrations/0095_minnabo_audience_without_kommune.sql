-- 0095_minnabo_audience_without_kommune.sql
--  Asked 2026-11-07: from the website, send a «MinNabo» message only to the people who have not chosen a kommune,
--  so they can be reminded to add it. minnabo_audience gets one more filter: {"no_kommune": true}.
--  Everything else is as in 0066.

create or replace function minnabo_audience(p_audience jsonb)
returns setof uuid language sql stable security definer set search_path = public as $$
  with f as (
    select coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_audience->'municipalities', '[]'::jsonb)) x), '{}') as kommuner,
           coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_audience->'nabolag', '[]'::jsonb)) x), '{}') as nabolag,
           coalesce(nullif(p_audience->>'account', ''), 'all') as account,
           coalesce((p_audience->>'no_kommune')::boolean, false) as no_kommune
  )
  select p.id from profiles p, f
   where p.deleted_at is null and p.role <> 'admin'
     and (cardinality(f.kommuner) = 0 or p.municipality = any(f.kommuner))
     and (cardinality(f.nabolag) = 0
          or exists (select 1 from neighbourhood_members m where m.profile_id = p.id and m.neighbourhood_id = any(f.nabolag)))
     and (f.account = 'all' or (f.account = 'youth') = is_youth(p.id))
     and (not f.no_kommune or coalesce(btrim(p.municipality), '') = '');
$$;
revoke all on function minnabo_audience(jsonb) from public, anon, authenticated;
