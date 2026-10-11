-- 0059_blind_reviews.sql
-- Reviews are shown when both parties have reviewed, or when 10 days have passed
-- ("Vurderingen vises når begge har vurdert, eller når fristen går ut"). The rule lived
-- in visible_reviews, but the app read the reviews table (readable for everyone) and the
-- rating average counted hidden reviews too.
--  * visible_reviews also returns the public reply
--  * profile_ratings averages only visible reviews
--  * the reviews table itself: only your own written reviews (and admins)

create or replace view visible_reviews as
  select r.id, r.agreement_proposal_id, r.listing_id, r.from_profile_id, r.to_profile_id,
         r.rating, r.comment, r.created_at, r.tags, r.reply, r.replied_at
    from reviews r
   where now() - r.created_at > interval '10 days'
      or exists (select 1 from reviews x
                  where x.agreement_proposal_id = r.agreement_proposal_id
                    and x.from_profile_id = r.to_profile_id);

create or replace view profile_ratings as
  select to_profile_id as profile_id,
         round(avg(rating), 1) as average,
         count(*)::integer as count
    from visible_reviews
   group by to_profile_id;

drop policy if exists p_reviews_read on reviews;
create policy p_reviews_read on reviews for select to authenticated
  using (from_profile_id = auth.uid() or is_admin());

revoke all on visible_reviews, profile_ratings from anon, public;
grant select on visible_reviews, profile_ratings to authenticated;
