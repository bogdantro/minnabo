-- 0079_weekly_digest.sql
-- «3 nye oppdrag i Lillehammer denne uka» – one calm reminder a week for neighbours
-- who haven't been around, so a good oppdrag next door isn't missed.
--
-- Rules:
--   * Sunday evening, at most once a week per person.
--   * Only for people with a kommune, and only when at least 2 new oppdrag (not
--     their own, not from someone either side has blocked) were posted there.
--   * Skipped for anyone who already got a «Nytt treff» alert this week from a
--     saved search (0042) – they are already following along.
--   * Uses the NEW_MATCH type, so the «Nye oppdrag» switch under Varslinger turns
--     it off, and quiet hours apply, exactly like the saved-search alerts.

create or replace function weekly_digest() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_sent int := 0;
begin
  for r in
    select p.id, p.municipality, count(l.id)::int as n
      from profiles p
      join listings l
        on l.municipality = p.municipality
       and l.type::text = 'TASK_REQUEST'
       and l.status::text in ('PUBLISHED', 'RECEIVING_OFFERS')
       and l.created_at > now() - interval '7 days'
       and l.owner_id <> p.id
       and not exists (select 1 from blocks b
                        where (b.by_profile_id = p.id and b.blocked_profile_id = l.owner_id)
                           or (b.by_profile_id = l.owner_id and b.blocked_profile_id = p.id))
     where p.municipality is not null
       and p.deleted_at is null
       and p.suspended_at is null
       and not exists (select 1 from notifications n
                        where n.profile_id = p.id and n.kind::text = 'NEW_MATCH'
                          and n.created_at > now() - interval '6 days')
     group by p.id, p.municipality
    having count(l.id) >= 2
  loop
    insert into notifications (profile_id, kind, title, body, route)
      values (r.id, 'NEW_MATCH'::text::notification_kind,
              r.n || ' nye oppdrag i ' || r.municipality || ' denne uka',
              'Se hva naboene trenger hjelp til.',
              '/');
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end $$;
revoke all on function weekly_digest() from public, anon, authenticated;

-- Sundays 17:00 UTC = 18:00 in winter, 19:00 in summer (Norway)
do $$ begin
  begin
    perform cron.unschedule('minnabo-weekly-digest');
  exception when others then null;
  end;
  perform cron.schedule('minnabo-weekly-digest', '0 17 * * 0', 'select public.weekly_digest()');
exception when others then
  raise notice 'The weekly digest is not scheduled (%). Enable pg_cron and run this block again.', sqlerrm;
end $$;
