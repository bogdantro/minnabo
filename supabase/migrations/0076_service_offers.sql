-- 0076_service_offers.sql
--  «Tilbyr hjelp»: besides oppdrag (someone needs help), a nabo can post what they can do –
--  "Plenklipp og hekk, fra 300 kr, ledig hverdager". Listings already have the type
--  SERVICE_OFFER and the service_offer_details table (0001); the rules below were written for
--  oppdrag only and are made to fit.
--
--  How it works:
--    * a nabo opens the post and taps «Spør om hjelp» → a chat (start_conversation_for_listing)
--    * the HELPER (the post's owner) sends the tilbud in that chat → avtale, Jobbdag, review as usual
--    * the post stays open for the next person: an avtale never marks it taken, completed or reviewed
--  Oppdrag-only behaviour skips offers: «Oppdraget har fått en avtale» to other senders (0052),
--  «Oppdraget er ledig igjen» after a no-show (0074), «Det haster» (0071 already refuses it).
--  Youth accounts can't post (block_youth_writes, 0038) and only see oppdrag.

-- Erfaring in years and months: total months (experience_years is kept in step for older readers)
alter table service_offer_details add column if not exists experience_months int check (experience_months between 0 and 1200);

-- ---------------------------------------------------------------------------
-- 1. An avtale never closes an offer
-- ---------------------------------------------------------------------------
create or replace function keep_offer_open() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'SERVICE_OFFER'
     and new.status::text in ('AGREED','OFFER_ACCEPTED','IN_PROGRESS','COMPLETION_SENT','COMPLETED','REVIEWED','RECEIVING_OFFERS') then
    -- the job states belong to the avtale, not to the post; pausing / archiving still works
    new.status := old.status;
  end if;
  return new;
end $$;
drop trigger if exists listings_keep_offer_open on listings;
create trigger listings_keep_offer_open before update of status on listings
  for each row execute function keep_offer_open();

-- ---------------------------------------------------------------------------
-- 2. On an offer it is the helper (the owner) who sends the tilbud
-- ---------------------------------------------------------------------------
create or replace function send_proposal(
  p_conversation_id uuid, p_listing_id uuid, p_price_minor bigint,
  p_message text, p_scheduled_text text, p_caveats text, p_client_token text)
returns proposals language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_owner uuid; v_type listing_type; v_to uuid; v_prop proposals; v_recent int;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;

  select * into v_prop from proposals where client_token = p_client_token;
  if found then return v_prop; end if;

  if not is_participant(p_conversation_id) then
    raise exception 'Du er ikke deltaker i denne samtalen.'; end if;

  select owner_id, type into v_owner, v_type from listings where id = p_listing_id;
  select profile_id into v_to from conversation_participants
   where conversation_id = p_conversation_id and profile_id <> v_me limit 1;

  if v_type = 'SERVICE_OFFER' then
    if v_me <> v_owner then
      raise exception 'Det er den som tilbyr hjelpen som sender tilbud her. Skriv en melding om hva du trenger.';
    end if;
  elsif v_me = v_owner then
    raise exception 'Eieren av oppføringen kan ikke sende tilbud på den.';
  end if;

  select count(*) into v_recent from proposals
   where from_profile_id = v_me and created_at > now() - interval '1 minute';
  perform rate_check(v_recent, 5, 'tilbud');

  insert into proposals (listing_id, conversation_id, from_profile_id, to_profile_id,
      price_amount_minor, message, scheduled_text, caveats, status, client_token)
    values (p_listing_id, p_conversation_id, v_me, v_to,
      p_price_minor, nullif(p_message,''), nullif(p_scheduled_text,''),
      nullif(p_caveats,''), 'SENT', p_client_token)
    returning * into v_prop;

  insert into messages (conversation_id, author_id, kind, proposal_id, text)
    values (p_conversation_id, v_me, 'PROPOSAL', v_prop.id, '');

  perform notify(v_to, 'NEW_OFFER', 'Nytt tilbud',
    'Du har fått et nytt tilbud.', '/tilbud/' || v_prop.id);
  return v_prop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Oppdrag-only messages skip offers
-- ---------------------------------------------------------------------------
create or replace function proposals_notify_others() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text; v_type listing_type; o record;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status::text <> 'ACCEPTED' and not (old.status::text = 'ACCEPTED' and new.status::text = 'CANCELLED') then
    return new;
  end if;
  -- a rescue (0074) writes «Oppdraget er ledig igjen – trengs i dag» itself
  if coalesce(current_setting('minnabo.rescue', true), '') = new.id::text then return new; end if;
  select title, type into v_title, v_type from listings where id = new.listing_id;
  -- on an offer the other tilbud are the helper's own, to other people: nothing changes for them
  if v_type = 'SERVICE_OFFER' then return new; end if;

  for o in
    select id, from_profile_id from proposals
     where listing_id = new.listing_id and id <> new.id and status in ('SENT','REVISION_PENDING')
  loop
    if new.status::text = 'ACCEPTED' then
      insert into notifications (profile_id, kind, title, body, route)
        values (o.from_profile_id, 'OFFER_CHANGED', 'Oppdraget har fått en avtale',
                '«' || coalesce(v_title, 'Oppdraget') || '» har en avtale med en annen nabo. Tilbudet ditt står på vent.',
                '/tilbud/' || o.id);
    else
      insert into notifications (profile_id, kind, title, body, route)
        values (o.from_profile_id, 'OFFER_CHANGED', 'Oppdraget er åpent igjen',
                'Avtalen på «' || coalesce(v_title, 'oppdraget') || '» ble avlyst. Tilbudet ditt gjelder igjen.',
                '/tilbud/' || o.id);
    end if;
  end loop;
  return new;
end $$;

create or replace function ask_other_offers(p_from uuid, p_listing uuid) returns int
language plpgsql security definer set search_path = public as $$
declare o record; v_title text; v_type listing_type; v_n int := 0;
begin
  select title, type into v_title, v_type from listings where id = p_listing;
  if v_type = 'SERVICE_OFFER' then return 0; end if;
  for o in
    select id, from_profile_id from proposals
     where listing_id = p_listing and id <> p_from and status in ('SENT','REVISION_PENDING')
  loop
    update proposals set rescue_from = p_from, rescue_asked_at = now(), available_today_at = null where id = o.id;
    perform notify(o.from_profile_id, 'OFFER_CHANGED', 'Oppdraget er ledig igjen',
      '«' || coalesce(v_title, 'Oppdraget') || '» trengs i dag. Gjelder tilbudet ditt fortsatt?',
      '/tilbud/' || o.id || '?ledig=1');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function ask_other_offers(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Editing an offer (like update_listing for oppdrag, 0071)
-- ---------------------------------------------------------------------------
create or replace function update_offer(
  p_listing_id uuid, p_title text, p_category_slug text, p_price_mode price_mode, p_price_minor bigint,
  p_municipality text, p_place text, p_about text, p_services text[], p_availability_text text,
  p_available_weekdays int[], p_equipment_text text, p_experience_months int, p_max_distance_km int,
  p_images text[])
returns void language plpgsql security definer set search_path = public as $$
declare l listings;
begin
  select * into l from listings where id = p_listing_id for update;
  if not found or l.owner_id <> auth.uid() or l.type <> 'SERVICE_OFFER' then
    raise exception 'Ikke tilgang.' using errcode = '42501';
  end if;
  if length(trim(p_title)) < 5 then raise exception 'Tittelen må ha minst 5 tegn.'; end if;
  if length(trim(coalesce(p_about, ''))) < 20 then raise exception 'Fortell litt mer om hva du kan hjelpe med (minst 20 tegn).'; end if;

  update listings set
    title = trim(p_title), category_slug = p_category_slug, price_mode = p_price_mode,
    price_amount_minor = p_price_minor, municipality = p_municipality, place = p_place,
    edited_at = now(), updated_at = now()
  where id = p_listing_id;

  insert into service_offer_details (listing_id, about, services, availability_text, available_weekdays,
      equipment_text, experience_months, experience_years, max_distance_km)
    values (p_listing_id, trim(p_about), coalesce(p_services, '{}'), nullif(trim(coalesce(p_availability_text, '')), ''),
      coalesce(p_available_weekdays, '{}'), nullif(trim(coalesce(p_equipment_text, '')), ''), p_experience_months, p_experience_months / 12, p_max_distance_km)
  on conflict (listing_id) do update set
    about = excluded.about, services = excluded.services, availability_text = excluded.availability_text,
    available_weekdays = excluded.available_weekdays, equipment_text = excluded.equipment_text,
    experience_months = excluded.experience_months, experience_years = excluded.experience_years,
    max_distance_km = excluded.max_distance_km;

  if p_images is not null then
    delete from listing_images where listing_id = p_listing_id and not (storage_path = any(p_images));
    update listing_images li set ord = x.ord - 1
      from unnest(p_images) with ordinality as x(path, ord)
     where li.listing_id = p_listing_id and li.storage_path = x.path;
    insert into listing_images (listing_id, storage_path, ord)
      select p_listing_id, x.path, x.ord - 1 from unnest(p_images) with ordinality as x(path, ord)
       where not exists (select 1 from listing_images li where li.listing_id = p_listing_id and li.storage_path = x.path);
  end if;
end $$;
revoke all on function update_offer(uuid, text, text, price_mode, bigint, text, text, text, text[], text, int[], text, int, int, text[]) from public, anon;
grant execute on function update_offer(uuid, text, text, price_mode, bigint, text, text, text, text[], text, int[], text, int, int, text[]) to authenticated;
