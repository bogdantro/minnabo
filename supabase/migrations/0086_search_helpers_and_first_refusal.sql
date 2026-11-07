-- 0086_search_helpers_and_first_refusal.sql
--  Asked 2026-11-06. Everything here is additive: older app versions keep working.
--    * Search finds «Tilbyr hjelp» too: the index now covers the description, what a helper offers
--      and the kommune – not only the title, place and category.
--    * «Når» in Søk: the days an oppdrag can be done, as real dates (task_details.scheduled_days),
--      read from the wizard form the app already stores. No new app argument, so an old build fills
--      them in as well.
--    * More than one helper: «Antall hjelpere» is respected. An oppdrag for 2 stays open after the
--      first accepted tilbud; the slot count is read from the same wizard form.
--    * «Send til faste hjelpere først»: only the helpers the owner follows see the oppdrag for the
--      first two hours; then it goes public and the area hears about it.
--    * Hourly price: price_mode 'HOURLY' (the amount is kr per hour).
--    * The push for a new oppdrag follows «Dette kan jeg hjelpe med», so people hear about the jobs
--      they want instead of every job in the area. Someone with no categories chosen hears all.

alter type price_mode add value if not exists 'HOURLY';

alter table listings add column if not exists helpers_needed int not null default 1;
alter table listings drop constraint if exists listings_helpers_needed_range;
alter table listings add constraint listings_helpers_needed_range check (helpers_needed between 1 and 20);
alter table listings add column if not exists first_to_followed_until timestamptz;

alter table task_details add column if not exists scheduled_days date[];

-- ---------------------------------------------------------------------------
-- 1. Search index
-- ---------------------------------------------------------------------------
create or replace function listing_search_text(p_id uuid, p_title text, p_place text, p_municipality text, p_category text)
returns text language sql stable security definer set search_path = public as $$
  select concat_ws(' ', p_title, p_place, p_municipality, p_category,
    (select c.label from categories c where c.slug = p_category),
    (select td.description from task_details td where td.listing_id = p_id),
    (select concat_ws(' ', so.about, array_to_string(so.services, ' '), so.equipment_text)
       from service_offer_details so where so.listing_id = p_id));
$$;
revoke all on function listing_search_text(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function listings_search_tsv() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.search := to_tsvector('simple', listing_search_text(new.id, new.title, new.place, new.municipality, new.category_slug));
  return new;
end $$;

-- The text lives in the detail tables, written just after the listing row: refresh when they change.
create or replace function listing_details_touch_search() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update listings l
     set search = to_tsvector('simple', listing_search_text(l.id, l.title, l.place, l.municipality, l.category_slug))
   where l.id = new.listing_id;
  return new;
end $$;
drop trigger if exists t_task_details_search on task_details;
create trigger t_task_details_search after insert or update on task_details
  for each row execute function listing_details_touch_search();
drop trigger if exists t_offer_details_search on service_offer_details;
create trigger t_offer_details_search after insert or update on service_offer_details
  for each row execute function listing_details_touch_search();

-- ---------------------------------------------------------------------------
-- 2. Days and helpers, read from the wizard form
-- ---------------------------------------------------------------------------
-- «Innen fre 9. okt» can be done any day up to the deadline; the other modes are the days picked.
create or replace function wizard_days(p_wizard jsonb, p_from date) returns date[]
language plpgsql stable as $$
declare v_days date[]; v_mode text := p_wizard->>'whenMode';
begin
  if p_wizard is null or jsonb_typeof(p_wizard->'days') is distinct from 'array' then return null; end if;
  select array_agg(d::date order by d) into v_days
    from jsonb_array_elements_text(p_wizard->'days') d
   where d ~ '^\d{4}-\d{2}-\d{2}$';
  if v_days is null then return null; end if;
  if v_mode = 'innen' then
    select array_agg(g::date) into v_days
      from generate_series(least(p_from, v_days[cardinality(v_days)]), v_days[cardinality(v_days)], interval '1 day') g;
  end if;
  return v_days;
exception when others then
  -- a form we can't read must never stop an oppdrag from being saved
  return null;
end $$;

create or replace function task_details_derive() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.wizard is not null then
    new.scheduled_days := wizard_days(new.wizard, current_date);
  end if;
  return new;
end $$;
drop trigger if exists t_task_details_derive on task_details;
create trigger t_task_details_derive before insert or update of wizard on task_details
  for each row execute function task_details_derive();

create or replace function task_details_helpers() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_n int; v_taken int;
begin
  if new.wizard is null or coalesce(new.wizard->>'helpers', '') !~ '^\d+$' then return new; end if;
  v_n := least(greatest((new.wizard->>'helpers')::int, 1), 20);
  -- never below the helpers already agreed with
  select count(*) into v_taken from proposals where listing_id = new.listing_id and status = 'ACCEPTED';
  update listings set helpers_needed = greatest(v_n, v_taken)
   where id = new.listing_id and helpers_needed is distinct from greatest(v_n, v_taken);
  return new;
end $$;
drop trigger if exists t_task_details_helpers on task_details;
create trigger t_task_details_helpers after insert or update of wizard on task_details
  for each row execute function task_details_helpers();

-- ---------------------------------------------------------------------------
-- 3. An oppdrag stays open until it has all its helpers
-- ---------------------------------------------------------------------------
create or replace function listing_accepted_count(p_listing uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from proposals where listing_id = p_listing and status = 'ACCEPTED';
$$;
revoke all on function listing_accepted_count(uuid) from public, anon, authenticated;

create or replace function keep_offer_open() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'SERVICE_OFFER'
     and new.status::text in ('AGREED','OFFER_ACCEPTED','IN_PROGRESS','COMPLETION_SENT','COMPLETED','REVIEWED','RECEIVING_OFFERS') then
    -- the job states belong to the avtale, not to the post; pausing / archiving still works
    new.status := old.status;
  elsif new.type = 'TASK_REQUEST'
     and new.helpers_needed > 1
     and new.status::text in ('AGREED','OFFER_ACCEPTED','IN_PROGRESS','COMPLETION_SENT','COMPLETED','REVIEWED')
     and old.status::text in ('PUBLISHED','RECEIVING_OFFERS','ACTIVE')
     and listing_accepted_count(new.id) < new.helpers_needed then
    -- room for one more helper: the post stays open, the avtale itself lives on the proposal
    new.status := old.status;
  end if;
  return new;
end $$;

-- «Oppdraget har fått en avtale. Tilbudet ditt står på vent» only when the last place is taken.
create or replace function proposals_notify_others() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text; v_type listing_type; v_needed int; o record;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status::text <> 'ACCEPTED' and not (old.status::text = 'ACCEPTED' and new.status::text = 'CANCELLED') then
    return new;
  end if;
  -- a rescue (0074) writes «Oppdraget er ledig igjen – trengs i dag» itself
  if coalesce(current_setting('minnabo.rescue', true), '') = new.id::text then return new; end if;
  select title, type, helpers_needed into v_title, v_type, v_needed from listings where id = new.listing_id;
  -- on an offer the other tilbud are the helper's own, to other people: nothing changes for them
  if v_type = 'SERVICE_OFFER' then return new; end if;
  -- still room for another helper: the other tilbud are as open as they were
  if new.status::text = 'ACCEPTED' and listing_accepted_count(new.listing_id) < v_needed then return new; end if;

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

-- How many are needed and how many are agreed – a number only, never who.
create or replace function listing_helper_slots(p_listing_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('needed', l.helpers_needed, 'taken', listing_accepted_count(l.id))
    from listings l where l.id = p_listing_id;
$$;
revoke all on function listing_helper_slots(uuid) from public, anon;
grant execute on function listing_helper_slots(uuid) to authenticated;

-- «Jeg trenger ikke flere»: the owner settles for the helpers they have.
create or replace function close_helper_slots(p_listing_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l listings; v_taken int;
begin
  select * into l from listings where id = p_listing_id for update;
  if not found or l.owner_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  v_taken := listing_accepted_count(p_listing_id);
  if v_taken = 0 then raise exception 'Godta et tilbud først.'; end if;
  update listings set helpers_needed = v_taken where id = p_listing_id;
  update listings set status = 'AGREED'
   where id = p_listing_id and status::text in ('PUBLISHED','RECEIVING_OFFERS','ACTIVE');
end $$;
revoke all on function close_helper_slots(uuid) from public, anon;
grant execute on function close_helper_slots(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. «Send til faste hjelpere først»
-- ---------------------------------------------------------------------------
create or replace function is_followed_by(p_follower uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from follows where follower_id = p_follower and followed_id = auth.uid());
$$;
revoke all on function is_followed_by(uuid) from public, anon;
grant execute on function is_followed_by(uuid) to authenticated;

drop policy if exists p_listings_read on listings;
create policy p_listings_read on listings for select to authenticated
  using (
    ((status <> 'REMOVED' and not admin_hidden)
      and (invited_profile_id is null or invited_profile_id = auth.uid())
      and (first_to_followed_until is null or first_to_followed_until <= now() or is_followed_by(owner_id)))
    or owner_id = auth.uid()
    or is_admin()
  );

-- A client can't keep an oppdrag private for longer than the head start, or start one later.
create or replace function guard_first_refusal() returns trigger
language plpgsql as $$
begin
  if new.first_to_followed_until is not null then
    if tg_op = 'UPDATE' and old.first_to_followed_until is null then
      new.first_to_followed_until := null;
    elsif new.first_to_followed_until > now() + interval '2 hours 5 minutes' then
      new.first_to_followed_until := now() + interval '2 hours';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists t_listings_first_refusal on listings;
create trigger t_listings_first_refusal before insert or update of first_to_followed_until on listings
  for each row execute function guard_first_refusal();

create or replace function listing_publicly_visible(l listings) returns boolean
language sql stable as $$
  select l.type::text in ('TASK_REQUEST', 'SERVICE_OFFER')
     and l.status::text in ('PUBLISHED', 'RECEIVING_OFFERS')
     and not coalesce(l.pending_review, false)
     and not coalesce(l.admin_hidden, false)
     and l.invited_profile_id is null
     and (l.first_to_followed_until is null or l.first_to_followed_until <= now());
$$;

create or replace function notify_kommune_new_oppdrag() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_route text := '/oppdrag/' || new.id; v_offer boolean := new.type::text = 'SERVICE_OFFER'; v_owner text;
begin
  -- the head start: only the helpers the owner follows hear about it now
  if new.first_to_followed_until is not null and new.first_to_followed_until > now()
     and tg_op = 'INSERT' and new.status::text in ('PUBLISHED', 'RECEIVING_OFFERS')
     and not coalesce(new.pending_review, false) and not coalesce(new.admin_hidden, false) then
    v_owner := first_name(new.owner_id);
    insert into notifications (profile_id, kind, title, body, route)
    select f.followed_id, 'NEW_MATCH'::text::notification_kind,
           coalesce(v_owner, 'En nabo') || ' spør deg først',
           '«' || new.title || '» · De andre får se oppdraget om to timer.',
           v_route
      from follows f
      join profiles p on p.id = f.followed_id
     where f.follower_id = new.owner_id and p.deleted_at is null and p.suspended_at is null;
    return new;
  end if;

  if not listing_publicly_visible(new) then return new; end if;
  -- only the moment it becomes visible, never on an edit of an oppdrag that already was.
  -- When the head start ends, `old` already looks visible by the clock, so that counts on its own.
  if tg_op = 'UPDATE' and listing_publicly_visible(old)
     and not (old.first_to_followed_until is not null and new.first_to_followed_until is null) then
    return new;
  end if;

  insert into notifications (profile_id, kind, title, body, route)
  select p.id, 'NEW_MATCH'::text::notification_kind,
         case when v_offer then 'En nabo tilbyr hjelp i ' else 'Nytt oppdrag i ' end || new.municipality,
         '«' || new.title || '» · ' || new.place,
         v_route
    from profiles p
   where p.municipality = any(kommune_group(new.municipality))
     and p.id <> new.owner_id
     and p.deleted_at is null
     and p.suspended_at is null
     and not coalesce(p.paused, false)
     and (not is_youth(p.id) or (not v_offer and youth_offer_category(new.category_slug)))
     -- oppdrag follow what the person wants to help with; «Tilgjengelig for småjobber» off = none.
     -- A «Tilbyr hjelp» is for people who need help, so it doesn't depend on their skills.
     and (v_offer or (coalesce(p.available_for_jobs, true)
                      and (coalesce(cardinality(p.category_slugs), 0) = 0 or new.category_slug = any(p.category_slugs))))
     and not exists (select 1 from blocks b
                      where (b.by_profile_id = p.id and b.blocked_profile_id = new.owner_id)
                         or (b.by_profile_id = new.owner_id and b.blocked_profile_id = p.id))
     and not exists (select 1 from notifications n
                      where n.profile_id = p.id and n.kind::text = 'NEW_MATCH' and n.route = v_route);
  return new;
end $$;

-- When the two hours are up the column is cleared: that update makes the oppdrag "newly visible",
-- so the trigger above tells the area (followers already heard, the route check skips them).
create or replace function release_first_refusals() returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update listings set first_to_followed_until = null
   where first_to_followed_until is not null and first_to_followed_until <= now();
  get diagnostics v = row_count;
  return v;
end $$;
revoke all on function release_first_refusals() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Fill in what already exists
-- ---------------------------------------------------------------------------
update task_details set scheduled_days = wizard_days(wizard, (select l.created_at::date from listings l where l.id = listing_id))
 where wizard is not null;
update listings l set helpers_needed = least(greatest((td.wizard->>'helpers')::int, 1), 20)
  from task_details td
 where td.listing_id = l.id and td.wizard->>'helpers' ~ '^\d+$'
   and l.status::text in ('PUBLISHED','RECEIVING_OFFERS','ACTIVE');
update listings set search = to_tsvector('simple', listing_search_text(id, title, place, municipality, category_slug));

do $$ begin
  begin
    perform cron.unschedule('minnabo-first-refusal');
  exception when others then null;
  end;
  perform cron.schedule('minnabo-first-refusal', '*/10 * * * *', 'select public.release_first_refusals()');
exception when others then
  raise notice 'The head start is not released automatically (%). Enable pg_cron and run this block again.', sqlerrm;
end $$;
