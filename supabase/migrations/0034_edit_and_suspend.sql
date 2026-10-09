-- 0034_edit_and_suspend.sql
--  * Suspension blocks login: suspending a profile bans its auth user (no new
--    sessions, no token refresh); lifting it un-bans. my_account_status() lets
--    the app sign a suspended user out at once.
--  * Edit an oppdrag after publishing (update_listing) – the wizard form is
--    stored with the details so edit mode reopens exactly what was entered.
--  * Oppdrag fields the wizard already asks for: who can give offers, max
--    distance, private price estimate, estimated minutes.
--  * Edit a sent tilbud (edit_proposal) – the recipient is notified.

-- ---------------------------------------------------------------------------
-- suspension → auth ban
-- ---------------------------------------------------------------------------
create or replace function sync_suspension_ban() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if new.suspended_at is distinct from old.suspended_at then
    update auth.users
       set banned_until = case when new.suspended_at is not null then 'infinity'::timestamptz end
     where id = new.id;
    if new.suspended_at is not null then
      -- end existing sessions so refresh tokens stop working right away
      delete from auth.refresh_tokens where user_id = new.id::text;
      delete from auth.sessions where user_id = new.id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_suspension_ban on profiles;
create trigger profiles_suspension_ban after update of suspended_at on profiles
  for each row execute function sync_suspension_ban();

create or replace function my_account_status()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'suspended', coalesce((select suspended_at is not null from profiles where id = auth.uid()), false),
    'deleted', coalesce((select deleted_at is not null from profiles where id = auth.uid()), false));
$$;
grant execute on function my_account_status() to authenticated;

-- ---------------------------------------------------------------------------
-- oppdrag: new fields + edit
-- ---------------------------------------------------------------------------
alter table listings add column if not exists offer_audience text not null default 'ALL'
  check (offer_audience in ('ALL','VERIFIED'));
alter table listings add column if not exists max_distance_km int check (max_distance_km between 1 and 200);
alter table listings add column if not exists estimated_minutes int check (estimated_minutes > 0);
alter table listings add column if not exists edited_at timestamptz;
alter table task_details add column if not exists wizard jsonb;

-- The private price estimate ("vises ikke") lives in an owner-only table.
create table if not exists listing_private (
  listing_id uuid primary key references listings(id) on delete cascade,
  private_estimate_minor bigint check (private_estimate_minor >= 0)
);
alter table listing_private enable row level security;
drop policy if exists p_listing_private_own on listing_private;
create policy p_listing_private_own on listing_private for all to authenticated
  using (owns_listing(listing_id)) with check (owns_listing(listing_id));

-- "Kun verifiserte": offers on such an oppdrag need a verified phone (Vipps).
create or replace function enforce_offer_audience() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from listings where id = new.listing_id and offer_audience = 'VERIFIED')
     and not exists (select 1 from verifications where profile_id = new.from_profile_id and verified) then
    raise exception 'Bare verifiserte naboer kan gi tilbud på dette oppdraget.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists proposals_offer_audience on proposals;
create trigger proposals_offer_audience before insert on proposals
  for each row execute function enforce_offer_audience();

-- Everything about an oppdrag can change until a tilbud is accepted.
create or replace function update_listing(
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
  p_wizard jsonb)
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
grant execute on function update_listing(uuid, text, text, price_mode, bigint, text, text, text, text, text,
  text, text, jsonb, text[], text, int, bigint, int, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- tilbud: edit while it is still open
-- ---------------------------------------------------------------------------
alter table proposals add column if not exists edited_at timestamptz;

create or replace function edit_proposal(
  p_proposal_id uuid, p_price_minor bigint, p_scheduled_text text, p_message text, p_caveats text)
returns proposals language plpgsql security definer set search_path = public as $$
declare p proposals; v_title text;
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found or p.from_profile_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if p.status not in ('SENT','REVISION_PENDING') then
    raise exception 'Tilbudet kan ikke endres nå.';
  end if;
  if p_price_minor is not null and p_price_minor <= 0 then raise exception 'Prisen må være over 0.'; end if;

  update proposals set
    price_amount_minor = coalesce(p_price_minor, price_amount_minor),
    scheduled_text = nullif(p_scheduled_text, ''),
    message = nullif(p_message, ''),
    caveats = nullif(p_caveats, ''),
    status = 'SENT',
    edited_at = now(),
    updated_at = now()
  where id = p.id
  returning * into p;

  insert into proposal_revisions (proposal_id, actor_id, note, price_amount_minor, scheduled_text, caveats)
    values (p.id, auth.uid(), nullif(p_message,''), p.price_amount_minor, p.scheduled_text, p.caveats);
  insert into messages (conversation_id, author_id, kind, proposal_id, text)
    values (p.conversation_id, auth.uid(), 'PROPOSAL', p.id, '');
  update conversations set last_message_at = now(), last_message_preview = 'Tilbudet er endret'
   where id = p.conversation_id;

  select title into v_title from listings where id = p.listing_id;
  perform notify(p.to_profile_id, 'OFFER_CHANGED', 'Tilbudet er endret',
    'Et tilbud på «' || coalesce(v_title, 'oppdraget ditt') || '» er oppdatert.', '/tilbud/' || p.id);
  return p;
end $$;
grant execute on function edit_proposal(uuid, bigint, text, text, text) to authenticated;
