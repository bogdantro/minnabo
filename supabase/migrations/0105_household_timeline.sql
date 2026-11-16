-- 0105 Husstand, redesigned (2026-11-13)
--
-- 1. my_household() also gives:
--    - since: when the two became a household
--    - each oppdrag's kind (categorySlug) and first photo (imagePath), for the cards
--    - «Hvem kommer når»: the coming avtaler of BOTH adults in one list, each marked
--      who = 'me' | 'partner' | 'both', so the two can see who is coming to the house when.
--      Only the title, the time and the other person's name: never a place or a price.
-- 2. household_leave() tells the one who stays. The «Gå ut» dialog has always said
--    «… får beskjed», but nothing was sent.
-- 3. Leaving while alone with an open code just takes the invitation back.

create or replace function my_household() returns json
language sql stable security definer set search_path = public as $$
  with me as (select household_id from household_members where profile_id = auth.uid()),
       other as (select m.profile_id from household_members m, me where m.household_id = me.household_id and m.profile_id <> auth.uid()),
       pair as (select auth.uid() as profile_id union all select profile_id from other),
       coming as (
         select distinct on (p.id) p.id, l.title, l.category_slug, s.scheduled_at, p.scheduled_text, p.from_profile_id, p.to_profile_id
           from proposals p
           join agreement_snapshots s on s.proposal_id = p.id
           join listings l on l.id = p.listing_id
          where exists (select 1 from other)
            and (p.from_profile_id in (select profile_id from pair) or p.to_profile_id in (select profile_id from pair))
            and p.status::text = 'ACCEPTED' and s.cancelled_at is null
            and (s.scheduled_at is null or s.scheduled_at > now() - interval '12 hours')
            and not exists (select 1 from completion_confirmations c where c.agreement_proposal_id = p.id
                            group by c.agreement_proposal_id having count(*) >= 2)
          order by p.id
       )
  select json_build_object(
    'inHousehold', exists (select 1 from me),
    'since', (select max(m.joined_at) from household_members m, me where m.household_id = me.household_id and exists (select 1 from other)),
    'code', (select json_build_object('code', i.code, 'expiresAt', i.expires_at) from household_invites i, me
               where i.household_id = me.household_id and i.expires_at > now() limit 1),
    'partner', (select json_build_object('id', p.id, 'name', p.display_name) from profiles p, other where p.id = other.profile_id),
    'listings', coalesce((select json_agg(json_build_object(
                    'id', l.id, 'title', l.title, 'status', l.status, 'createdAt', l.created_at, 'categorySlug', l.category_slug,
                    'imagePath', (select i.storage_path from listing_images i where i.listing_id = l.id order by i.ord limit 1))
                    order by l.created_at desc)
                  from listings l, other where l.owner_id = other.profile_id and l.status::text in ('PUBLISHED','RECEIVING_OFFERS','OFFER_ACCEPTED')), '[]'::json),
    'agreements', coalesce((select json_agg(json_build_object(
                    'proposalId', c.id, 'title', c.title, 'categorySlug', c.category_slug,
                    'scheduledAt', c.scheduled_at, 'scheduledText', c.scheduled_text,
                    'who', case
                             when auth.uid() in (c.from_profile_id, c.to_profile_id) and (select profile_id from other) in (c.from_profile_id, c.to_profile_id) then 'both'
                             when auth.uid() in (c.from_profile_id, c.to_profile_id) then 'me'
                             else 'partner' end,
                    'with', (select display_name from profiles
                              where id = case when c.from_profile_id in (select profile_id from pair) then c.to_profile_id else c.from_profile_id end))
                    order by c.scheduled_at nulls last)
                  from coming c), '[]'::json));
$$;
revoke all on function my_household() from public, anon;
grant execute on function my_household() to authenticated;

create or replace function household_leave() returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_house uuid; v_other uuid;
begin
  select household_id into v_house from household_members where profile_id = v_me;
  if v_house is null then return; end if;
  select profile_id into v_other from household_members where household_id = v_house and profile_id <> v_me;
  delete from household_members where profile_id = v_me;
  if v_other is null then
    -- alone with an open code: the household and the code go away together
    delete from households where id = v_house;
  else
    insert into notifications (profile_id, kind, title, body, route)
      values (v_other, 'NOTICE_REPLY'::text::notification_kind, coalesce(first_name(v_me), 'Naboen') || ' gikk ut av husstanden',
              'Dere ser ikke lenger hverandres oppdrag og avtaler.', '/husstand');
  end if;
end $$;
revoke all on function household_leave() from public, anon;
grant execute on function household_leave() to authenticated;
