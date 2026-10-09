-- 0047_taken_oppdrag.sql
-- An oppdrag with an accepted tilbud is taken: it leaves the feed and every
-- search (the app only lists PUBLISHED / RECEIVING_OFFERS), and nobody can give
-- or accept another tilbud on it. If the avtale is called off, cancel_agreement
-- (0026) puts the oppdrag back to RECEIVING_OFFERS and it shows up again.
--
-- The status change on accept already existed (0003 sets AGREED); what was
-- missing is that the rest of the system respects it.

create or replace function is_open_listing(p_listing_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from listings
                  where id = p_listing_id
                    and status::text in ('PUBLISHED','RECEIVING_OFFERS','ACTIVE')
                    and not admin_hidden);
$$;

-- No new tilbud on an oppdrag that is taken, paused, archived or removed.
create or replace function proposals_need_open_listing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_open_listing(new.listing_id) then
    raise exception 'Oppdraget er ikke lenger åpent for tilbud.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists proposals_open_listing on proposals;
create trigger proposals_open_listing before insert on proposals
  for each row execute function proposals_need_open_listing();

-- Only one tilbud can be accepted: accepting needs the oppdrag to still be open.
create or replace function proposals_accept_needs_open_listing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status::text = 'ACCEPTED' and old.status::text <> 'ACCEPTED' and not is_open_listing(new.listing_id) then
    raise exception 'Oppdraget har allerede en avtale.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists proposals_accept_open_listing on proposals;
create trigger proposals_accept_open_listing before update of status on proposals
  for each row execute function proposals_accept_needs_open_listing();
