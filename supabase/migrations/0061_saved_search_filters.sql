-- 0061_saved_search_filters.sql
-- A saved search keeps every filter now: several categories (`categorySlugs`), the
-- kommuner it was saved in (`municipalities`), verified, distance and sort.
-- The alert for new matches understands several categories (it already used
-- `municipalities` and `verifiedOnly`).

create or replace function notify_saved_searches() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record; v_owner_verified boolean;
begin
  if new.type::text <> 'TASK_REQUEST' or new.status::text not in ('PUBLISHED','RECEIVING_OFFERS') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status::text in ('PUBLISHED','RECEIVING_OFFERS') then
    return new; -- only when it becomes visible, not on every edit
  end if;

  select exists (select 1 from verifications v where v.profile_id = new.owner_id and v.verified)
    into v_owner_verified;

  for s in
    select distinct on (ss.profile_id) ss.profile_id, ss.name, ss.filter
      from saved_searches ss
      join profiles p on p.id = ss.profile_id and p.deleted_at is null and p.suspended_at is null
     where ss.alert
       and ss.profile_id <> new.owner_id
       and (case
              when jsonb_typeof(ss.filter->'categorySlugs') = 'array'
                   and jsonb_array_length(ss.filter->'categorySlugs') > 0
                then ss.filter->'categorySlugs' ? new.category_slug
              else coalesce(ss.filter->>'categorySlug', 'alle') in ('alle', '')
                   or ss.filter->>'categorySlug' = new.category_slug
            end)
       and (coalesce(jsonb_array_length(case when jsonb_typeof(ss.filter->'municipalities') = 'array'
                                             then ss.filter->'municipalities' else '[]'::jsonb end), 0) = 0
            or ss.filter->'municipalities' ? new.municipality)
       and (coalesce(trim(ss.filter->>'query'), '') = ''
            or new.title ilike '%' || trim(ss.filter->>'query') || '%'
            or new.place ilike '%' || trim(ss.filter->>'query') || '%')
       and (coalesce((ss.filter->>'verifiedOnly')::boolean, false) = false or v_owner_verified)
       and not exists (select 1 from blocks b
                        where (b.by_profile_id = ss.profile_id and b.blocked_profile_id = new.owner_id)
                           or (b.by_profile_id = new.owner_id and b.blocked_profile_id = ss.profile_id))
       and not exists (select 1 from notifications n
                        where n.profile_id = ss.profile_id and n.kind::text = 'NEW_MATCH'
                          and n.route = '/oppdrag/' || new.id)
     order by ss.profile_id, ss.created_at desc
     limit 500
  loop
    insert into notifications (profile_id, kind, title, body, route)
      values (s.profile_id, 'NEW_MATCH'::text::notification_kind,
              'Nytt treff i «' || coalesce(nullif(trim(s.filter->>'query'), ''), s.name) || '»',
              '«' || new.title || '» i ' || new.place, '/oppdrag/' || new.id);
  end loop;
  return new;
exception when others then
  -- an alert must never stop an oppdrag from being published
  return new;
end $$;
