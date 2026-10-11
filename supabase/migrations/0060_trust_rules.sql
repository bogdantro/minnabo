-- 0060_trust_rules.sql
--  * "Anbefalt av naboer": the app says only neighbours with a completed avtale can
--    recommend, but anyone could. Now an endorsement needs a completed agreement
--    (both confirmed) between the two.
--  * An oppdrag could be hard-deleted by its owner, which also deleted every
--    conversation about it (other people's chats too). The app soft-deletes; a hard
--    delete is only allowed while nobody has written about the oppdrag (the publish
--    rollback in the app).
--  * "Vil du anbefale …?" Ja/Nei is stored on the review (reviews.recommends). "Ja" also
--    keeps the "Anbefales" tag the app already shows.

-- --------------------------------------------------------------------------- endorsements
create or replace function has_completed_agreement(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from proposals p
     where ((p.from_profile_id = p_a and p.to_profile_id = p_b)
         or (p.from_profile_id = p_b and p.to_profile_id = p_a))
       and (select count(*) from completion_confirmations c where c.agreement_proposal_id = p.id) >= 2
  );
$$;
revoke all on function has_completed_agreement(uuid, uuid) from public, anon;
grant execute on function has_completed_agreement(uuid, uuid) to authenticated;

drop policy if exists skill_endorsements_write_own on skill_endorsements;
drop policy if exists skill_endorsements_insert on skill_endorsements;
drop policy if exists skill_endorsements_delete_own on skill_endorsements;
create policy skill_endorsements_insert on skill_endorsements for insert to authenticated
  with check (endorser_id = auth.uid() and public.has_completed_agreement(endorser_id, target_id));
create policy skill_endorsements_delete_own on skill_endorsements for delete to authenticated
  using (endorser_id = auth.uid());

-- endorsements given without a completed agreement are removed
delete from skill_endorsements e where not has_completed_agreement(e.endorser_id, e.target_id);

-- --------------------------------------------------------------------------- listings
drop policy if exists p_listings_del on listings;
create policy p_listings_del on listings for delete to authenticated
  using (owner_id = auth.uid()
         and not exists (select 1 from conversations c where c.listing_id = listings.id));

-- --------------------------------------------------------------------------- recommends
alter table reviews add column if not exists recommends boolean;
update reviews set recommends = true where recommends is null and 'Anbefales' = any (tags);

drop function if exists submit_review(uuid, integer, text, text[]);
create or replace function submit_review(p_agreement_proposal_id uuid, p_rating integer, p_comment text,
                                         p_tags text[] default '{}', p_recommends boolean default null)
returns reviews language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_to uuid; v_done int; v_row reviews;
begin
  select * into p from proposals where id = p_agreement_proposal_id;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me is null or v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Ikke tilgang.'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Velg mellom 1 og 5 stjerner.'; end if;

  select count(*) into v_done from completion_confirmations
   where agreement_proposal_id = p_agreement_proposal_id;
  if v_done < 2 then raise exception 'Oppdraget er ikke fullført ennå.'; end if;

  if exists (select 1 from reviews
              where agreement_proposal_id = p_agreement_proposal_id and from_profile_id = v_me) then
    raise exception 'Du har allerede vurdert denne avtalen.';
  end if;

  v_to := case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end;
  insert into reviews (agreement_proposal_id, listing_id, from_profile_id, to_profile_id, rating, comment, tags, recommends)
  values (p_agreement_proposal_id, p.listing_id, v_me, v_to, p_rating, nullif(p_comment, ''), coalesce(p_tags, '{}'), p_recommends)
  returning * into v_row;

  update listings set status = 'REVIEWED' where id = p.listing_id and status = 'COMPLETED';
  return v_row;
end $$;
revoke all on function submit_review(uuid, integer, text, text[], boolean) from public, anon;
grant execute on function submit_review(uuid, integer, text, text[], boolean) to authenticated;

-- visible_reviews shows the new column too (added at the end)
create or replace view visible_reviews as
  select r.id, r.agreement_proposal_id, r.listing_id, r.from_profile_id, r.to_profile_id,
         r.rating, r.comment, r.created_at, r.tags, r.reply, r.replied_at, r.recommends
    from reviews r
   where now() - r.created_at > interval '10 days'
      or exists (select 1 from reviews x
                  where x.agreement_proposal_id = r.agreement_proposal_id
                    and x.from_profile_id = r.to_profile_id);
revoke all on visible_reviews from anon, public;
grant select on visible_reviews to authenticated;
