-- 0071_urgent_oppdrag.sql
--  Hasteoppdrag: «Det haster» in Legg ut (step «Når») marks an oppdrag as urgent until
--  the end of the chosen day – i dag, i morgen or innen 3 dager. Until then it carries a
--  «Haster» pill and is shown first in the Oppdrag feed (sorted in the app, src/domain/urgent.ts).
--
--  Rules, enforced here because owners can also update `listings` directly (p_listings_upd):
--    * only oppdrag (TASK_REQUEST) can be urgent
--    * the deadline is in the future and at most 4 days away (the app offers up to 3 days
--      to the end of the day; the extra day is slack for time zones)
--    * one hasteoppdrag at a time per nabo – if everyone could flag everything,
--      «først i lista» would mean nothing
--    * an edit can shorten or remove the urgency, never push the deadline later, so an
--      oppdrag can't stay on top for ever by being re-saved every day

alter table public.listings add column if not exists urgent_until timestamptz;

create index if not exists listings_urgent_owner on public.listings (owner_id) where urgent_until is not null;

create or replace function public.enforce_urgent_listing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.urgent_until is null then return new; end if;
  if tg_op = 'UPDATE' then
    if new.urgent_until is not distinct from old.urgent_until then return new; end if;
    -- already urgent: keep the earlier deadline (re-saving the wizard computes a new one).
    -- Exception: «Hjelperen kom ikke» (0074) makes it urgent again for today.
    if old.urgent_until is not null and coalesce(current_setting('minnabo.rescue', true), '') = '' then
      new.urgent_until := least(new.urgent_until, old.urgent_until);
      return new;
    end if;
  end if;

  if new.type <> 'TASK_REQUEST' then
    raise exception 'Bare oppdrag kan merkes «Det haster».';
  end if;
  if new.urgent_until <= now() then
    raise exception 'Fristen for et hasteoppdrag må være fram i tid.';
  end if;
  if new.urgent_until > now() + interval '4 days' then
    raise exception 'Et hasteoppdrag kan ha frist på maks tre dager.';
  end if;
  if exists (
    select 1 from listings o
     where o.owner_id = new.owner_id and o.id <> new.id
       and o.urgent_until > now()
       and o.status in ('PUBLISHED','RECEIVING_OFFERS','ACTIVE')
  ) then
    raise exception 'Du har allerede et hasteoppdrag ute. Du kan ha ett om gangen – vent til fristen er ute, eller fjern «Det haster» på det andre oppdraget.';
  end if;
  return new;
end $$;

drop trigger if exists listings_urgent on public.listings;
create trigger listings_urgent before insert or update of urgent_until on public.listings
  for each row execute function public.enforce_urgent_listing();

-- update_listing (0034) gets the urgency as its last argument. The old signature is dropped
-- so PostgREST has one function to pick; `default null` keeps older app versions (which
-- send 19 arguments and never had real urgency) working – for them it simply means "not urgent".
drop function if exists public.update_listing(uuid, text, text, price_mode, bigint, text, text, text, text, text,
  text, text, jsonb, text[], text, int, bigint, int, jsonb);

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
declare l listings; v_offerer uuid;
begin
  select * into l from listings where id = p_listing_id for update;
  if not found or l.owner_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
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

  -- Everyone with an open offer hears about the change.
  for v_offerer in
    select distinct from_profile_id from proposals
     where listing_id = p_listing_id and status in ('SENT','REVISION_PENDING')
  loop
    perform notify(v_offerer, 'OFFER_CHANGED', 'Oppdraget er endret',
      '«' || trim(p_title) || '» er oppdatert. Sjekk at tilbudet ditt fortsatt passer.',
      '/oppdrag/' || p_listing_id);
  end loop;
end $$;
grant execute on function public.update_listing(uuid, text, text, price_mode, bigint, text, text, text, text, text,
  text, text, jsonb, text[], text, int, bigint, int, jsonb, timestamptz) to authenticated;
