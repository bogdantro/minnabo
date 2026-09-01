-- New #8/#9: helper availability weekdays + instant booking.

alter table service_offer_details
  add column if not exists available_weekdays smallint[] not null default '{}',
  add column if not exists instant_book boolean not null default false;

-- instant_book(listing_id): for an offer that allows it, open the conversation,
-- auto-accept a proposal at the offer's price, return the proposal id.
create or replace function instant_book(p_listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_price_minor bigint;
  v_price_currency text;
  v_conversation uuid;
  v_proposal uuid;
begin
  select l.owner_id, l.price_amount_minor, l.price_currency
    into v_owner, v_price_minor, v_price_currency
  from listings l
  join service_offer_details s on s.listing_id = l.id and s.instant_book
  where l.id = p_listing_id;

  if v_owner is null then
    raise exception 'Direktebooking er ikke tilgjengelig.';
  end if;
  if v_owner = auth.uid() then
    raise exception 'Du kan ikke booke deg selv.';
  end if;

  -- reuse or create the conversation
  select c.id into v_conversation
  from conversations c where c.listing_id = p_listing_id
  and exists (select 1 from conversation_participants p
              where p.conversation_id = c.id and p.profile_id = auth.uid());

  if v_conversation is null then
    insert into conversations (listing_id) values (p_listing_id) returning id into v_conversation;
    insert into conversation_participants (conversation_id, profile_id)
    values (v_conversation, auth.uid()), (v_conversation, v_owner);
  end if;

  insert into proposals (listing_id, conversation_id, from_profile_id, to_profile_id,
    price_amount_minor, price_currency, status)
  values (p_listing_id, v_conversation, v_owner, auth.uid(),
    coalesce(v_price_minor, 0), coalesce(v_price_currency, 'NOK'), 'ACCEPTED')
  returning id into v_proposal;

  insert into agreement_snapshots (proposal_id, listing_id, price_amount_minor, price_currency, description, agreed_at)
  values (v_proposal, p_listing_id, coalesce(v_price_minor, 0), coalesce(v_price_currency, 'NOK'), '', now());

  return v_proposal;
end;
$$;

grant execute on function instant_book(uuid) to authenticated;
