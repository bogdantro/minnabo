-- Behaviour checks for migrations 0086–0091. Local throwaway Postgres only, never Supabase.
-- Every check raises (and psql stops) on failure; the last line prints ALL CHECKS PASSED.
-- Runs as real signed-in users: `as_user` switches role + JWT, so row security is really applied.
\set ON_ERROR_STOP on
\set QUIET on

-- ---------- fixtures ----------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'owner@test.invalid'),
  ('00000000-0000-4000-8000-0000000000a2', 'helper1@test.invalid'),
  ('00000000-0000-4000-8000-0000000000a3', 'helper2@test.invalid'),
  ('00000000-0000-4000-8000-0000000000a4', 'stranger@test.invalid'),
  ('00000000-0000-4000-8000-0000000000b1', 'youth@test.invalid');

update profiles set municipality = 'Lillehammer', display_name = 'Ola Eier', onboarded_at = now();
update profiles set display_name = 'Hanne Hjelper', category_slugs = '{hage}' where id = '00000000-0000-4000-8000-0000000000a2';
update profiles set display_name = 'Per Hjelper', category_slugs = '{snomaking}' where id = '00000000-0000-4000-8000-0000000000a3';
update profiles set display_name = 'Sara Fremmed' where id = '00000000-0000-4000-8000-0000000000a4';
insert into profile_private (profile_id, birth_date) values ('00000000-0000-4000-8000-0000000000b1', current_date - interval '16 years')
  on conflict (profile_id) do update set birth_date = excluded.birth_date;

insert into follows (follower_id, followed_id) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2');

-- the reminders only run in daytime; fix the clock for the checks
create or replace function oslo_hhmm(p_at timestamptz) returns text language sql immutable as $$ select '12:00'::text $$;

create or replace function as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, false);
  perform set_config('role', 'authenticated', false);
end $$;
create or replace function as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claims', '', false);
end $$;
grant execute on function as_admin() to authenticated;

create or replace function make_listing(p_title text, p_cat text, p_extra jsonb default '{}') returns uuid
language plpgsql as $$
declare v uuid;
begin
  insert into listings (type, owner_id, title, category_slug, price_mode, municipality, place, status, first_to_followed_until)
    values ('TASK_REQUEST', '00000000-0000-4000-8000-0000000000a1', p_title, p_cat, 'BY_AGREEMENT', 'Lillehammer', 'Nordre Ål',
            'PUBLISHED', (p_extra->>'first')::timestamptz)
    returning id into v;
  insert into task_details (listing_id, description, wizard) values (v, 'Beskrivelse av jobben', p_extra->'wizard');
  return v;
end $$;

-- A tilbud through the same functions the app uses.
create or replace function give_tilbud(p_helper uuid, p_listing uuid, p_token text) returns uuid
language plpgsql as $$
declare v_conv uuid; v_p proposals;
begin
  perform as_user(p_helper);
  select (start_conversation_for_listing(p_listing)).id into v_conv;
  v_p := send_proposal(v_conv, p_listing, 40000, 'Jeg kan', '', '', p_token);
  perform as_admin();
  return v_p.id;
end $$;

-- ---------- 1. search ----------
do $$
declare v_task uuid; v_offer uuid;
begin
  v_task := make_listing('Trenger hjelp med gjerdet', 'annet');
  insert into listings (type, owner_id, title, category_slug, price_mode, municipality, place, status)
    values ('SERVICE_OFFER', '00000000-0000-4000-8000-0000000000a3', 'Hjelp i hagen', 'hage', 'BY_AGREEMENT', 'Lillehammer', 'Sentrum', 'PUBLISHED')
    returning id into v_offer;
  insert into service_offer_details (listing_id, about, services)
    values (v_offer, 'Erfaren med gressklipper', array['hekkeklipping']);

  assert (select count(*) from listings where id = v_offer and search @@ to_tsquery('simple', 'gressklipper')) = 1, 'S1: offer found by its description';
  assert (select count(*) from listings where id = v_offer and search @@ to_tsquery('simple', 'hekkeklipp:*')) = 1, 'S2: offer found by a service, prefix works';
  assert (select count(*) from listings where id = v_task and search @@ to_tsquery('simple', 'beskrivelse')) = 1, 'S3: oppdrag found by its description';
  assert (select count(*) from listings where id = v_task and search @@ to_tsquery('simple', 'lillehammer')) = 1, 'S4: found by kommune';
end $$;

-- ---------- 2. days ----------
do $$
declare v uuid;
begin
  v := make_listing('Valgte dager her', 'hage', jsonb_build_object('wizard', jsonb_build_object('whenMode', 'flex', 'days', jsonb_build_array('2030-05-03', '2030-05-01'))));
  assert (select scheduled_days from task_details where listing_id = v) = array['2030-05-01'::date, '2030-05-03'::date], 'D1: chosen days, sorted';

  v := make_listing('Innen en frist', 'hage', jsonb_build_object('wizard', jsonb_build_object('whenMode', 'innen', 'days', jsonb_build_array((current_date + 3)::text))));
  assert cardinality((select scheduled_days from task_details where listing_id = v)) = 4, 'D2: «Innen» covers every day up to the deadline';

  v := make_listing('Rart skjema her', 'hage', jsonb_build_object('wizard', jsonb_build_object('days', 'ikke en liste')));
  assert (select scheduled_days from task_details where listing_id = v) is null, 'D3: an odd form saves without days';
end $$;

-- ---------- 3. two helpers ----------
do $$
declare v uuid; p1 uuid; p2 uuid; p3 uuid;
begin
  v := make_listing('Flytte en sofa', 'flytting', jsonb_build_object('wizard', jsonb_build_object('helpers', 2)));
  assert (select helpers_needed from listings where id = v) = 2, 'H1: slots read from the form';
  p1 := give_tilbud('00000000-0000-4000-8000-0000000000a2', v, 't1');
  p2 := give_tilbud('00000000-0000-4000-8000-0000000000a3', v, 't2');
  p3 := give_tilbud('00000000-0000-4000-8000-0000000000a4', v, 't3');

  perform as_user('00000000-0000-4000-8000-0000000000a1');
  perform respond_to_proposal(p1, 'ACCEPT', 'RECIPIENT');
  perform as_admin();
  assert (select status::text from listings where id = v) = 'PUBLISHED', 'H2: stays open after the first of two';
  assert not exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000a4' and title = 'Oppdraget har fått en avtale'), 'H3: others are not put on hold yet';
  assert (select listing_helper_slots(v)) = '{"needed":2,"taken":1}'::jsonb, 'H4: slot count';

  perform as_user('00000000-0000-4000-8000-0000000000a1');
  perform respond_to_proposal(p2, 'ACCEPT', 'RECIPIENT');
  perform as_admin();
  assert (select status::text from listings where id = v) = 'AGREED', 'H5: closes with the last helper';
  assert exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000a4' and title = 'Oppdraget har fått en avtale'), 'H6: now the others hear it';

  -- settling for one
  v := make_listing('Bære en piano', 'flytting', jsonb_build_object('wizard', jsonb_build_object('helpers', 3)));
  p1 := give_tilbud('00000000-0000-4000-8000-0000000000a2', v, 't4');
  perform as_user('00000000-0000-4000-8000-0000000000a1');
  perform respond_to_proposal(p1, 'ACCEPT', 'RECIPIENT');
  perform close_helper_slots(v);
  perform as_admin();
  assert (select status::text from listings where id = v) = 'AGREED', 'H7: «Jeg trenger ikke flere» closes it';

  -- one helper behaves as before
  v := make_listing('Vanlig jobb her', 'hage');
  p1 := give_tilbud('00000000-0000-4000-8000-0000000000a2', v, 't5');
  perform as_user('00000000-0000-4000-8000-0000000000a1');
  perform respond_to_proposal(p1, 'ACCEPT', 'RECIPIENT');
  perform as_admin();
  assert (select status::text from listings where id = v) = 'AGREED', 'H8: a one-helper oppdrag closes at once';
end $$;

-- ---------- 4. head start ----------
do $$
declare v uuid; n int; v_route text;
begin
  v := make_listing('Først til mine faste', 'hage', jsonb_build_object('first', (now() + interval '2 hours')::text));
  v_route := '/oppdrag/' || v;
  assert exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000a2' and route = v_route and title like '% spør deg først'), 'F1: the followed helper hears first';
  assert not exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000a4' and route = v_route), 'F2: nobody else yet';

  perform as_user('00000000-0000-4000-8000-0000000000a4');
  select count(*) into n from listings where id = v;
  perform as_admin();
  assert n = 0, 'F3: a stranger can not read it';
  perform as_user('00000000-0000-4000-8000-0000000000a2');
  select count(*) into n from listings where id = v;
  perform as_admin();
  assert n = 1, 'F4: the followed helper can';

  update listings set first_to_followed_until = now() - interval '1 minute' where id = v;
  perform release_first_refusals();
  assert exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000a4' and route = v_route), 'F5: the area hears when it goes public';
  select count(*) into n from notifications where profile_id = '00000000-0000-4000-8000-0000000000a2' and route = v_route;
  assert n = 1, 'F6: the followed helper is not told twice';

  v := make_listing('For lang forsprang', 'hage', jsonb_build_object('first', (now() + interval '3 days')::text));
  assert (select first_to_followed_until from listings where id = v) < now() + interval '2 hours 1 minute', 'F7: a client can not extend the head start';
end $$;

-- ---------- 5. push per category ----------
do $$
declare v uuid; v_route text;
begin
  v := make_listing('Hagejobb for noen', 'hage');
  v_route := '/oppdrag/' || v;
  assert exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000a2' and route = v_route), 'P1: helper with the category hears it';
  assert not exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000a3' and route = v_route), 'P2: helper with other categories does not';
  assert exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000a4' and route = v_route), 'P3: no categories chosen hears all';
  update profiles set available_for_jobs = false where id = '00000000-0000-4000-8000-0000000000a4';
  v := make_listing('Hagejobb nummer to', 'hage');
  assert not exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000a4' and route = '/oppdrag/' || v), 'P4: «Tilgjengelig» off hears none';
  update profiles set available_for_jobs = true where id = '00000000-0000-4000-8000-0000000000a4';
end $$;

-- ---------- 6. reminders ----------
do $$
declare v uuid; p uuid; r jsonb; n int;
begin
  v := make_listing('Stille oppdrag her', 'hage');
  update listings set created_at = now() - interval '3 days' where id = v;
  r := send_listing_reminders();
  assert (r->>'noOffers')::int >= 1, 'R1: no tilbud in 48 hours';
  select count(*) into n from notifications where route = '/oppdrag/' || v || '?tips=1';
  assert n = 1, 'R2: the tips go out';
  perform send_listing_reminders();
  select count(*) into n from notifications where route = '/oppdrag/' || v || '?tips=1';
  assert n = 1, 'R3: only once';

  v := make_listing('Venter på svar her', 'hage');
  p := give_tilbud('00000000-0000-4000-8000-0000000000a2', v, 't6');
  update proposals set created_at = now() - interval '25 hours' where id = p;
  delete from notifications where route = '/tilbud';
  perform send_listing_reminders();
  assert exists (select 1 from notifications where route = '/tilbud' and title like '%venter på svar'), 'R4: unanswered tilbud';

  update proposals set expires_at = now() + interval '20 hours' where id = p;
  perform send_listing_reminders();
  select count(*) into n from notifications where route = '/tilbud/' || p and title like '%utløper snart';
  assert n = 2, 'R5: both sides hear about the expiry';

end $$;

-- nothing at night
do $$
declare r jsonb;
begin
  create or replace function oslo_hhmm(p_at timestamptz) returns text language sql immutable as $f$ select '03:00'::text $f$;
  r := send_listing_reminders();
  assert r = '{}'::jsonb, 'R9: quiet at night';
  create or replace function oslo_hhmm(p_at timestamptz) returns text language sql immutable as $f$ select '12:00'::text $f$;
end $$;

-- ---------- 7. questions ----------
do $$
declare v uuid; q listing_questions; n int;
begin
  v := make_listing('Spørsmål om jobben', 'hage');
  update listings set type = 'SERVICE_OFFER' where id = v;  -- questions are for offers only (0094)

  perform as_user('00000000-0000-4000-8000-0000000000b1');
  begin
    perform ask_listing_question(v, 'Kan jeg spørre?');
    assert false, 'Q1: youth must be refused';
  exception when insufficient_privilege then null;
  end;
  perform as_admin();

  perform as_user('00000000-0000-4000-8000-0000000000a1');
  begin
    perform ask_listing_question(v, 'Mitt eget spørsmål');
    assert false, 'Q2: not on your own post';
  exception when raise_exception then null;
  end;
  perform as_admin();

  perform as_user('00000000-0000-4000-8000-0000000000a2');
  q := ask_listing_question(v, 'Hvor stor er hagen?');
  begin
    insert into listing_questions (listing_id, author_id, body) values (v, auth.uid(), 'Rett inn i tabellen');
    assert false, 'Q3: no direct writes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform answer_listing_question(q.id, 'Svarer selv');
    assert false, 'Q4: only the owner answers';
  exception when insufficient_privilege then null;
  end;
  perform as_admin();

  perform as_user('00000000-0000-4000-8000-0000000000a1');
  perform answer_listing_question(q.id, 'Rundt 300 m².');
  perform as_admin();

  perform as_user('00000000-0000-4000-8000-0000000000a4');
  select count(*) into n from listing_questions where listing_id = v and answer is not null;
  perform as_admin();
  assert n = 1, 'Q5: anyone who sees the post reads the answer';
  assert exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000a2' and title = 'Spørsmålet ditt er besvart'), 'Q6: asker hears the answer';

  perform as_user('00000000-0000-4000-8000-0000000000a1');
  perform delete_listing_question(q.id);
  perform as_admin();
  assert not exists (select 1 from listing_questions where id = q.id), 'Q7: owner can remove it';
end $$;

-- ---------- 8. chat ----------
do $$
declare v uuid; v2 uuid; c1 uuid; c2 uuid; m1 uuid; m2 uuid; n int;
begin
  v := make_listing('Prate om jobben', 'hage');
  v2 := make_listing('Prate om noe annet', 'hage');
  perform as_user('00000000-0000-4000-8000-0000000000a2');
  select (start_conversation_for_listing(v)).id into c1;
  select (start_conversation_for_listing(v2)).id into c2;
  insert into messages (conversation_id, author_id, kind, text) values (c1, auth.uid(), 'TEXT', 'Hei') returning id into m1;
  insert into messages (conversation_id, author_id, kind, text, reply_to_id) values (c1, auth.uid(), 'TEXT', 'Svar', m1) returning id into m2;
  begin
    insert into messages (conversation_id, author_id, kind, text, reply_to_id) values (c2, auth.uid(), 'TEXT', 'Lekk', m1);
    assert false, 'C1: a reply must stay in its conversation';
  exception when insufficient_privilege then null;
  end;

  perform delete_my_message(m2);
  perform as_admin();
  assert (select text from messages where id = m2) = '' and (select deleted_at from messages where id = m2) is not null, 'C2: text is gone';
  assert (select last_message_preview from conversations where id = c1) = 'Meldingen ble slettet', 'C3: Innboks follows';

  perform as_user('00000000-0000-4000-8000-0000000000a1');
  begin
    perform delete_my_message(m1);
    assert false, 'C4: not someone else''s message';
  exception when insufficient_privilege then null;
  end;
  perform as_admin();

  update messages set created_at = now() - interval '11 minutes' where id = m1;
  perform as_user('00000000-0000-4000-8000-0000000000a2');
  begin
    perform delete_my_message(m1);
    assert false, 'C5: only within 10 minutes';
  exception when raise_exception then null;
  end;

  perform set_conversation_archived(c1, true);
  perform as_admin();
  assert (select archived_at from conversation_participants where conversation_id = c1 and profile_id = '00000000-0000-4000-8000-0000000000a2') is not null, 'C6: archived';
  assert (select archived_at from conversation_participants where conversation_id = c1 and profile_id = '00000000-0000-4000-8000-0000000000a1') is null, 'C7: only for me';

  perform as_user('00000000-0000-4000-8000-0000000000a1');
  insert into messages (conversation_id, author_id, kind, text) values (c1, auth.uid(), 'TEXT', 'Hallo igjen');
  perform as_admin();
  assert (select archived_at from conversation_participants where conversation_id = c1 and profile_id = '00000000-0000-4000-8000-0000000000a2') is null, 'C8: a new message brings it back';
end $$;

-- ---------- 9. dugnad and tools ----------
do $$
declare d uuid; t uuid; b tool_bookings; n int;
begin
  insert into noticeboard_posts (author_id, kind, title, body, municipality, is_dugnad, event_at)
    values ('00000000-0000-4000-8000-0000000000a1', 'GENERAL', 'Dugnad i gata', 'Rake løv', 'Lillehammer', true, now() + interval '20 hours')
    returning id into d;
  perform as_user('00000000-0000-4000-8000-0000000000a2');
  n := set_dugnad_signup(d, true);
  perform as_admin();
  assert n = 1, 'G1: signed up';
  perform as_user('00000000-0000-4000-8000-0000000000b1');
  n := set_dugnad_signup(d, true);
  perform as_admin();
  assert n = 2, 'G2: a youth can join a dugnad (0094)';
  perform send_community_reminders();
  select count(*) into n from notifications where title = 'Dugnad i morgen' and route = '/oppslagstavle?oppslag=' || d;
  assert n = 3, 'G3: reminder to those who joined and the organiser';
  perform send_community_reminders();
  select count(*) into n from notifications where title = 'Dugnad i morgen' and route = '/oppslagstavle?oppslag=' || d;
  assert n = 3, 'G4: only once';

  insert into noticeboard_posts (author_id, kind, title, body, municipality)
    values ('00000000-0000-4000-8000-0000000000a1', 'TOOL_LEND', 'Låner ut stige', 'Stor stige', 'Lillehammer')
    returning id into t;
  perform as_user('00000000-0000-4000-8000-0000000000a2');
  b := request_tool_booking(t, current_date + 1, current_date + 3, 'Maling');
  perform as_admin();
  perform as_user('00000000-0000-4000-8000-0000000000a1');
  perform respond_tool_booking(b.id, 'APPROVED');
  perform as_admin();
  perform as_user('00000000-0000-4000-8000-0000000000a3');
  begin
    perform request_tool_booking(t, current_date + 2, current_date + 4, null);
    assert false, 'G5: overlapping days are refused';
  exception when raise_exception then null;
  end;
  select count(*) into n from tool_bookings;
  assert n = 0, 'G6: others can not read who borrowed';
  select count(*) into n from tool_booked_days(t);
  assert n = 1, 'G7: but they see the days';
  perform request_tool_booking(t, current_date + 4, current_date + 5, null);
  perform as_admin();
end $$;

-- ---------- 10. thanks and numbers ----------
do $$
declare v uuid; p uuid; v_year int := extract(year from now() at time zone 'Europe/Oslo'); j jsonb;
begin
  v := make_listing('Ferdig jobb her', 'hage');
  p := give_tilbud('00000000-0000-4000-8000-0000000000a2', v, 't7');
  perform as_user('00000000-0000-4000-8000-0000000000a1');
  perform respond_to_proposal(p, 'ACCEPT', 'RECIPIENT');
  begin
    perform send_thank_card(p, 'KIND', 'Takk!');
    assert false, 'T1: not before the job is finished';
  exception when raise_exception then null;
  end;
  perform as_admin();
  insert into completion_confirmations (agreement_proposal_id, by_profile_id) values
    (p, '00000000-0000-4000-8000-0000000000a1'), (p, '00000000-0000-4000-8000-0000000000a2');

  perform as_user('00000000-0000-4000-8000-0000000000a1');
  perform send_thank_card(p, 'KIND', 'Takk!');
  perform as_admin();
  assert (select count(*) from thank_cards where to_profile_id = '00000000-0000-4000-8000-0000000000a2') = 1, 'T2: card saved';

  perform as_user('00000000-0000-4000-8000-0000000000a4');
  begin
    perform send_thank_card(p, 'KIND', 'Falsk');
    assert false, 'T3: only the two people';
  exception when insufficient_privilege then null;
  end;
  perform as_admin();

  perform as_user('00000000-0000-4000-8000-0000000000a2');
  j := my_agreed_sum(v_year);
  assert (j->>'totalMinor')::bigint >= 40000, 'T4: agreed sum';
  assert jsonb_array_length(j->'people') = 1, 'T5: per person';
  j := my_year_recap(v_year);
  assert (j->>'helped')::int >= 1 and j->>'topCategory' = 'hage', 'T6: recap';
  perform as_admin();
end $$;

-- ---------- 11. politiattest ----------
do $$
declare n int;
begin
  perform as_user('00000000-0000-4000-8000-0000000000a2');
  begin
    perform submit_police_certificate('00000000-0000-4000-8000-0000000000a1/x.jpg');
    assert false, 'A1: only your own folder';
  exception when insufficient_privilege then null;
  end;
  perform submit_police_certificate('00000000-0000-4000-8000-0000000000a2/x.jpg');
  perform as_admin();

  perform as_user('00000000-0000-4000-8000-0000000000a4');
  select count(*) into n from police_certificates;
  assert n = 0, 'A2: nobody else reads it';
  assert not has_police_certificate('00000000-0000-4000-8000-0000000000a2'), 'A3: no badge before it is decided';
  perform as_admin();

  perform moderation_decide_police_certificate('00000000-0000-4000-8000-0000000000a2', true, null);
  assert (select file_path from police_certificates where profile_id = '00000000-0000-4000-8000-0000000000a2') is null, 'A4: the file is gone after the decision';
  assert exists (select 1 from storage_purge_queue where path like '%x.jpg'), 'A5: queued for deletion';
  assert has_police_certificate('00000000-0000-4000-8000-0000000000a2'), 'A6: badge';
end $$;

-- ---------- 12. snow ----------
do $$
declare n int;
begin
  n := snow_alert('Lillehammer');
  assert n >= 1, 'W1: snømåking helpers hear it';
  assert snow_alert('Lillehammer') = 0, 'W2: once a day per kommune';
end $$;

-- the finished job above owes reviews (0072), which would stop the next oppdrag
delete from completion_confirmations;

-- ---------- 13. what changed on an edit ----------
do $$
declare v uuid; p uuid; v_body text; n int;
begin
  v := make_listing('Endres etter tilbud', 'hage');
  p := give_tilbud('00000000-0000-4000-8000-0000000000a3', v, 't8');
  perform as_user('00000000-0000-4000-8000-0000000000a1');
  perform update_listing(v, 'Endres etter tilbud', 'hage', 'BUDGET', 50000::bigint, 'Lillehammer', 'Nordre Ål',
    'Beskrivelse av jobben', '', '', '', 'Lør 7. nov', '[]'::jsonb, '{}'::text[], 'ALL', null, null, null, null, null);
  perform as_admin();
  select body into v_body from notifications where route = '/oppdrag/' || v and title = 'Oppdraget er endret';
  assert v_body like '%prisen og tidspunktet er endret%', 'E1: says what changed: ' || coalesce(v_body, 'nothing');

  perform as_user('00000000-0000-4000-8000-0000000000a1');
  perform update_listing(v, 'Endres etter tilbud', 'hage', 'BUDGET', 50000::bigint, 'Lillehammer', 'Nordre Ål',
    'Beskrivelse av jobben', '', '', '', 'Lør 7. nov', '[]'::jsonb, '{}'::text[], 'ALL', null, null, null, null, null);
  perform as_admin();
  select count(*) into n from notifications where route = '/oppdrag/' || v and title = 'Oppdraget er endret';
  assert n = 1, 'E2: nothing changed, nobody is disturbed';
end $$;

-- ---------- 14. a saved search for «Tilbyr hjelp» ----------
do $$
declare v uuid; n int;
begin
  insert into saved_searches (profile_id, name, filter, sort, alert) values
    ('00000000-0000-4000-8000-0000000000a4', 'Tilbud', '{"type":"SERVICE_OFFER"}', 'NEWEST', true),
    ('00000000-0000-4000-8000-0000000000a2', 'Oppdrag', '{"type":"TASK_REQUEST"}', 'NEWEST', true);
  insert into listings (type, owner_id, title, category_slug, price_mode, municipality, place, status)
    values ('SERVICE_OFFER', '00000000-0000-4000-8000-0000000000a3', 'Vasker vinduer', 'annet', 'BY_AGREEMENT', 'Hamar', 'Sentrum', 'PUBLISHED')
    returning id into v;
  select count(*) into n from notifications where route = '/oppdrag/' || v and profile_id = '00000000-0000-4000-8000-0000000000a4';
  assert n = 1, 'L1: an alert for «Tilbyr hjelp»';
  select count(*) into n from notifications where route = '/oppdrag/' || v and profile_id = '00000000-0000-4000-8000-0000000000a2';
  assert n = 0, 'L2: not for a search that only wants oppdrag';
end $$;

-- ---------- 15. Slett konto ----------
do $$
declare v uuid; q listing_questions;
begin
  v := make_listing('Spørsmål før sletting', 'hage');
  update listings set type = 'SERVICE_OFFER' where id = v;
  perform as_user('00000000-0000-4000-8000-0000000000a4');
  q := ask_listing_question(v, 'Blir dette slettet?');
  perform as_admin();
  update profiles set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000a4';
  assert not exists (select 1 from listing_questions where id = q.id), 'X1: my questions go with my account';
  update profiles set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000a2';
  assert not exists (select 1 from police_certificates where profile_id = '00000000-0000-4000-8000-0000000000a2'), 'X2: the politiattest record too';
  assert not exists (select 1 from thank_cards where to_profile_id = '00000000-0000-4000-8000-0000000000a2'), 'X3: and the takkekort';
end $$;

-- ---------- 16. youth rights and review approval (0094) ----------
do $$
declare v uuid; p uuid; o uuid; c uuid; r_id uuid; n int; j uuid := '00000000-0000-4000-8000-0000000000b1';
begin
  -- a fresh adult: the ones above were deleted in section 15
  insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000c1', 'voksen@test.invalid');
  update profiles set municipality = 'Lillehammer', display_name = 'Vera Voksen', onboarded_at = now()
   where id = '00000000-0000-4000-8000-0000000000c1';

  -- every category is open to a youth
  perform as_user(j);
  insert into listings (type, owner_id, title, category_slug, price_mode, municipality, place, status)
    values ('SERVICE_OFFER', j, 'Hjelper med montering', 'montering', 'BY_AGREEMENT', 'Lillehammer', 'Sentrum', 'PUBLISHED')
    returning id into o;
  -- but never an oppdrag
  begin
    insert into listings (type, owner_id, title, category_slug, price_mode, municipality, place, status)
      values ('TASK_REQUEST', j, 'Trenger hjelp selv', 'hage', 'BY_AGREEMENT', 'Lillehammer', 'Sentrum', 'PUBLISHED');
    assert false, 'Y1: a youth still can not post an oppdrag';
  exception when insufficient_privilege then null;
  end;
  -- the noticeboard and saved searches are open
  insert into noticeboard_posts (author_id, kind, title, body, municipality) values (j, 'GENERAL', 'Hei fra meg', 'Jeg er ny her', 'Lillehammer');
  insert into saved_searches (profile_id, name, filter, sort) values (j, 'Hage', '{}', 'NEWEST');
  insert into notice_comments (notice_id, author_id, body) select id, j, 'Hei, jeg kan hjelpe' from noticeboard_posts where title = 'Hei fra meg';
  perform as_admin();

  -- a finished job between an adult and a youth
  v := null;
  insert into listings (type, owner_id, title, category_slug, price_mode, municipality, place, status)
    values ('TASK_REQUEST', '00000000-0000-4000-8000-0000000000c1', 'Rake løv her', 'hage', 'BY_AGREEMENT', 'Lillehammer', 'Sentrum', 'PUBLISHED')
    returning id into v;
  update listings set pending_review = false where id = v;
  p := give_tilbud(j, v, 't9');
  perform as_user('00000000-0000-4000-8000-0000000000c1');
  perform respond_to_proposal(p, 'ACCEPT', 'RECIPIENT');
  perform as_admin();
  insert into completion_confirmations (agreement_proposal_id, by_profile_id) values
    (p, '00000000-0000-4000-8000-0000000000c1'), (p, j);

  perform as_user(j);
  r_id := (submit_review(p, 5, 'Hyggelig folk', '{}', true)).id;
  perform as_admin();
  assert (select approval from reviews where id = r_id) = 'PENDING', 'Y2: a youth review waits';
  perform as_user('00000000-0000-4000-8000-0000000000c1');
  perform submit_review(p, 5, 'Flink', '{}', true);
  select count(*) into n from visible_reviews where agreement_proposal_id = p;
  perform as_admin();
  assert n = 0, 'Y3: nobody sees either review, also when both have reviewed';
  assert (select count(*) from reviews where agreement_proposal_id = p and approval = 'PENDING') = 2, 'Y4: a review of a youth waits too';
  assert not exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000c1' and title = 'Ny vurdering'), 'Y5: no notice while it waits';

  perform as_user(j);
  update reviews set approval = 'APPROVED' where id = r_id;
  perform as_admin();
  assert (select approval from reviews where id = r_id) = 'PENDING', 'Y6: nobody approves their own';

  perform moderation_decide_review(r_id, true, null);
  perform as_user(j);
  select count(*) into n from visible_reviews where id = r_id;
  perform as_admin();
  assert n = 1, 'Y7: visible once approved';
  assert exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000c1' and title = 'Ny vurdering'), 'Y8: the notice comes now';
end $$;

-- ---------- 17. questions and likes (0094) ----------
do $$
declare v uuid; o uuid; n int; j uuid := '00000000-0000-4000-8000-0000000000b1'; a uuid := '00000000-0000-4000-8000-0000000000c1';
begin
  insert into listings (type, owner_id, title, category_slug, price_mode, municipality, place, status)
    values ('TASK_REQUEST', a, 'Et vanlig oppdrag', 'hage', 'BY_AGREEMENT', 'Lillehammer', 'Sentrum', 'PUBLISHED') returning id into v;
  update listings set pending_review = false where id = v;
  o := (select id from listings where title = 'Hjelper med montering');
  update listings set pending_review = false where id = o;
  perform as_user(a);
  begin
    perform ask_listing_question(v, 'Kan jeg spørre her?');
    assert false, 'K1: no questions on an oppdrag';
  exception when raise_exception then null;
  end;
  perform ask_listing_question(o, 'Har du verktøy selv?');
  insert into notice_likes (notice_id, profile_id) select id, a from noticeboard_posts limit 1;
  select count(*) into n from notice_likes;
  assert n = 1, 'K2: a like';
  begin
    insert into notice_likes (notice_id, profile_id) select id, j from noticeboard_posts limit 1;
    assert false, 'K3: nobody likes for someone else';
  exception when insufficient_privilege then null;
  end;
  perform as_admin();
end $$;

-- ---------- 18. a message only to people without a kommune (0095) ----------
do $$
declare n int; m int;
begin
  insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000c2', 'utenkommune@test.invalid');
  update profiles set municipality = null where id = '00000000-0000-4000-8000-0000000000c2';
  select count(*) into n from minnabo_audience('{"no_kommune": true}');
  select count(*) into m from minnabo_audience('{"no_kommune": true}') a join profiles p on p.id = a where coalesce(btrim(p.municipality), '') <> '';
  assert n >= 1, 'N1: the person without a kommune is reached';
  assert m = 0, 'N2: nobody with a kommune is';
end $$;

-- ---------- 19. more ways to pick who gets a message (0096) ----------
do $$
declare n int;
begin
  -- never posted an oppdrag: the youth from section 16 (it can't) is in, the adult who posted one is not
  select count(*) into n from minnabo_audience('{"posts": "no_task"}') a where a = '00000000-0000-4000-8000-0000000000c1';
  assert n = 0, 'F1: someone who posted an oppdrag is left out';
  select count(*) into n from minnabo_audience('{"posts": "has_offer", "account": "youth"}') a where a = '00000000-0000-4000-8000-0000000000b1';
  assert n = 1, 'F2: a youth with a «Tilbyr hjelp» out is found';
  select count(*) into n from minnabo_audience('{"posts": "no_offer", "account": "youth"}') a where a = '00000000-0000-4000-8000-0000000000b1';
  assert n = 0, 'F3: and is not told to make one';
  select count(*) into n from minnabo_audience('{"joined_days": 7}');
  assert n > 0, 'F4: the people made today joined this week';
  select count(*) into n from minnabo_audience('{"inactive_days": 30}');
  assert n = 0, 'F5: nobody made today has been away for 30 days';
  update profiles set avatar_path = 'x/y.jpg' where id = '00000000-0000-4000-8000-0000000000c1';
  select count(*) into n from minnabo_audience('{"no_avatar": true}') a where a = '00000000-0000-4000-8000-0000000000c1';
  assert n = 0, 'F6: someone with a picture is left out';
end $$;

\echo ALL CHECKS PASSED
