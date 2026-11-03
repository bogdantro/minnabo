-- 0084_youth_service_offers.sql
--  Youth accounts (under 18) may post «Tilbyr hjelp» (asked 2026-11-03): "Jeg kan måke snø og lufte hunden".
--  Oppdrag stay locked for them, and so does everything else in block_youth_writes (0038).
--
--  What changes for a youth:
--    * insert / edit / pause / delete their own SERVICE_OFFER – only in the youth categories
--      (the same four the youth app lists oppdrag in: YOUTH_CATS in src/domain/youth.ts)
--    * write in a chat a nabo started on that offer («Spør om hjelp») – before, a youth could only
--      write after giving a tilbud; on an offer the youth is the one who sends the tilbud (0076)
--  Unchanged: the foresatt still hears about every avtale (proposals_notify_guardians, 0053), and the
--  nabo sees «Ungdomskonto · 16 år» on the post and on the tilbud.

create or replace function youth_offer_category(p_slug text) returns boolean
language sql immutable as $$
  select p_slug in ('hage', 'dyrepass', 'datahjelp', 'snomaking');
$$;

-- ---------------------------------------------------------------------------
-- 1. Posting: a «Tilbyr hjelp» in a youth category, never an oppdrag
-- ---------------------------------------------------------------------------
create or replace function block_youth_listing_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_youth(auth.uid()) then return new; end if;
  if new.type::text <> 'SERVICE_OFFER' then
    raise exception 'Med ungdomskonto kan du fortelle hva du kan hjelpe med, men ikke legge ut oppdrag.'
      using errcode = '42501';
  end if;
  if not youth_offer_category(new.category_slug) then
    raise exception 'Velg hage, dyrepass, datahjelp eller snømåking.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists listings_block_youth on listings;
create trigger listings_block_youth before insert on listings
  for each row execute function block_youth_listing_insert();

-- ---------------------------------------------------------------------------
-- 2. Editing their own offer (pause, change, delete) – an offer can't be turned into an oppdrag
-- ---------------------------------------------------------------------------
create or replace function block_youth_listing_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.owner_id = auth.uid() and is_youth(auth.uid()) then
    if old.type::text <> 'SERVICE_OFFER' or new.type::text <> 'SERVICE_OFFER' then
      raise exception 'Dette er ikke tilgjengelig for ungdomskontoer.' using errcode = '42501';
    end if;
    if new.category_slug is distinct from old.category_slug and not youth_offer_category(new.category_slug) then
      raise exception 'Velg hage, dyrepass, datahjelp eller snømåking.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Chat: their own tilbud's conversations (as before) or a chat on their own offer
-- ---------------------------------------------------------------------------
create or replace function youth_message_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.author_id = auth.uid() and new.kind::text <> 'SYSTEM'
     and is_youth(auth.uid())
     and not exists (select 1 from proposals p
                      where p.conversation_id = new.conversation_id
                        and p.from_profile_id = auth.uid())
     and not exists (select 1 from conversations c join listings l on l.id = c.listing_id
                      where c.id = new.conversation_id
                        and l.owner_id = auth.uid() and l.type::text = 'SERVICE_OFFER') then
    raise exception 'Gi et tilbud først – da kan dere skrive sammen.' using errcode = '42501';
  end if;
  return new;
end $$;
