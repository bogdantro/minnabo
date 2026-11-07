-- 0092_edit_notice_and_saved_search_kinds.sql
--  Asked 2026-11-06:
--    * «Oppdraget er endret» now says what changed («prisen og tidspunktet er endret»), and nobody
--      is disturbed for a new photo. The rest of update_listing is as in 0071.
--    * A saved search for «Alle» or «Tilbyr hjelp» also alerts about «Tilbyr hjelp». The rest of the
--      function is as in 0061.

create or replace function public.update_listing(
  p_listing_id uuid,
  p_title text,
  p_category_slug text,
  p_price_mode price_mode,
  p_price_minor bigint,
  p_municipality text,
  p_place text,
  p_description text,
  p_equipment text,
  p_meeting_note text,
  p_duration_text text,
  p_scheduled_text text,
  p_intake jsonb,
  p_images text[],
  p_offer_audience text,
  p_max_distance_km int,
  p_private_estimate_minor bigint,
  p_estimated_minutes int,
  p_wizard jsonb,
  p_urgent_until timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  l listings; v_offerer uuid;
  v_old_when text; v_old_desc text; v_old_mode text; v_old_price bigint;
  v_changes text[] := '{}'; v_what text;
begin
  select * into l from listings where id = p_listing_id for update;
  if not found or l.owner_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  -- what it looked like, so the people with a tilbud can be told what changed
  select scheduled_text, description into v_old_when, v_old_desc from task_details where listing_id = p_listing_id;
  v_old_mode := l.price_mode::text;
  v_old_price := l.price_amount_minor;
  if l.status not in ('DRAFT','PUBLISHED','RECEIVING_OFFERS','ACTIVE','PAUSED','EXPIRED') then
    raise exception 'Oppdraget kan ikke endres etter at et tilbud er godtatt.';
  end if;
  if length(trim(p_title)) < 5 then raise exception 'Tittelen må ha minst 5 tegn.'; end if;

  update listings set
    title = trim(p_title),
    category_slug = p_category_slug,
    price_mode = p_price_mode,
    price_amount_minor = p_price_minor,
    municipality = p_municipality,
    place = p_place,
    offer_audience = coalesce(p_offer_audience, 'ALL'),
    max_distance_km = p_max_distance_km,
    estimated_minutes = p_estimated_minutes,
    urgent_until = p_urgent_until,
    status = case when l.status = 'EXPIRED' then 'PUBLISHED'::listing_status else l.status end,
    edited_at = now(),
    updated_at = now()
  where id = p_listing_id;

  insert into task_details (listing_id, description, equipment, meeting_note, duration_text,
      scheduled_text, intake, wizard)
    values (p_listing_id, p_description, nullif(p_equipment,''), nullif(p_meeting_note,''),
      nullif(p_duration_text,''), nullif(p_scheduled_text,''), coalesce(p_intake,'[]'::jsonb), p_wizard)
  on conflict (listing_id) do update set
    description = excluded.description, equipment = excluded.equipment,
    meeting_note = excluded.meeting_note, duration_text = excluded.duration_text,
    scheduled_text = excluded.scheduled_text, intake = excluded.intake, wizard = excluded.wizard;

  insert into listing_private (listing_id, private_estimate_minor)
    values (p_listing_id, p_private_estimate_minor)
  on conflict (listing_id) do update set private_estimate_minor = excluded.private_estimate_minor;

  if p_images is not null then
    delete from listing_images where listing_id = p_listing_id
      and not (storage_path = any(p_images));
    update listing_images li set ord = x.ord - 1
      from unnest(p_images) with ordinality as x(path, ord)
     where li.listing_id = p_listing_id and li.storage_path = x.path;
    insert into listing_images (listing_id, storage_path, ord)
      select p_listing_id, x.path, x.ord - 1 from unnest(p_images) with ordinality as x(path, ord)
       where not exists (select 1 from listing_images li
                          where li.listing_id = p_listing_id and li.storage_path = x.path);
  end if;

  if p_price_minor is distinct from v_old_price or p_price_mode::text <> v_old_mode then v_changes := v_changes || 'prisen'::text; end if;
  if nullif(p_scheduled_text, '') is distinct from v_old_when then v_changes := v_changes || 'tidspunktet'::text; end if;
  if p_place is distinct from l.place or p_municipality is distinct from l.municipality then v_changes := v_changes || 'stedet'::text; end if;
  if p_description is distinct from v_old_desc then v_changes := v_changes || 'beskrivelsen'::text; end if;
  if trim(p_title) is distinct from l.title then v_changes := v_changes || 'tittelen'::text; end if;
  -- an edit of photos or small details only: nothing a tilbud depends on
  if cardinality(v_changes) = 0 then return; end if;
  v_what := case cardinality(v_changes)
    when 1 then v_changes[1]
    else array_to_string(v_changes[1:cardinality(v_changes) - 1], ', ') || ' og ' || v_changes[cardinality(v_changes)] end;

  -- Everyone with an open offer hears what changed.
  for v_offerer in
    select distinct from_profile_id from proposals
     where listing_id = p_listing_id and status in ('SENT','REVISION_PENDING')
  loop
    perform notify(v_offerer, 'OFFER_CHANGED', 'Oppdraget er endret',
      '«' || trim(p_title) || '»: ' || v_what || ' er endret. Sjekk at tilbudet ditt fortsatt passer.',
      '/oppdrag/' || p_listing_id);
  end loop;
end $$;

create or replace function notify_saved_searches() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record; v_owner_verified boolean;
begin
  if new.status::text not in ('PUBLISHED','RECEIVING_OFFERS') then
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
       -- a search can be for «Alle», «Trenger hjelp» or «Tilbyr hjelp»; old ones are always for oppdrag
       and coalesce(nullif(ss.filter->>'type', ''), new.type::text) = new.type::text
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
