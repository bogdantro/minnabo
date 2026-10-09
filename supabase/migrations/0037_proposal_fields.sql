-- 0037_proposal_fields.sql
-- Tilbud get real data for what the design shows:
--  * scheduled_at  – the offered day/time as a timestamp (countdown, calendar, date sort)
--  * duration_text – "ca. 5 t" per offer (Sammenlign, Tilbudsdetaljer, chat card)
--  * responded_at  – when it was accepted / declined (Mottatte tilbud row date)
--  * seen_at       – when the recipient first opened it ("Sett av …")
--  * expires_at    – "Tilbudet gjelder til …"; an expired tilbud can't be accepted
-- The agreement snapshot freezes scheduled_at + duration_text with the rest.

alter table proposals add column if not exists scheduled_at timestamptz;
alter table proposals add column if not exists duration_text text;
alter table proposals add column if not exists responded_at timestamptz;
alter table proposals add column if not exists seen_at timestamptz;
alter table proposals add column if not exists expires_at timestamptz;

alter table agreement_snapshots add column if not exists scheduled_at timestamptz;
alter table agreement_snapshots add column if not exists duration_text text;

-- existing open offers get the same 14 days as new ones, counted from now
update proposals set expires_at = now() + interval '14 days'
 where expires_at is null and status in ('SENT','REVISION_PENDING');

create or replace function proposals_stamp() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.expires_at is null then new.expires_at := now() + interval '14 days'; end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status::text = 'ACCEPTED' and old.expires_at is not null and old.expires_at < now() then
      raise exception 'Tilbudet har utløpt. Be om et nytt tilbud.';
    end if;
    if new.status::text in ('ACCEPTED','DECLINED') then
      new.responded_at := now();
    end if;
    -- a changed / re-sent tilbud is new to the recipient and valid for 14 more days
    if new.status::text = 'SENT' then
      new.seen_at := null;
      new.responded_at := null;
      new.expires_at := now() + interval '14 days';
    end if;
  elsif new.status::text = 'SENT' and new.edited_at is distinct from old.edited_at then
    new.seen_at := null;
    new.expires_at := now() + interval '14 days';
  end if;
  return new;
end $$;
drop trigger if exists t_proposals_stamp on proposals;
create trigger t_proposals_stamp before insert or update on proposals
  for each row execute function proposals_stamp();

create or replace function agreement_copy_schedule() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select p.scheduled_at, p.duration_text into new.scheduled_at, new.duration_text
    from proposals p where p.id = new.proposal_id;
  return new;
end $$;
drop trigger if exists t_agreement_copy_schedule on agreement_snapshots;
create trigger t_agreement_copy_schedule before insert on agreement_snapshots
  for each row execute function agreement_copy_schedule();

-- Sender sets the structured time + duration right after sending / editing.
create or replace function set_proposal_extras(
  p_proposal_id uuid, p_scheduled_at timestamptz, p_duration_text text)
returns proposals language plpgsql security definer set search_path = public as $$
declare p proposals;
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found or p.from_profile_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if p.status not in ('SENT','REVISION_PENDING') then raise exception 'Tilbudet kan ikke endres nå.'; end if;
  update proposals set scheduled_at = p_scheduled_at, duration_text = nullif(trim(p_duration_text), '')
   where id = p.id returning * into p;
  return p;
end $$;
grant execute on function set_proposal_extras(uuid, timestamptz, text) to authenticated;

-- Recipient opened the tilbud.
create or replace function mark_proposal_seen(p_proposal_id uuid)
returns void language sql security definer set search_path = public as $$
  update proposals set seen_at = now()
   where id = p_proposal_id and to_profile_id = auth.uid() and seen_at is null;
$$;
grant execute on function mark_proposal_seen(uuid) to authenticated;
