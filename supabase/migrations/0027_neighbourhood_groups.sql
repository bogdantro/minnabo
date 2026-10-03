-- Nabolag (design/screens/Nabolag.dc.html): one group per area (sted) in a kommune,
-- real membership and member counts. Builds on 0020_neighbourhoods.sql.
-- Members can only read their own membership row (RLS), so counts and the
-- avatar stack come from security-definer functions that expose ids only.

alter table neighbourhoods add column if not exists municipality text;
create unique index if not exists neighbourhoods_area_uidx on neighbourhoods (municipality, place);

-- The group for an area, with member count, whether I'm a member and the latest member ids.
create or replace function neighbourhood_info(p_municipality text, p_place text)
returns table (
  id uuid,
  name text,
  place text,
  municipality text,
  created_at timestamptz,
  member_count int,
  is_member boolean,
  member_ids uuid[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id,
    n.name,
    n.place,
    n.municipality,
    n.created_at,
    (select count(*)::int from neighbourhood_members m where m.neighbourhood_id = n.id),
    exists (
      select 1 from neighbourhood_members m
      where m.neighbourhood_id = n.id and m.profile_id = auth.uid()
    ),
    coalesce((
      select array_agg(s.profile_id) from (
        select m.profile_id from neighbourhood_members m
        where m.neighbourhood_id = n.id
        order by m.joined_at desc
        limit 5
      ) s
    ), '{}')
  from neighbourhoods n
  where n.municipality = p_municipality and n.place = p_place;
$$;

-- Join the group for an area; creates the group the first time someone joins.
create or replace function join_neighbourhood(p_municipality text, p_place text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into neighbourhoods (name, place, municipality, created_by)
  values (p_place || ' nabolag', p_place, p_municipality, auth.uid())
  on conflict (municipality, place) do nothing;
  select n.id into v_id from neighbourhoods n
  where n.municipality = p_municipality and n.place = p_place;
  insert into neighbourhood_members (neighbourhood_id, profile_id)
  values (v_id, auth.uid())
  on conflict do nothing;
  return v_id;
end;
$$;

create or replace function leave_neighbourhood(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from neighbourhood_members where neighbourhood_id = p_id and profile_id = auth.uid();
$$;

revoke all on function neighbourhood_info(text, text) from public;
revoke all on function join_neighbourhood(text, text) from public;
revoke all on function leave_neighbourhood(uuid) from public;
grant execute on function neighbourhood_info(text, text) to authenticated;
grant execute on function join_neighbourhood(text, text) to authenticated;
grant execute on function leave_neighbourhood(uuid) to authenticated;
