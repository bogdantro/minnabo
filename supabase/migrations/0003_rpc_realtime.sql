-- 0003_rpc_realtime.sql — RPC functions, rate limits, realtime (spec §4)

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function notify(p_profile uuid, p_kind notification_kind,
  p_title text, p_body text, p_route text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (profile_id, kind, title, body, route)
  values (p_profile, p_kind, p_title, p_body, p_route);
end $$;

create or replace function rate_check(p_count int, p_max int, p_what text)
returns void language plpgsql as $$
begin
  if p_count >= p_max then
    raise exception 'For mange %. Vent litt og prøv igjen.', p_what
      using errcode = 'check_violation';
  end if;
end $$;

-- proposal transition table — mirrors src/domain/proposalMachine.ts
create or replace function proposal_next(
  p_from proposal_status, p_event text, p_actor text)
returns proposal_status language plpgsql as $$
begin
  if p_from = 'DRAFT' and p_event = 'SEND' and p_actor = 'PROPOSER' then return 'SENT'; end if;
  if p_from = 'SENT' then
    if p_event = 'WITHDRAW' and p_actor = 'PROPOSER'  then return 'WITHDRAWN'; end if;
    if p_event = 'DECLINE'  and p_actor = 'RECIPIENT' then return 'DECLINED';  end if;
    if p_event = 'ACCEPT'   and p_actor = 'RECIPIENT' then return 'ACCEPTED';  end if;
    if p_event = 'REQUEST_REVISION' and p_actor = 'RECIPIENT' then return 'REVISION_PENDING'; end if;
  end if;
  if p_from = 'ACCEPTED' and p_event = 'REQUEST_REVISION' and p_actor = 'RECIPIENT'
    then return 'REVISION_PENDING'; end if;
  if p_from = 'REVISION_PENDING' then
    if p_event = 'SUBMIT_REVISION'  and p_actor = 'PROPOSER'  then return 'SENT';      end if;
    if p_event = 'CONFIRM_REVISION' and p_actor = 'PROPOSER'  then return 'ACCEPTED';  end if;
    if p_event = 'WITHDRAW'         and p_actor = 'PROPOSER'  then return 'WITHDRAWN'; end if;
    if p_event = 'DECLINE'          and p_actor = 'RECIPIENT' then return 'DECLINED';  end if;
  end if;
  raise exception 'Ugyldig endring av tilbudet.' using errcode = 'check_violation';
end $$;

-- ---------------------------------------------------------------------------
-- conversation + proposal RPCs
-- ---------------------------------------------------------------------------
create or replace function start_conversation_for_listing(p_listing_id uuid)
returns conversations language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_me uuid := auth.uid(); v_conv conversations;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  select owner_id into v_owner from listings where id = p_listing_id;
  if v_owner is null then raise exception 'Fant ikke oppføringen.'; end if;
  if v_owner = v_me then raise exception 'Du kan ikke kontakte deg selv.'; end if;

  select c.* into v_conv from conversations c
    join conversation_participants a on a.conversation_id = c.id and a.profile_id = v_me
    join conversation_participants b on b.conversation_id = c.id and b.profile_id = v_owner
   where c.listing_id = p_listing_id limit 1;
  if found then return v_conv; end if;

  insert into conversations (listing_id) values (p_listing_id) returning * into v_conv;
  insert into conversation_participants (conversation_id, profile_id)
    values (v_conv.id, v_me), (v_conv.id, v_owner);
  return v_conv;
end $$;

create or replace function send_proposal(
  p_conversation_id uuid, p_listing_id uuid, p_price_minor bigint,
  p_message text, p_scheduled_text text, p_caveats text, p_client_token text)
returns proposals language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_owner uuid; v_to uuid; v_prop proposals; v_recent int;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;

  select * into v_prop from proposals where client_token = p_client_token;
  if found then return v_prop; end if;

  if not is_participant(p_conversation_id) then
    raise exception 'Du er ikke deltaker i denne samtalen.'; end if;

  select owner_id into v_owner from listings where id = p_listing_id;
  select profile_id into v_to from conversation_participants
   where conversation_id = p_conversation_id and profile_id <> v_me limit 1;

  if v_me = v_owner then
    raise exception 'Eieren av oppføringen kan ikke sende tilbud på den.'; end if;

  select count(*) into v_recent from proposals
   where from_profile_id = v_me and created_at > now() - interval '1 minute';
  perform rate_check(v_recent, 5, 'tilbud');

  insert into proposals (listing_id, conversation_id, from_profile_id, to_profile_id,
      price_amount_minor, message, scheduled_text, caveats, status, client_token)
    values (p_listing_id, p_conversation_id, v_me, v_to,
      p_price_minor, nullif(p_message,''), nullif(p_scheduled_text,''),
      nullif(p_caveats,''), 'SENT', p_client_token)
    returning * into v_prop;

  insert into messages (conversation_id, author_id, kind, proposal_id, text)
    values (p_conversation_id, v_me, 'PROPOSAL', v_prop.id, '');

  perform notify(v_to, 'NEW_OFFER', 'Nytt tilbud',
    'Du har fått et nytt tilbud.', '/tilbud/' || v_prop.id);
  return v_prop;
end $$;

create or replace function respond_to_proposal(
  p_proposal_id uuid, p_event text, p_actor text)
returns proposals language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_next proposal_status;
        v_actor_ok boolean; v_desc text;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found then raise exception 'Fant ikke tilbudet.'; end if;
  if not is_participant(p.conversation_id) then raise exception 'Ikke tilgang.'; end if;

  v_actor_ok := (p_actor = 'PROPOSER' and v_me = p.from_profile_id)
             or (p_actor = 'RECIPIENT' and v_me = p.to_profile_id);
  if not v_actor_ok then raise exception 'Feil rolle for denne handlingen.'; end if;

  v_next := proposal_next(p.status, p_event, p_actor);
  update proposals set status = v_next where id = p.id returning * into p;

  if v_next = 'ACCEPTED' then
    select coalesce(td.description, so.about, l.title) into v_desc
      from listings l
      left join task_details td on td.listing_id = l.id
      left join service_offer_details so on so.listing_id = l.id
     where l.id = p.listing_id;
    insert into agreement_snapshots (proposal_id, listing_id, price_amount_minor,
        price_currency, scheduled_text, description, caveats)
      values (p.id, p.listing_id, p.price_amount_minor, p.price_currency,
        p.scheduled_text, coalesce(v_desc,''), p.caveats)
      on conflict (proposal_id) do update set
        price_amount_minor = excluded.price_amount_minor,
        scheduled_text = excluded.scheduled_text, caveats = excluded.caveats,
        agreed_at = now();
    update listings set status = 'AGREED' where id = p.listing_id;
    insert into messages (conversation_id, author_id, kind, text)
      values (p.conversation_id, v_me, 'SYSTEM', 'Tilbud godtatt');
    perform notify(p.from_profile_id, 'OFFER_ACCEPTED', 'Tilbud godtatt',
      'Tilbudet ditt ble godtatt.', '/avtale/' || p.id);
  elsif v_next = 'DECLINED' then
    perform notify(p.from_profile_id, 'OFFER_DECLINED', 'Tilbud avslått',
      'Tilbudet ditt ble avslått.', '/chat/' || p.conversation_id);
  elsif v_next = 'WITHDRAWN' then
    perform notify(p.to_profile_id, 'OFFER_WITHDRAWN', 'Tilbud trukket',
      'Et tilbud ble trukket tilbake.', '/chat/' || p.conversation_id);
  elsif v_next = 'REVISION_PENDING' then
    perform notify(p.from_profile_id, 'OFFER_CHANGED', 'Endring ønsket',
      'Mottakeren ba om en endring.', '/tilbud/' || p.id);
  end if;
  return p;
end $$;

create or replace function revise_proposal(
  p_proposal_id uuid, p_note text, p_price_minor bigint,
  p_scheduled_text text, p_caveats text)
returns proposals language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found then raise exception 'Fant ikke tilbudet.'; end if;
  if not is_participant(p.conversation_id) then raise exception 'Ikke tilgang.'; end if;

  if v_me = p.to_profile_id then
    p := respond_to_proposal(p_proposal_id, 'REQUEST_REVISION', 'RECIPIENT');
    insert into proposal_revisions (proposal_id, actor_id, note)
      values (p.id, v_me, nullif(p_note,''));
    insert into messages (conversation_id, author_id, kind, text)
      values (p.conversation_id, v_me, 'TEXT',
              coalesce(nullif(p_note,''),'Kan vi endre litt på tilbudet?'));
  elsif v_me = p.from_profile_id then
    update proposals set
      price_amount_minor = coalesce(p_price_minor, price_amount_minor),
      scheduled_text = coalesce(nullif(p_scheduled_text,''), scheduled_text),
      caveats = coalesce(nullif(p_caveats,''), caveats)
    where id = p.id;
    p := respond_to_proposal(p_proposal_id, 'SUBMIT_REVISION', 'PROPOSER');
    insert into proposal_revisions (proposal_id, actor_id, note, price_amount_minor,
        scheduled_text, caveats)
      values (p.id, v_me, nullif(p_note,''), p_price_minor,
              nullif(p_scheduled_text,''), nullif(p_caveats,''));
    insert into messages (conversation_id, author_id, kind, proposal_id, text)
      values (p.conversation_id, v_me, 'PROPOSAL', p.id, '');
  else
    raise exception 'Ikke tilgang.';
  end if;
  return p;
end $$;

-- ---------------------------------------------------------------------------
-- read / completion / review / safety / verification RPCs
-- ---------------------------------------------------------------------------
create or replace function mark_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_participant(p_conversation_id) then raise exception 'Ikke tilgang.'; end if;
  insert into message_reads (conversation_id, profile_id, last_read_at)
    values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, profile_id) do update set last_read_at = now();
end $$;

create or replace function confirm_completion(p_agreement_proposal_id uuid)
returns setof completion_confirmations
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_both int;
begin
  select * into p from proposals where id = p_agreement_proposal_id;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Ikke tilgang.'; end if;

  insert into completion_confirmations (agreement_proposal_id, by_profile_id)
    values (p_agreement_proposal_id, v_me)
  on conflict do nothing;

  select count(*) into v_both from completion_confirmations
   where agreement_proposal_id = p_agreement_proposal_id;
  if v_both >= 2 then
    update listings set status = 'COMPLETED' where id = p.listing_id;
    perform notify(p.from_profile_id,'REVIEW_RECEIVED','Oppdrag fullført',
      'Oppdraget er markert som fullført. Legg gjerne igjen en vurdering.','/vurder/'||p.id);
    perform notify(p.to_profile_id,'REVIEW_RECEIVED','Oppdrag fullført',
      'Oppdraget er markert som fullført. Legg gjerne igjen en vurdering.','/vurder/'||p.id);
  else
    perform notify(case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end,
      'COMPLETION_REQUESTED','Bekreft fullføring',
      'Den andre parten markerte oppdraget som fullført.','/fullfor/'||p.id);
  end if;

  return query select * from completion_confirmations
    where agreement_proposal_id = p_agreement_proposal_id;
end $$;

create or replace function submit_review(
  p_agreement_proposal_id uuid, p_rating int, p_comment text)
returns reviews language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_to uuid; v_done int; r reviews;
begin
  select * into p from proposals where id = p_agreement_proposal_id;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Ikke tilgang.'; end if;

  select count(*) into v_done from completion_confirmations
   where agreement_proposal_id = p_agreement_proposal_id;
  if v_done < 2 then raise exception 'Oppdraget er ikke fullført ennå.'; end if;

  v_to := case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end;
  insert into reviews (agreement_proposal_id, listing_id, from_profile_id, to_profile_id, rating, comment)
    values (p_agreement_proposal_id, p.listing_id, v_me, v_to, p_rating, nullif(p_comment,''))
  on conflict (agreement_proposal_id, from_profile_id)
    do update set rating = excluded.rating, comment = excluded.comment
  returning * into r;

  update listings set status = 'REVIEWED' where id = p.listing_id;
  perform notify(v_to,'REVIEW_RECEIVED','Ny vurdering','Du har fått en ny vurdering.','/profil/'||v_to);
  return r;
end $$;

create or replace function submit_report(
  p_target_type text, p_target_id text, p_reason text, p_details text)
returns reports language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_recent int; r reports;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  select count(*) into v_recent from reports
   where by_profile_id = v_me and created_at > now() - interval '1 minute';
  perform rate_check(v_recent, 3, 'rapporter');
  insert into reports (target_type, target_id, reason, details, by_profile_id)
    values (p_target_type::report_target, p_target_id, p_reason, nullif(p_details,''), v_me)
  returning * into r;
  return r;
end $$;

create or replace function resolve_report(p_report_id uuid)
returns reports language plpgsql security definer set search_path = public as $$
declare r reports;
begin
  if not is_admin() then raise exception 'Kun administratorer.'; end if;
  update reports set status = 'RESOLVED', resolved_by = auth.uid(), resolved_at = now()
   where id = p_report_id returning * into r;
  return r;
end $$;

create or replace function request_verification(p_kind text)
returns verifications language plpgsql security definer set search_path = public as $$
declare v verifications;
begin
  insert into verifications (profile_id, kind, verified, explanation, verified_at)
  values (auth.uid(), p_kind::verification_kind,
    case when p_kind = 'EMAIL' then true else false end,
    case p_kind
      when 'EMAIL' then 'E-postadressen din er bekreftet ved innlogging.'
      when 'PHONE' then 'Telefonverifisering kommer snart.'
      when 'BUSINESS' then 'Bedriftsverifisering behandles manuelt.' end,
    case when p_kind = 'EMAIL' then now() else null end)
  on conflict (profile_id, kind) do update set explanation = excluded.explanation
  returning * into v;
  return v;
end $$;

create or replace function submit_business_profile(
  p_org_nr text, p_company_name text, p_contact_person text,
  p_email text, p_phone text, p_category_slugs text[])
returns business_profiles language plpgsql security definer set search_path = public as $$
declare b business_profiles;
begin
  insert into business_profiles (profile_id, org_nr, company_name, contact_person,
      email, phone, category_slugs, status)
    values (auth.uid(), p_org_nr, p_company_name, p_contact_person, p_email, p_phone,
      coalesce(p_category_slugs,'{}'), 'PENDING')
  on conflict (profile_id) do update set
    org_nr = excluded.org_nr, company_name = excluded.company_name,
    contact_person = excluded.contact_person, email = excluded.email,
    phone = excluded.phone, category_slugs = excluded.category_slugs, status = 'PENDING'
  returning * into b;
  update profiles set is_business = true where id = auth.uid();
  return b;
end $$;

-- ---------------------------------------------------------------------------
-- message rate-limit trigger + realtime publication
-- ---------------------------------------------------------------------------
create or replace function message_rate_guard() returns trigger
language plpgsql as $$
declare v_recent int;
begin
  if new.kind in ('TEXT','IMAGE') then
    select count(*) into v_recent from messages
     where author_id = new.author_id and created_at > now() - interval '10 seconds';
    perform rate_check(v_recent, 10, 'meldinger');
  end if;
  return new;
end $$;
create trigger t_messages_rate before insert on messages
  for each row execute function message_rate_guard();

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table proposals;
alter publication supabase_realtime add table notifications;
