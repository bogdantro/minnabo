-- New #39 (structured review tags) + #38 (blind two-way reviews).

alter table reviews
  add column if not exists tags text[] not null default '{}';

-- submit_review gains p_tags. Reviews stay hidden from the public reviews view
-- until the other party has also reviewed the same agreement, or the reveal
-- window (10 days) passes.
create or replace function submit_review(
  p_agreement_proposal_id uuid,
  p_rating int,
  p_comment text,
  p_tags text[] default '{}'
) returns reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row reviews;
  v_listing uuid;
  v_to uuid;
begin
  select listing_id,
         case when from_profile_id = auth.uid() then to_profile_id else from_profile_id end
    into v_listing, v_to
  from proposals where id = p_agreement_proposal_id;

  insert into reviews (agreement_proposal_id, listing_id, from_profile_id, to_profile_id, rating, comment, tags)
  values (p_agreement_proposal_id, v_listing, auth.uid(), v_to, p_rating, nullif(p_comment, ''), p_tags)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function submit_review(uuid, int, text, text[]) to authenticated;

create or replace view visible_reviews as
  select r.*
  from reviews r
  where now() - r.created_at > interval '10 days'
     or exists (
       select 1 from reviews x
       where x.agreement_proposal_id = r.agreement_proposal_id
         and x.from_profile_id = r.to_profile_id
     );
