-- 0106 Notifications for the 0101 features that had none (asked 2026-11-13: «make sure notifications are set up
-- for the new functions»). Each one goes through the normal notifications table, so push (0039) follows by itself.
--
--   * Arrangement group chat: a new message tells the others in it (adults who said «Kommer»/«Kanskje», and the
--     organiser). At most one push per person per arrangement every 20 minutes, so a busy chat doesn't buzz all evening.
--   * Arrangementer (quiz, fest, tur …): a reminder the day before, like dugnad already has (0090).
--   * Utlån: the owner is told when a loan is called off; both are reminded the evening before pickup,
--     and the borrower on the day it goes back.
--   * Avstemning: the author is told the result when it closes.
-- Youth: they never get event-chat pushes (they can't use the chat), but do get the rest of what they take part in.

-- ---------------------------------------------------------------------------
-- 1. Arrangement group chat
-- ---------------------------------------------------------------------------
create or replace function notify_event_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare n noticeboard_posts; v_route text;
begin
  select * into n from noticeboard_posts where id = new.notice_id;
  v_route := '/arrangement/' || new.notice_id;
  insert into notifications (profile_id, kind, title, body, route)
  select x.profile_id, 'NOTICE_REPLY'::text::notification_kind, 'Ny melding · ' || n.title,
         coalesce(first_name(new.author_id), 'En nabo') || ': ' || left(new.body, 120), v_route
    from (select n.author_id as profile_id
          union select s.profile_id from notice_signups s where s.notice_id = new.notice_id) x
   where x.profile_id <> new.author_id
     and not is_youth(x.profile_id)
     and not exists (select 1 from notifications o where o.profile_id = x.profile_id and o.route = v_route
                       and o.created_at > now() - interval '20 minutes');
  return null;
end $$;
revoke all on function notify_event_message() from public, anon, authenticated;
drop trigger if exists t_event_messages_notify on event_messages;
create trigger t_event_messages_notify after insert on event_messages
  for each row execute function notify_event_message();

-- ---------------------------------------------------------------------------
-- 2. A called-off loan tells the owner
-- ---------------------------------------------------------------------------
create or replace function notify_lend_cancelled() returns trigger
language plpgsql security definer set search_path = public as $$
declare i lend_items;
begin
  if new.status <> 'CANCELLED' or old.status = 'CANCELLED' then return null; end if;
  select * into i from lend_items where id = new.item_id;
  insert into notifications (profile_id, kind, title, body, route)
    values (i.owner_id, 'NOTICE_REPLY'::text::notification_kind,
            coalesce(first_name(new.borrower_id), 'Naboen') || case when old.status = 'ACCEPTED' then ' avlyste lånet' else ' trakk forespørselen' end,
            '«' || i.title || '» · ' || to_char(new.from_date, 'DD.MM') || '–' || to_char(new.to_date, 'DD.MM'),
            '/utlan?fane=foresporsler');
  return null;
end $$;
revoke all on function notify_lend_cancelled() from public, anon, authenticated;
drop trigger if exists t_lend_requests_cancelled on lend_requests;
create trigger t_lend_requests_cancelled after update of status on lend_requests
  for each row execute function notify_lend_cancelled();

-- ---------------------------------------------------------------------------
-- 3. Reminders: arrangementer, utlån and closed polls. Each is sent once (keyed in feature_reminders).
-- ---------------------------------------------------------------------------
create table if not exists feature_reminders (
  key text not null,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (key, profile_id)
);
alter table feature_reminders enable row level security;
revoke all on feature_reminders from public, anon, authenticated;

-- sends one notification unless that key already went to that person; true when it was sent
create or replace function remind_once(p_key text, p_profile uuid, p_title text, p_body text, p_route text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into feature_reminders (key, profile_id) values (p_key, p_profile) on conflict do nothing;
  if not found then return false; end if;
  insert into notifications (profile_id, kind, title, body, route)
    values (p_profile, 'NOTICE_REPLY'::text::notification_kind, p_title, p_body, p_route);
  return true;
end $$;
revoke all on function remind_once(text, uuid, text, text, text) from public, anon, authenticated;

create or replace function send_feature_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v int := 0; v_now timestamp := now() at time zone 'Europe/Oslo'; v_today date := (now() at time zone 'Europe/Oslo')::date;
begin
  -- arrangementer that aren't dugnad (dugnad has its own reminder, 0090): within the next 24 hours
  for r in
    select n.id, n.title, n.event_at, x.profile_id
      from noticeboard_posts n
      join (select notice_id, profile_id from notice_signups
            union select id, author_id from noticeboard_posts where event_type is not null) x on x.notice_id = n.id
     where n.event_type is not null and not n.is_dugnad and n.done_at is null and n.hidden_at is null
       and n.event_at > now() and n.event_at <= now() + interval '24 hours'
  loop
    if remind_once('event:' || r.id, r.profile_id,
                   case when (r.event_at at time zone 'Europe/Oslo')::date = v_today then 'I dag: ' else 'I morgen: ' end || r.title,
                   'Kl. ' || to_char(r.event_at at time zone 'Europe/Oslo', 'HH24:MI') || '. Se hvem som kommer i oppslaget.',
                   '/oppslagstavle?oppslag=' || r.id) then
      v := v + 1;
    end if;
  end loop;

  -- utlån, from 18:00 the evening before pickup: both of them
  if extract(hour from v_now) >= 18 then
    for r in
      select q.id, q.borrower_id, q.reply, i.owner_id, i.title
        from lend_requests q join lend_items i on i.id = q.item_id
       where q.status = 'ACCEPTED' and q.from_date = v_today + 1
    loop
      if remind_once('lend-pickup:' || r.id, r.borrower_id, 'Du låner ' || r.title || ' i morgen',
                     coalesce('«' || r.reply || '»', 'Husk å avtale henting med ' || coalesce(first_name(r.owner_id), 'eieren') || '.'),
                     '/utlan?fane=foresporsler') then
        v := v + 1;
      end if;
      if remind_once('lend-pickup:' || r.id, r.owner_id, r.title || ' lånes ut i morgen',
                     coalesce(first_name(r.borrower_id), 'Naboen') || ' henter den.', '/utlan?fane=foresporsler') then
        v := v + 1;
      end if;
    end loop;
  end if;

  -- utlån, from 09:00 on the last day: the borrower
  if extract(hour from v_now) >= 9 then
    for r in
      select q.id, q.borrower_id, i.title, i.owner_id
        from lend_requests q join lend_items i on i.id = q.item_id
       where q.status = 'ACCEPTED' and q.to_date = v_today
    loop
      if remind_once('lend-return:' || r.id, r.borrower_id, 'Husk å levere ' || r.title || ' tilbake',
                     'Den skal tilbake til ' || coalesce(first_name(r.owner_id), 'eieren') || ' i dag.', '/utlan?fane=foresporsler') then
        v := v + 1;
      end if;
    end loop;
  end if;

  -- avstemning closed in the last two days: the author gets the result
  for r in
    select n.id, n.title, n.author_id, n.poll_options,
           (select count(*) from notice_votes w where w.notice_id = n.id) as votes,
           (select w.option_index from notice_votes w where w.notice_id = n.id
             group by w.option_index order by count(*) desc, w.option_index limit 1) as top
      from noticeboard_posts n
     where n.poll_options is not null and n.hidden_at is null
       and n.poll_closes_at <= now() and n.poll_closes_at > now() - interval '2 days'
  loop
    if remind_once('poll:' || r.id, r.author_id, 'Avstemningen er ferdig',
                   '«' || r.title || '» · ' || case when r.votes = 0 then 'Ingen stemte.'
                     else r.poll_options[r.top + 1] || ' fikk flest stemmer (' || r.votes || ' stemte).' end,
                   '/oppslagstavle?oppslag=' || r.id) then
      v := v + 1;
    end if;
  end loop;
  return v;
end $$;
revoke all on function send_feature_reminders() from public, anon, authenticated;

do $$ begin
  begin
    perform cron.unschedule('minnabo-feature-reminders');
  exception when others then null;
  end;
  perform cron.schedule('minnabo-feature-reminders', '*/10 * * * *', 'select public.send_feature_reminders()');
exception when others then
  raise notice 'Feature reminders are not scheduled (%).', sqlerrm;
end $$;
