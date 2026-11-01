-- 0072_mandatory_reviews.sql
--  A finished job must be reviewed. Once both have confirmed the job is done, each adult
--  party owes one review of the other: stars are required (1–5, already checked in
--  submit_review, 0060), the text is optional.
--
--  Until the review is given, that person cannot
--    * post a new oppdrag            (insert on listings)
--    * give a tilbud                 (insert on proposals)
--    * accept a tilbud               (proposals -> ACCEPTED, as the recipient)
--  Chat, reports, Sikkerhet and the rest keep working, so nobody is cut off from help or
--  from telling us about a bad experience (a 1-star review is always an option).
--  The app shows the review screen first (ReviewGate.tsx), but these triggers are the
--  rule – an old app version or a direct API call can't get past them.
--
--  Not owed:
--    * by youth accounts (they don't give reviews, 0055)
--    * when the other party has deleted their account
--    * for a cancelled avtale
--    * for jobs completed before this migration (reviews_required_from() below), so people
--      with old jobs aren't suddenly locked out

-- Jobs completed from this moment on need a review.
create or replace function reviews_required_from() returns timestamptz
language sql immutable as $$ select timestamptz '2026-10-30 00:00:00+01' $$;

-- Avtaler where p_profile still owes a review, oldest first.
create or replace function pending_reviews_of(p_profile uuid)
returns table (proposal_id uuid, listing_id uuid, listing_title text, other_id uuid, other_name text, completed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.listing_id, l.title,
         o.id, o.display_name,
         (select max(c.confirmed_at) from completion_confirmations c where c.agreement_proposal_id = p.id)
    from proposals p
    join listings l on l.id = p.listing_id
    join profiles o on o.id = case when p.from_profile_id = p_profile then p.to_profile_id else p.from_profile_id end
   where p_profile in (p.from_profile_id, p.to_profile_id)
     and p.status::text <> 'CANCELLED'
     and not is_youth(p_profile)
     and o.deleted_at is null
     and (select count(*) from completion_confirmations c where c.agreement_proposal_id = p.id) >= 2
     and (select max(c.confirmed_at) from completion_confirmations c where c.agreement_proposal_id = p.id) >= reviews_required_from()
     and not exists (select 1 from reviews r where r.agreement_proposal_id = p.id and r.from_profile_id = p_profile)
   order by 6;
$$;
revoke all on function pending_reviews_of(uuid) from public, anon, authenticated;

-- What the app reads: my own pending reviews.
create or replace function my_pending_reviews()
returns table (proposal_id uuid, listing_id uuid, listing_title text, other_id uuid, other_name text, completed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from pending_reviews_of(auth.uid());
$$;
revoke all on function my_pending_reviews() from public, anon;
grant execute on function my_pending_reviews() to authenticated;

create or replace function raise_if_review_pending(p_profile uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_name text;
begin
  select other_name into v_name from pending_reviews_of(p_profile) limit 1;
  if found then
    raise exception 'Gi en vurdering av % først. Stjerner er nok – kommentar er valgfritt.',
      coalesce(split_part(v_name, ' ', 1), 'naboen');
  end if;
end $$;
revoke all on function raise_if_review_pending(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------ the rule

create or replace function enforce_review_before_listing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform raise_if_review_pending(new.owner_id);
  return new;
end $$;
drop trigger if exists listings_review_first on listings;
create trigger listings_review_first before insert on listings
  for each row execute function enforce_review_before_listing();

create or replace function enforce_review_before_proposal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform raise_if_review_pending(new.from_profile_id);
  elsif new.status::text = 'ACCEPTED' and old.status::text <> 'ACCEPTED' then
    -- the one accepting is the recipient of the tilbud
    perform raise_if_review_pending(new.to_profile_id);
  end if;
  return new;
end $$;
drop trigger if exists proposals_review_first on proposals;
create trigger proposals_review_first before insert or update of status on proposals
  for each row execute function enforce_review_before_proposal();

-- ------------------------------------------------------------------ the notification
-- confirm_completion (0055) unchanged, except the text: the review is no longer «gjerne».
create or replace function confirm_completion(p_agreement_proposal_id uuid)
returns setof completion_confirmations language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_both int; v_party uuid; v_new int;
begin
  select * into p from proposals where id = p_agreement_proposal_id;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Ikke tilgang.'; end if;

  insert into completion_confirmations (agreement_proposal_id, by_profile_id)
    values (p_agreement_proposal_id, v_me)
  on conflict do nothing;
  get diagnostics v_new = row_count;

  -- confirming twice changes nothing and sends nothing again
  if v_new = 0 then
    return query select * from completion_confirmations
      where agreement_proposal_id = p_agreement_proposal_id;
    return;
  end if;

  select count(*) into v_both from completion_confirmations
   where agreement_proposal_id = p_agreement_proposal_id;
  if v_both >= 2 then
    update listings set status = 'COMPLETED' where id = p.listing_id;
    foreach v_party in array array[p.from_profile_id, p.to_profile_id] loop
      if is_youth(v_party) then
        perform notify(v_party,'REVIEW_RECEIVED','Oppdrag fullført',
          'Oppdraget er markert som fullført. Bra jobbet!','/ung');
      else
        perform notify(v_party,'REVIEW_RECEIVED','Oppdrag fullført – gi en vurdering',
          'Velg antall stjerner for å fullføre. Du må gi vurderingen før du kan legge ut eller gi tilbud igjen.','/vurder/'||p.id);
      end if;
    end loop;
  else
    perform notify(case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end,
      'COMPLETION_REQUESTED','Bekreft fullføring',
      'Den andre parten markerte oppdraget som fullført.','/fullfor/'||p.id);
  end if;

  return query select * from completion_confirmations
    where agreement_proposal_id = p_agreement_proposal_id;
end $$;
