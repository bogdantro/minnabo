-- 0069_review_reminder.sql
--  «Hvordan gikk det?» – the day after a job is completed (both have confirmed), each
--  adult who hasn't reviewed yet gets one reminder. The push has star buttons
--  (send-push adds the 'review' category to every /vurder/ link; the app registers the
--  buttons in PushBridge.tsx), so giving stars is one tap on the notification + «Send».
--
--  Rules:
--    * once per person per avtale (review_reminders), never repeated
--    * from 20 hours after completion, between 10 and 20 Oslo time – "the next day",
--      not in the middle of the night; quiet hours in Varslinger still apply in send-push
--    * not when the review window has closed (reviews are shown after 10 days, 0059),
--      not for youth accounts (they don't give reviews, 0055), not for deleted accounts,
--      not for a cancelled avtale
--  Runs every hour from pg_cron, like the job reminders (0053).

create table if not exists review_reminders (
  proposal_id uuid not null references agreement_snapshots(proposal_id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (proposal_id, profile_id)
);
alter table review_reminders enable row level security;
-- no policies: only the function below (security definer) reads and writes it

create or replace function send_review_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare
  a record;
  v_party uuid;
  v_other uuid;
  v_first text;
  v_n int := 0;
  v_hour int := extract(hour from now() at time zone 'Europe/Oslo');
begin
  if v_hour < 10 or v_hour >= 20 then return 0; end if;

  for a in
    select s.proposal_id, p.from_profile_id, p.to_profile_id, l.title, max(c.confirmed_at) as done_at
      from agreement_snapshots s
      join proposals p on p.id = s.proposal_id
      join listings l on l.id = s.listing_id
      join completion_confirmations c on c.agreement_proposal_id = s.proposal_id
     where s.cancelled_at is null
     group by s.proposal_id, p.from_profile_id, p.to_profile_id, l.title
    having count(*) >= 2
       and max(c.confirmed_at) <= now() - interval '20 hours'
       and max(c.confirmed_at) > now() - interval '9 days'
  loop
    foreach v_party in array array[a.from_profile_id, a.to_profile_id] loop
      v_other := case when v_party = a.from_profile_id then a.to_profile_id else a.from_profile_id end;
      continue when is_youth(v_party);
      continue when exists (select 1 from profiles where id = v_party and deleted_at is not null);
      continue when exists (select 1 from reviews r where r.agreement_proposal_id = a.proposal_id and r.from_profile_id = v_party);

      insert into review_reminders (proposal_id, profile_id) values (a.proposal_id, v_party) on conflict do nothing;
      continue when not found;

      select split_part(display_name, ' ', 1) into v_first from profiles where id = v_other;
      -- REVIEW_RECEIVED: the «Vurderinger» switch in Varslinger covers it
      insert into notifications (profile_id, kind, title, body, route)
        values (v_party, 'REVIEW_RECEIVED', 'Hvordan gikk det?',
                '«' || a.title || '» med ' || coalesce(nullif(v_first, ''), 'naboen') ||
                ' er fullført. Gi en vurdering – trykk på stjernene.',
                '/vurder/' || a.proposal_id);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;
revoke execute on function send_review_reminders() from public, anon, authenticated;

do $$ begin
  begin
    perform cron.unschedule('minnabo-review-reminders');
  exception when others then null;
  end;
  perform cron.schedule('minnabo-review-reminders', '5 * * * *', 'select public.send_review_reminders()');
exception when others then
  raise notice 'Review reminders are not scheduled (%). Enable pg_cron and run this block again.', sqlerrm;
end $$;
