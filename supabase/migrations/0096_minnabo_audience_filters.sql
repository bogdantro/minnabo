-- 0096_minnabo_audience_filters.sql
--  Asked 2026-11-07: ready-made messages in Admin › Chats for different groups, and more filters to reach them.
--  minnabo_audience reads these extra keys (all optional, together with the ones from 0066 and 0095):
--    "posts":        "no_task" (never posted an oppdrag) | "no_offer" (no «Tilbyr hjelp») | "nothing" (neither)
--                    | "no_tilbud" (never gave a tilbud) | "has_offer" (has a «Tilbyr hjelp» out now)
--    "no_avatar":    true – no profile picture
--    "joined_days":  7 / 30 … – joined within that many days
--    "inactive_days": 30 / 90 … – has not opened the app for that many days

create or replace function minnabo_audience(p_audience jsonb)
returns setof uuid language sql stable security definer set search_path = public as $$
  with f as (
    select coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_audience->'municipalities', '[]'::jsonb)) x), '{}') as kommuner,
           coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_audience->'nabolag', '[]'::jsonb)) x), '{}') as nabolag,
           coalesce(nullif(p_audience->>'account', ''), 'all') as account,
           coalesce((p_audience->>'no_kommune')::boolean, false) as no_kommune,
           coalesce(nullif(p_audience->>'posts', ''), 'any') as posts,
           coalesce((p_audience->>'no_avatar')::boolean, false) as no_avatar,
           nullif(p_audience->>'joined_days', '')::int as joined_days,
           nullif(p_audience->>'inactive_days', '')::int as inactive_days
  )
  select p.id from profiles p, f
   where p.deleted_at is null and p.role <> 'admin'
     and (cardinality(f.kommuner) = 0 or p.municipality = any(f.kommuner))
     and (cardinality(f.nabolag) = 0
          or exists (select 1 from neighbourhood_members m where m.profile_id = p.id and m.neighbourhood_id = any(f.nabolag)))
     and (f.account = 'all' or (f.account = 'youth') = is_youth(p.id))
     and (not f.no_kommune or coalesce(btrim(p.municipality), '') = '')
     and (not f.no_avatar or coalesce(btrim(p.avatar_path), '') = '')
     and (f.joined_days is null or p.created_at >= now() - make_interval(days => f.joined_days))
     and (f.inactive_days is null or coalesce(account_last_active(p.id), p.created_at) < now() - make_interval(days => f.inactive_days))
     and case f.posts
           when 'no_task' then not exists (select 1 from listings l where l.owner_id = p.id and l.type::text = 'TASK_REQUEST')
           when 'no_offer' then not exists (select 1 from listings l where l.owner_id = p.id and l.type::text = 'SERVICE_OFFER')
           when 'nothing' then not exists (select 1 from listings l where l.owner_id = p.id)
           when 'no_tilbud' then not exists (select 1 from proposals pr where pr.from_profile_id = p.id)
           when 'has_offer' then exists (select 1 from listings l where l.owner_id = p.id and l.type::text = 'SERVICE_OFFER'
                                            and l.status::text in ('PUBLISHED', 'RECEIVING_OFFERS'))
           else true
         end;
$$;
revoke all on function minnabo_audience(jsonb) from public, anon, authenticated;
