-- Avlys avtalen (Avtale.dc.html): either party can cancel an accepted agreement.
-- ACCEPTED --CANCEL--> CANCELLED. Mirrors src/domain/proposalMachine.ts.

alter type proposal_status add value if not exists 'CANCELLED';
alter type notification_kind add value if not exists 'AGREEMENT_CANCELLED';

alter table agreement_snapshots
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text;

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
  if p_from = 'ACCEPTED' then
    if p_event = 'REQUEST_REVISION' and p_actor = 'RECIPIENT' then return 'REVISION_PENDING'; end if;
    -- either party may cancel an agreement
    if p_event = 'CANCEL' and p_actor in ('PROPOSER', 'RECIPIENT') then return 'CANCELLED'; end if;
  end if;
  if p_from = 'REVISION_PENDING' then
    if p_event = 'SUBMIT_REVISION'  and p_actor = 'PROPOSER'  then return 'SENT';      end if;
    if p_event = 'CONFIRM_REVISION' and p_actor = 'PROPOSER'  then return 'ACCEPTED';  end if;
    if p_event = 'WITHDRAW'         and p_actor = 'PROPOSER'  then return 'WITHDRAWN'; end if;
    if p_event = 'DECLINE'          and p_actor = 'RECIPIENT' then return 'DECLINED';  end if;
  end if;
  raise exception 'Ugyldig endring av tilbudet.' using errcode = 'check_violation';
end $$;

create or replace function cancel_agreement(p_proposal_id uuid, p_reason text default null)
returns proposals language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_actor text; v_other uuid; v_reason text;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found then raise exception 'Fant ikke tilbudet.'; end if;
  if not is_participant(p.conversation_id) then raise exception 'Ikke tilgang.'; end if;

  if v_me = p.from_profile_id then v_actor := 'PROPOSER'; v_other := p.to_profile_id;
  elsif v_me = p.to_profile_id then v_actor := 'RECIPIENT'; v_other := p.from_profile_id;
  else raise exception 'Feil rolle for denne handlingen.';
  end if;

  update proposals set status = proposal_next(p.status, 'CANCEL', v_actor)
   where id = p.id returning * into p;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  update agreement_snapshots set cancelled_at = now(), cancel_reason = v_reason
   where proposal_id = p.id;

  -- the oppdrag is open for offers again
  update listings set status = 'RECEIVING_OFFERS' where id = p.listing_id;

  insert into messages (conversation_id, author_id, kind, text)
    values (p.conversation_id, v_me, 'SYSTEM',
            'Avtalen er avlyst' || coalesce(' · ' || v_reason, ''));
  perform notify(v_other, 'AGREEMENT_CANCELLED', 'Avtalen er avlyst',
    coalesce('Grunn: ' || lower(v_reason) || '.', 'Den andre parten har avlyst avtalen.'),
    '/avtale/' || p.id);
  return p;
end $$;
