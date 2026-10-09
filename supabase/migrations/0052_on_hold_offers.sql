-- 0052_on_hold_offers.sql
--  * When one tilbud is accepted, the people behind the other open tilbud on that
--    oppdrag are told: their tilbud is on hold (it counts again if the avtale is
--    called off – then they are told that too).
--  * The notification for a new vurdering opens the Vurderinger tab.

create or replace function proposals_notify_others() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text; o record;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status::text <> 'ACCEPTED' and not (old.status::text = 'ACCEPTED' and new.status::text = 'CANCELLED') then
    return new;
  end if;
  select title into v_title from listings where id = new.listing_id;

  for o in
    select id, from_profile_id from proposals
     where listing_id = new.listing_id and id <> new.id and status in ('SENT','REVISION_PENDING')
  loop
    if new.status::text = 'ACCEPTED' then
      insert into notifications (profile_id, kind, title, body, route)
        values (o.from_profile_id, 'OFFER_CHANGED', 'Oppdraget har fått en avtale',
                '«' || coalesce(v_title, 'Oppdraget') || '» har en avtale med en annen nabo. Tilbudet ditt står på vent.',
                '/tilbud/' || o.id);
    else
      insert into notifications (profile_id, kind, title, body, route)
        values (o.from_profile_id, 'OFFER_CHANGED', 'Oppdraget er åpent igjen',
                'Avtalen på «' || coalesce(v_title, 'oppdraget') || '» ble avlyst. Tilbudet ditt gjelder igjen.',
                '/tilbud/' || o.id);
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists t_proposals_notify_others on proposals;
create trigger t_proposals_notify_others after update of status on proposals
  for each row execute function proposals_notify_others();

create or replace function review_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (profile_id, kind, title, body, route)
    values (new.to_profile_id, 'REVIEW_RECEIVED', 'Ny vurdering',
            'Du har fått en vurdering. Den vises når dere begge har vurdert, eller når fristen går ut.',
            '/profil?fane=vurderinger');
  return new;
end $$;
