-- 0087_listing_reminders.sql
--  Asked 2026-11-06: nudges that keep a job moving. An hourly job, sent 10–20 Oslo time only, and
--  each reminder at most once:
--    * «Ingen tilbud ennå»: 48 hours without a single tilbud → tips to the owner.
--    * «Du har 3 tilbud som venter på svar»: tilbud unanswered for 24 hours.
--    * «Tilbudet utløper snart»: to both sides, the day before the 14 days are up.
--    * «Alt i orden etter jobben?»: three days after a finished job, to the one who got help – for
--      damage found afterwards. Only jobs finished after this migration.

create table if not exists listing_reminders (
  kind text not null check (kind in ('NO_OFFERS','PENDING','EXPIRY','FOLLOW_UP')),
  subject_id uuid not null,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (kind, subject_id, profile_id)
);
alter table listing_reminders enable row level security;
revoke all on listing_reminders from public, anon, authenticated;

create or replace function send_listing_reminders() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_now text := oslo_hhmm(now());
  v_no_offers int := 0; v_pending int := 0; v_expiry int := 0; v_follow int := 0;
begin
  if v_now < '10:00' or v_now >= '20:00' then return '{}'::jsonb; end if;

  -- no tilbud in 48 hours
  for r in
    select l.id, l.owner_id, l.title from listings l
     where l.type = 'TASK_REQUEST'
       and l.status::text in ('PUBLISHED','RECEIVING_OFFERS')
       and l.created_at < now() - interval '48 hours'
       and l.created_at > now() - interval '21 days'
       and l.invited_profile_id is null
       and not coalesce(l.pending_review, false) and not l.admin_hidden
       and not exists (select 1 from proposals p where p.listing_id = l.id)
       and not exists (select 1 from listing_reminders x where x.kind = 'NO_OFFERS' and x.subject_id = l.id)
  loop
    insert into listing_reminders (kind, subject_id, profile_id) values ('NO_OFFERS', r.id, r.owner_id);
    perform notify(r.owner_id, 'OFFER_CHANGED', 'Ingen tilbud ennå',
      '«' || r.title || '»: et bilde eller en justert pris kan hjelpe. Se tipsene.',
      '/oppdrag/' || r.id || '?tips=1');
    v_no_offers := v_no_offers + 1;
  end loop;

  -- tilbud waiting for an answer: one message per person, however many tilbud
  for r in
    select p.to_profile_id as owner_id, count(*)::int as n, array_agg(p.id) as ids
      from proposals p
     where p.status in ('SENT','REVISION_PENDING')
       and p.created_at < now() - interval '24 hours'
       and (p.expires_at is null or p.expires_at > now())
       and not exists (select 1 from listing_reminders x where x.kind = 'PENDING' and x.subject_id = p.id)
     group by p.to_profile_id
  loop
    insert into listing_reminders (kind, subject_id, profile_id)
      select 'PENDING', unnest(r.ids), r.owner_id;
    perform notify(r.owner_id, 'NEW_OFFER',
      case when r.n = 1 then 'Du har et tilbud som venter på svar' else 'Du har ' || r.n || ' tilbud som venter på svar' end,
      'Naboene venter. Et raskt svar, også et nei, setter de pris på.',
      '/tilbud');
    v_pending := v_pending + 1;
  end loop;

  -- runs out soon: both sides hear it, once
  for r in
    select p.id, p.from_profile_id, p.to_profile_id, l.title, first_name(p.from_profile_id) as sender
      from proposals p
      join listings l on l.id = p.listing_id
     where p.status in ('SENT','REVISION_PENDING')
       and p.expires_at > now() and p.expires_at <= now() + interval '30 hours'
       and not exists (select 1 from listing_reminders x where x.kind = 'EXPIRY' and x.subject_id = p.id)
  loop
    insert into listing_reminders (kind, subject_id, profile_id) values ('EXPIRY', r.id, r.to_profile_id);
    perform notify(r.to_profile_id, 'OFFER_CHANGED', 'Tilbudet fra ' || coalesce(r.sender, 'naboen') || ' utløper snart',
      '«' || r.title || '»: svar før det går ut.', '/tilbud/' || r.id);
    perform notify(r.from_profile_id, 'OFFER_CHANGED', 'Tilbudet ditt utløper snart',
      '«' || r.title || '»: du kan endre tilbudet for å forlenge det.', '/tilbud/' || r.id);
    v_expiry := v_expiry + 1;
  end loop;

  -- three days after a finished job, to the person who got help
  for r in
    select p.id, p.to_profile_id, l.title
      from proposals p
      join listings l on l.id = p.listing_id
      join completion_confirmations c on c.agreement_proposal_id = p.id
     where p.status = 'ACCEPTED'
       and not is_youth(p.to_profile_id)
       and not exists (select 1 from listing_reminders x where x.kind = 'FOLLOW_UP' and x.subject_id = p.id)
     group by p.id, p.to_profile_id, l.title
    having count(*) >= 2
       and max(c.confirmed_at) < now() - interval '3 days'
       and max(c.confirmed_at) > timestamptz '2026-11-06 00:00+01'
  loop
    insert into listing_reminders (kind, subject_id, profile_id) values ('FOLLOW_UP', r.id, r.to_profile_id);
    perform notify(r.to_profile_id, 'JOB_DAY', 'Alt i orden etter jobben?',
      '«' || r.title || '»: oppdaget du noe i etterkant, kan du si fra her.',
      '/avtale/' || r.id || '?etterkant=1');
    v_follow := v_follow + 1;
  end loop;

  return jsonb_build_object('noOffers', v_no_offers, 'pending', v_pending, 'expiry', v_expiry,
                            'followUp', v_follow);
end $$;
revoke all on function send_listing_reminders() from public, anon, authenticated;

do $$ begin
  begin
    perform cron.unschedule('minnabo-listing-reminders');
  exception when others then null;
  end;
  perform cron.schedule('minnabo-listing-reminders', '25 * * * *', 'select public.send_listing_reminders()');
exception when others then
  raise notice 'Listing reminders are not scheduled (%). Enable pg_cron and run this block again.', sqlerrm;
end $$;
