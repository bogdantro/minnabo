-- 0042_saved_search_alerts.sql
-- Lagrede → Søk (design/screens/Lagrede.dc.html):
--  * the bell on a saved search ("varsel på") – a new oppdrag that matches the
--    search creates a notification (and with 0039 a push)
--  * "sist kjørt …" and "N nye treff" count from the last time the search was run

alter table saved_searches add column if not exists alert boolean not null default false;
alter table saved_searches add column if not exists last_run_at timestamptz;

create or replace function mark_saved_search_run(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update saved_searches set last_run_at = now() where id = p_id and profile_id = auth.uid();
$$;
grant execute on function mark_saved_search_run(uuid) to authenticated;

-- A newly published oppdrag is checked against every saved search with the bell on.
-- The filter is the app's ListingFilter: { query, categorySlug, municipalities, verifiedOnly }.
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
       and (coalesce(ss.filter->>'categorySlug', 'alle') in ('alle', '') or ss.filter->>'categorySlug' = new.category_slug)
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
drop trigger if exists t_listings_saved_search_alerts on listings;
create trigger t_listings_saved_search_alerts after insert or update of status on listings
  for each row execute function notify_saved_searches();
