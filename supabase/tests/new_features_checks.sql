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

  update messages set created_at = now() - interval '16 minutes' where id = m1;
  perform as_user('00000000-0000-4000-8000-0000000000a2');
  begin
    perform delete_my_message(m1);
    assert false, 'C5: only within 15 minutes (0110)';
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

-- ---------- 20. notifications for oppslag (0097) ----------
do $$
declare v uuid; n int;
begin
  delete from notifications;
  -- a kommune-wide oppslag reaches the others in the kommune, never the author
  insert into noticeboard_posts (author_id, kind, title, body, municipality)
    values ('00000000-0000-4000-8000-0000000000a1', 'GIVEAWAY', 'Gir bort sofa', 'Hentes i helga', 'Lillehammer') returning id into v;
  select count(*) into n from notifications where kind = 'NABOLAG_POST' and route = '/oppslagstavle?oppslag=' || v;
  assert n >= 1, 'O1: neighbours hear about a new oppslag';
  assert not exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000a1' and route = '/oppslagstavle?oppslag=' || v), 'O2: never the author';
  -- at most three a day each
  insert into noticeboard_posts (author_id, kind, title, body, municipality)
    select '00000000-0000-4000-8000-0000000000a1', 'GENERAL', 'Oppslag ' || i, 'Tekst nummer ' || i, 'Lillehammer' from generate_series(1, 4) i;
  select max(c) into n from (select count(*) c from notifications where kind = 'NABOLAG_POST' group by profile_id) t;
  assert n = 3, 'O3: three a day, then quiet';
  -- an answer reaches the author and the others who answered
  delete from notifications;
  insert into notice_comments (notice_id, author_id, body) values (v, '00000000-0000-4000-8000-0000000000b1', 'Er den ledig?');
  insert into notice_comments (notice_id, author_id, body) values (v, '00000000-0000-4000-8000-0000000000c1', 'Jeg vil også ha den');
  assert exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000b1' and route = '/oppslagstavle?oppslag=' || v || '&svar=1'), 'O4: the one who answered first hears about the next answer';
  select count(*) into n from notifications where profile_id = '00000000-0000-4000-8000-0000000000a1' and route = '/oppslagstavle?oppslag=' || v || '&svar=1';
  assert n = 2, 'O5: the author hears about both answers';
  assert not exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000c1'), 'O6: never about your own answer';
end $$;

-- ---------- 21. no view can be written to by the app's roles (0098) ----------
do $$
declare v text; r text; ok boolean;
begin
  for v in select table_name from information_schema.views where table_schema = 'public' loop
    foreach r in array array['anon', 'authenticated'] loop
      ok := false;
      begin
        execute format('set local role %I', r);
        execute format('delete from public.%I where false', v);
        ok := true;
      exception when others then null;
      end;
      reset role;
      assert not ok, format('V1: %s can write to the view %s – revoke it like 0098', r, v);
    end loop;
  end loop;
end $$;

-- ---------- 22. views, photos, threads, tidy-up, review photos, problem reports (0099) ----------
do $$
declare v uuid; n int; c1 uuid; c2 uuid; t uuid; a uuid := '00000000-0000-4000-8000-0000000000c1'; j uuid := '00000000-0000-4000-8000-0000000000b1';
begin
  -- views: counted once per neighbour, never the owner, only the owner sees the number
  select id into v from listings where owner_id = a limit 1;
  perform as_user(j);
  perform record_listing_view(v);
  perform record_listing_view(v);
  assert listing_view_count(v) is null, 'W1: only the owner sees the count';
  perform as_user(a);
  perform record_listing_view(v);
  assert listing_view_count(v) = 1, 'W2: one neighbour, counted once, owner not counted';
  perform as_admin();

  -- several photos, the first one stays in image_path
  insert into noticeboard_posts (author_id, kind, title, body, municipality, image_paths)
    values (a, 'GIVEAWAY', 'Gir bort stoler', 'Fire stoler i eik', 'Lillehammer', array[a || '/1.jpg', a || '/2.jpg'])
    returning id into t;
  assert (select image_path from noticeboard_posts where id = t) = a || '/1.jpg', 'P1: the first photo is the cover';

  -- one level of replies
  perform as_user(j);
  insert into notice_comments (notice_id, author_id, body) values (t, j, 'Er de ledige?') returning id into c1;
  perform as_user(a);
  insert into notice_comments (notice_id, author_id, body, parent_id) values (t, a, 'Ja!', c1) returning id into c2;
  perform as_user(j);
  insert into notice_comments (notice_id, author_id, body, parent_id) values (t, j, 'Flott', c2) returning id into c2;
  perform as_admin();
  assert (select parent_id from notice_comments where id = c2) = c1, 'R1: a reply to a reply hangs under the first answer';

  -- tidy-up: asked after 14 days, closed 7 days later, «behold» starts over
  update noticeboard_posts set created_at = now() - interval '15 days' where id = t;
  perform tidy_old_notices();
  assert (select still_asked_at is not null from noticeboard_posts where id = t), 'T1: the owner is asked';
  update noticeboard_posts set still_asked_at = now() - interval '8 days' where id = t;
  perform tidy_old_notices();
  assert (select done_at is not null and auto_closed from noticeboard_posts where id = t), 'T2: closed after 7 more days';
  perform as_user(a);
  perform keep_notice(t);
  perform as_admin();
  assert (select done_at is null and still_asked_at is null from noticeboard_posts where id = t), 'T3: «behold» opens it again';

  -- problem reports land in my MinNabo thread, only my own screenshot folder
  perform as_user(a);
  perform minnabo_report_problem('Knappen virker ikke', a || '/skjerm.png', 'Søk');
  begin
    perform minnabo_report_problem('Med andres bilde', j || '/skjerm.png', null);
    assert false, 'B1: someone else''s file is refused';
  exception when raise_exception then null;
  end;
  perform as_admin();
  assert exists (select 1 from minnabo_messages where profile_id = a and is_problem_report and image_path = a || '/skjerm.png'), 'B2: the report is stored';
end $$;

-- 23. Hamar, Ringsaker and Stange are one area (0100)
do $$
begin
  assert kommune_group('Hamar') = array['Hamar', 'Ringsaker', 'Stange'], 'K1: Hamar sees Ringsaker and Stange';
  assert kommune_group('Stange') @> array['Hamar', 'Ringsaker'], 'K2: and the other way round';
  assert not ('Lillehammer' = any(kommune_group('Ringsaker'))), 'K3: the two groups stay apart';
  assert kommune_group('Løten') = array['Løten'], 'K4: a kommune outside a group is alone';
end $$;

-- ---------- 24. expansion (0101) ----------
do $$
declare
  o uuid := '00000000-0000-4000-8000-0000000000a1'; h uuid := '00000000-0000-4000-8000-0000000000a3';
  s uuid := '00000000-0000-4000-8000-0000000000a4'; y uuid := '00000000-0000-4000-8000-0000000000b1';
  v uuid; p uuid; t uuid; e uuid; it uuid; rq lend_requests; nxt timestamptz; j json; code text;
begin
  -- a fast avtale
  insert into listings (type, owner_id, title, category_slug, price_mode, municipality, place, status)
    values ('TASK_REQUEST', o, 'Klippe plenen fast', 'hage', 'BY_AGREEMENT', 'Lillehammer', 'Sentrum', 'PUBLISHED') returning id into v;
  insert into task_details (listing_id, description) values (v, 'Hver tirsdag');
  p := give_tilbud(h, v, 'x24');
  perform as_user(o);
  perform respond_to_proposal(p, 'ACCEPT', 'RECIPIENT');
  perform as_admin();
  update agreement_snapshots set scheduled_at = now() - interval '20 days' where proposal_id = p;
  perform as_user(s);
  begin
    perform set_agreement_repeat(p, 7, null);
    assert false, 'F1: a stranger cannot make it fast';
  exception when raise_exception then null;
  end;
  perform as_user(o);
  perform set_agreement_repeat(p, 7, null);
  nxt := next_agreement_visit(p);
  assert nxt > now() and nxt <= now() + interval '7 days', 'F2: the next visit is within a week';
  perform mark_agreement_visit(p, nxt - interval '7 days');
  assert (select count(*) from agreement_visits where proposal_id = p) = 1, 'F3: a visit is marked';
  perform as_admin();
  assert (select count(*) from notifications where profile_id = h and title like '%gjorde avtalen fast%') = 1, 'F4: the helper is told';
  update agreement_snapshots set repeat_until = current_date - 1 where proposal_id = p;
  perform send_repeat_visit_reminders();
  assert (select repeat_ended_at is not null from agreement_snapshots where proposal_id = p), 'F5: the season ends by itself';

  -- «Jeg vil ha den»: first in the queue is offered, «kom ikke» moves it on, «hentet» closes the oppslag
  insert into noticeboard_posts (author_id, kind, title, body, municipality)
    values (o, 'GIVEAWAY', 'Gir bort sykkel', 'Barnesykkel 16 tommer', 'Lillehammer') returning id into t;
  perform as_user(h);
  assert reserve_notice(t, true) = 1, 'Q1: first in the queue';
  perform as_user(s);
  assert reserve_notice(t, true) = 2, 'Q2: second in the queue';
  perform as_user(h);
  assert (select count(*) from notice_reservations where notice_id = t) = 1, 'Q3: I only see my own place';
  perform as_user(o);
  assert (select count(*) from notice_reservations where notice_id = t) = 2, 'Q4: the owner sees the queue';
  assert settle_reservation(t, false) = s, 'Q5: «kom ikke» offers it to the next';
  assert settle_reservation(t, true) = s, 'Q6: «hentet»';
  perform as_admin();
  assert (select done_at is not null from noticeboard_posts where id = t), 'Q7: the oppslag is closed';

  -- arrangement: «Kommer» / «Kanskje», a chat for those coming, never for youth
  insert into noticeboard_posts (author_id, kind, title, body, municipality, event_type, event_at)
    values (o, 'GENERAL', 'Loppemarked i gata', 'Ta med det du vil selge', 'Lillehammer', 'LOPPEMARKED', now() + interval '3 days') returning id into e;
  perform as_user(h);
  j := set_event_rsvp(e, 'GOING');
  perform as_user(s);
  j := set_event_rsvp(e, 'MAYBE');
  assert (j->>'going')::int = 1 and (j->>'maybe')::int = 1, 'E1: counted';
  perform as_user(h);
  perform post_event_message(e, 'Jeg tar med kaffe');
  perform as_user(y);
  j := set_event_rsvp(e, 'GOING');
  assert not can_use_event_chat(e), 'E2: no group chat for youth';
  assert (select count(*) from event_messages where notice_id = e) = 0, 'E3: youth read nothing';
  perform as_admin();
  insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1', 'utenfor@test.invalid');
  update profiles set municipality = 'Lillehammer', onboarded_at = now() where id = '00000000-0000-4000-8000-0000000000d1';
  perform as_user('00000000-0000-4000-8000-0000000000d1');
  assert (select count(*) from event_messages where notice_id = e) = 0, 'E4: someone not coming reads nothing';
  perform as_admin();

  -- avstemning: one vote each, can be changed, totals for all
  update noticeboard_posts set poll_options = array['Ja', 'Nei', 'Vet ikke'] where id = e;
  perform as_user(h);
  perform vote_notice_poll(e, 0);
  perform vote_notice_poll(e, 1);
  perform as_user(s);
  perform vote_notice_poll(e, 1);
  j := notice_poll(e);
  assert (j->>'total')::int = 2 and (j->'counts'->>1)::int = 2 and (j->>'mine')::int = 1, 'V1: totals and my vote';
  begin
    perform vote_notice_poll(e, 5);
    assert false, 'V2: a choice that is not there is refused';
  exception when raise_exception then null;
  end;
  perform as_admin();

  -- utlån: request, no double booking, only the owner answers, youth can't lend out
  perform as_user(o);
  insert into lend_items (owner_id, title, category) values (o, 'Stige 3 m', 'VERKTOY') returning id into it;
  perform as_user(h);
  rq := request_lend(it, current_date + 1, current_date + 3, 'Til takrennene');
  perform as_user(s);
  begin
    perform respond_lend(rq.id, 'ACCEPTED');
    assert false, 'L1: only the owner answers';
  exception when insufficient_privilege then null;
  end;
  perform as_user(o);
  perform respond_lend(rq.id, 'ACCEPTED');
  perform as_user(s);
  begin
    perform request_lend(it, current_date + 2, current_date + 4, null);
    assert false, 'L2: not when it is lent out';
  exception when raise_exception then null;
  end;
  -- since 0107 a youth may lend out too (decided 2026-11-13)
  perform as_user(y);
  insert into lend_items (owner_id, title) values (y, 'Sykkelpumpe');
  perform as_admin();
  assert (select count(*) from lend_items where owner_id = y and title = 'Sykkelpumpe') = 1, 'L3: a youth can lend out';
  delete from lend_items where owner_id = y and title = 'Sykkelpumpe';

  -- husstand: a code, a second adult joins, sees the other's oppdrag; never youth
  perform as_user(o);
  code := household_invite_code();
  perform as_user(h);
  perform household_join(code);
  j := my_household();
  assert (j->>'inHousehold')::boolean and (j->'partner'->>'id')::uuid = o, 'H1: in the same household';
  assert json_array_length(j->'listings') >= 1, 'H2: sees the other''s oppdrag';
  perform as_user(y);
  begin
    perform household_invite_code();
    assert false, 'H3: no household for youth';
  exception when insufficient_privilege then null;
  end;
  perform as_user(h);
  perform household_leave();
  perform as_admin();
  assert not exists (select 1 from household_members where profile_id = h), 'H4: left';

  -- fordeler for hjelpere: the code only after a finished job
  insert into partners (name, blurb, helper_offer) values ('Testbutikk AS', 'Test', '10 % for hjelpere') returning id into t;
  insert into partner_helper_codes (partner_id, code) values (t, 'NABO10');
  perform as_user(s);
  assert partner_helper_code(t) is null, 'D1: no code without a finished job';
  perform as_admin();
  insert into completion_confirmations (agreement_proposal_id, by_profile_id) values (p, o), (p, h) on conflict do nothing;
  perform as_user(h);
  assert partner_helper_code(t) = 'NABO10', 'D2: the code after a finished job';
  assert exists (select 1 from profile_category_jobs(h) where category_slug = 'hage' and jobs >= 1), 'M1: a hage job counts';
  begin
    perform 1 from partner_helper_codes;
    assert false, 'D3: the codes table is closed';
  exception when insufficient_privilege then null;
  end;
  perform as_admin();

  -- foresatt: sees the youth's plans and nothing for anyone else
  insert into guardian_links (youth_id, guardian_id, linked_at) values (y, s, now());
  perform as_user(s);
  j := guardian_overview();
  assert json_array_length(j) = 1 and (j->0->>'id')::uuid = y, 'G1: the foresatt sees the youth';
  perform as_user(h);
  assert json_array_length(guardian_overview()) = 0, 'G2: nobody else does';
  perform as_admin();
end $$;

-- ---------- 25. nabolag for every kommune (0102) ----------
do $$
begin
  assert (select count(distinct municipality) from neighbourhoods where active) = 46, 'N1: all 46 kommuner have nabolag';
  assert exists (select 1 from neighbourhoods where municipality = 'Ringsaker' and place = 'Moelv' and name = 'Moelv nabolag' and active), 'N2: Moelv';
  assert exists (select 1 from neighbourhoods where municipality = 'Ringsaker' and place = 'Brumunddal' and active), 'N3: Brumunddal';
  assert (select count(*) from neighbourhoods where municipality = 'Lillehammer' and active) = 21, 'N4: Lillehammer keeps its 21';
  -- an admin hides one and moves another
  update neighbourhoods set active = false where municipality = 'Ringsaker' and place = 'Nes';
  update neighbourhoods set sort = 5 where municipality = 'Ringsaker' and place = 'Moelv';
end $$;
create temp table n_count as select count(*) as c from neighbourhoods;
-- the seed again: changes none of that and adds nothing
\ir ../migrations/0102_nabolag_innlandet.sql
do $$
begin
  assert (select count(*) from neighbourhoods) = (select c from n_count), 'N5: running it again adds nothing';
  assert not (select active from neighbourhoods where municipality = 'Ringsaker' and place = 'Nes'), 'N6: a hidden nabolag stays hidden';
  assert (select sort from neighbourhoods where municipality = 'Ringsaker' and place = 'Moelv') = 5, 'N7: an admin''s order is kept';
  assert (select count(*) from (select municipality, place from neighbourhoods group by 1, 2 having count(*) > 1) d) = 0, 'N8: no duplicates';
  assert (select count(*) from neighbourhood_members m join neighbourhoods n on n.id = m.neighbourhood_id where n.municipality <> 'Lillehammer') = 0, 'N9: nobody is added as a member';
end $$;
drop table n_count;

-- ---------- 26. youth in a nabolag (0103) ----------
do $$
declare
  y uuid := '00000000-0000-4000-8000-0000000000b1'; o uuid := '00000000-0000-4000-8000-0000000000a1';
  n1 uuid; n2 uuid; n3 uuid; n4 uuid; t uuid;
begin
  select id into n1 from neighbourhoods where municipality = 'Lillehammer' and place = 'Sentrum';
  select id into n2 from neighbourhoods where municipality = 'Lillehammer' and place = 'Vingnes';
  select id into n3 from neighbourhoods where municipality = 'Lillehammer' and place = 'Fåberg';
  select id into n4 from neighbourhoods where municipality = 'Lillehammer' and place = 'Kanten';
  perform as_user(y);
  perform join_nabolag(n1);
  assert is_nabolag_member(n1), 'Y1: a youth joins a nabolag';
  perform join_nabolag(n2);
  perform join_nabolag(n3);
  begin
    perform join_nabolag(n4);
    assert false, 'Y2: at most 3, like everyone';
  exception when raise_exception then null;
  end;
  -- writes and reads the nabolag's oppslag
  insert into noticeboard_posts (author_id, kind, title, body, municipality, neighbourhood_id)
    values (y, 'GENERAL', 'Mistet katten', 'Grå katt med hvit labb, borte siden i går', 'Lillehammer', n1) returning id into t;
  assert (select count(*) from noticeboard_posts where id = t) = 1, 'Y3: reads its own nabolag oppslag';
  -- still no private reply to an author
  perform as_admin();
  insert into neighbourhood_members (neighbourhood_id, profile_id) values (n1, o) on conflict do nothing;
  insert into noticeboard_posts (author_id, kind, title, body, municipality, neighbourhood_id)
    values (o, 'GENERAL', 'Dugnad i Sentrum', 'Vi rydder lørdag', 'Lillehammer', n1) returning id into t;
  perform as_user(y);
  begin
    perform start_conversation_for_notice(t);
    assert false, 'Y4: no private reply for youth';
  exception when insufficient_privilege then null;
  end;
  perform leave_neighbourhood(n2);
  assert not is_nabolag_member(n2), 'Y5: and can leave again';
  perform as_admin();
end $$;

-- ---------- 27. utlån: the owner's reply and the busy days (0104) ----------
do $$
declare
  o uuid := '00000000-0000-4000-8000-0000000000a1'; h uuid := '00000000-0000-4000-8000-0000000000a3';
  s uuid := '00000000-0000-4000-8000-0000000000a4'; it uuid; rq lend_requests; n int;
begin
  perform as_user(o);
  insert into lend_items (owner_id, title, category) values (o, 'Tilhenger 750 kg', 'TRANSPORT') returning id into it;
  perform as_user(h);
  rq := request_lend(it, current_date + 2, current_date + 3, 'Til flyttingen');
  perform as_user(o);
  rq := respond_lend(rq.id, 'ACCEPTED', '  Hentes i garasjen etter kl. 17  ');
  assert rq.reply = 'Hentes i garasjen etter kl. 17', 'R1: the reply is kept, trimmed';
  perform as_admin();
  assert (select count(*) from notifications where profile_id = h and body like '%Hentes i garasjen%') = 1, 'R2: the borrower is told the reply';
  -- someone else sees the busy days, but nothing about who borrowed it
  perform as_user(s);
  select count(*) into n from lend_busy_days(it) where from_date = current_date + 2 and to_date = current_date + 3;
  assert n = 1, 'R3: the busy days are visible';
  assert (select count(*) from lend_requests where id = rq.id) = 0, 'R4: but not the request itself';
  -- the borrower can still call it off; a finished one cannot be cancelled again
  perform as_user(h);
  rq := respond_lend(rq.id, 'CANCELLED');
  begin
    perform respond_lend(rq.id, 'CANCELLED');
    assert false, 'R5: no double cancel';
  exception when raise_exception then null;
  end;
  perform as_user(s);
  assert (select count(*) from lend_busy_days(it)) = 0, 'R6: a cancelled loan frees the days';
  perform as_admin();
end $$;

-- ---------- 28. husstand: «Hvem kommer når» and telling the one who stays (0105) ----------
do $$
declare
  o uuid := '00000000-0000-4000-8000-0000000000a1'; hj uuid := '00000000-0000-4000-8000-0000000000a2';
  h uuid := '00000000-0000-4000-8000-0000000000a3'; s uuid := '00000000-0000-4000-8000-0000000000a4';
  l uuid; cv uuid; p1 uuid; p2 uuid; p3 uuid; v_code text; j json; told int;
begin
  perform as_user(o);
  v_code := household_invite_code();
  perform as_user(h);
  perform household_join(v_code);
  perform as_admin();
  select id into l from listings where owner_id = o order by created_at limit 1;
  insert into conversations (listing_id) values (l) returning id into cv;
  -- the partner's avtale, my own avtale, and one between the two of us
  -- test rows straight in: skip the review gate and other triggers for these inserts only
  set local session_replication_role = replica;
  insert into proposals (listing_id, conversation_id, from_profile_id, to_profile_id, price_amount_minor, status)
    values (l, cv, hj, o, 50000, 'ACCEPTED') returning id into p1;
  insert into proposals (listing_id, conversation_id, from_profile_id, to_profile_id, price_amount_minor, status)
    values (l, cv, h, s, 50000, 'ACCEPTED') returning id into p2;
  insert into proposals (listing_id, conversation_id, from_profile_id, to_profile_id, price_amount_minor, status)
    values (l, cv, h, o, 50000, 'ACCEPTED') returning id into p3;
  insert into agreement_snapshots (proposal_id, listing_id, price_amount_minor, scheduled_at) values
    (p1, l, 50000, now() + interval '1 day'), (p2, l, 50000, now() + interval '2 days'), (p3, l, 50000, null);
  set local session_replication_role = origin;
  perform as_user(h);
  j := my_household();
  assert j->>'since' is not null, 'HT1: since when';
  assert (select count(*) from json_array_elements(j->'agreements') a where (a->>'proposalId')::uuid in (p1, p2, p3)) = 3, 'HT2: both adults'' avtaler in one list';
  assert (select a->>'who' from json_array_elements(j->'agreements') a where (a->>'proposalId')::uuid = p1) = 'partner', 'HT3: the partner''s';
  assert (select a->>'who' from json_array_elements(j->'agreements') a where (a->>'proposalId')::uuid = p2) = 'me', 'HT4: my own';
  assert (select a->>'who' from json_array_elements(j->'agreements') a where (a->>'proposalId')::uuid = p3) = 'both', 'HT5: between us';
  assert (select a->>'with' from json_array_elements(j->'agreements') a where (a->>'proposalId')::uuid = p1) = 'Hanne Hjelper', 'HT6: with the one from outside';
  assert (select count(*) from json_array_elements(j->'listings') x where x->>'categorySlug' is not null) = json_array_length(j->'listings'), 'HT7: oppdrag carry their kind';
  assert (select count(*) from json_array_elements(j->'agreements') a where a::text like '%price%' or a::text like '%address%') = 0, 'HT8: never a price or a place';
  -- a stranger sees none of it
  perform as_user(s);
  j := my_household();
  assert not (j->>'inHousehold')::boolean and json_array_length(j->'agreements') = 0, 'HT9: nothing for someone outside';
  -- leaving tells the one who stays
  perform as_admin();
  select count(*) into told from notifications where profile_id = o and route = '/husstand';
  perform as_user(h);
  perform household_leave();
  perform as_admin();
  assert (select count(*) from notifications where profile_id = o and route = '/husstand' and body = 'Dere ser ikke lenger hverandres oppdrag og avtaler.') >= 1
     and (select count(*) from notifications where profile_id = o and route = '/husstand') = told + 1, 'HT10: the other one is told';
  -- alone with a code: leaving takes the invitation back
  perform as_user(o);
  perform household_leave();
  perform as_user(s);
  v_code := household_invite_code();
  perform household_leave();
  perform as_admin();
  assert not exists (select 1 from household_members where profile_id in (o, h, s)), 'HT11: nobody left behind';
  assert not exists (select 1 from household_invites where code = v_code), 'HT12: the code is gone';
  delete from proposals where id in (p1, p2, p3);
  delete from conversations where id = cv;
end $$;

-- ---------- 29. notifications for the new features (0106) ----------
do $$
declare
  o uuid := '00000000-0000-4000-8000-0000000000a1'; h uuid := '00000000-0000-4000-8000-0000000000a3';
  s uuid := '00000000-0000-4000-8000-0000000000a4'; y uuid := '00000000-0000-4000-8000-0000000000b1';
  e uuid; it uuid; rq lend_requests; j json; before int;
begin
  -- the group chat: the others are told, once per 20 minutes, never youth
  insert into noticeboard_posts (author_id, kind, title, body, municipality, event_type, event_at)
    values (o, 'GENERAL', 'Quiz på huset', 'Lag på fire', 'Lillehammer', 'QUIZ', now() + interval '20 hours') returning id into e;
  perform as_user(s);
  j := set_event_rsvp(e, 'GOING');
  perform as_user(y);
  j := set_event_rsvp(e, 'GOING');
  perform as_user(h);
  j := set_event_rsvp(e, 'MAYBE');
  perform post_event_message(e, 'Jeg tar med kaffe');
  perform post_event_message(e, 'Og kake');
  perform as_admin();
  assert (select count(*) from notifications where profile_id = o and route = '/arrangement/' || e) = 1, 'NF1: the organiser is told, once';
  assert (select count(*) from notifications where profile_id = s and route = '/arrangement/' || e and body = 'Hanne: Jeg tar med kaffe') = 0
      or (select count(*) from notifications where profile_id = s and route = '/arrangement/' || e) = 1, 'NF2: the one coming is told, once';
  assert (select count(*) from notifications where profile_id = h and route = '/arrangement/' || e) = 0, 'NF3: not the one who wrote';
  assert (select count(*) from notifications where profile_id = y and route = '/arrangement/' || e) = 0, 'NF4: never youth';

  -- the day-before reminder for an arrangement, once
  perform send_feature_reminders();
  perform send_feature_reminders();
  assert (select count(*) from notifications where profile_id = s and route = '/oppslagstavle?oppslag=' || e and title like '%Quiz på huset') = 1, 'NF5: reminded once';
  assert (select count(*) from notifications where profile_id = y and route = '/oppslagstavle?oppslag=' || e and title like '%Quiz på huset') = 1, 'NF6: youth coming are reminded too';
  assert (select count(*) from notifications where profile_id = o and route = '/oppslagstavle?oppslag=' || e and title like '%Quiz på huset') = 1, 'NF7: and the organiser';

  -- a poll that closed: the author gets the result
  update noticeboard_posts set poll_options = array['Fredag', 'Lørdag'], poll_closes_at = now() + interval '1 hour' where id = e;
  perform as_user(s);
  perform vote_notice_poll(e, 1);
  perform as_admin();
  update noticeboard_posts set poll_closes_at = now() - interval '1 minute' where id = e;
  perform send_feature_reminders();
  assert (select count(*) from notifications where profile_id = o and title = 'Avstemningen er ferdig' and body like '%Lørdag fikk flest stemmer (1 stemte).') = 1, 'NF8: the result';

  -- utlån: called off tells the owner; pickup and return reminders
  perform as_user(o);
  insert into lend_items (owner_id, title, category) values (o, 'Høytrykksspyler', 'HAGE') returning id into it;
  perform as_user(s);
  rq := request_lend(it, current_date, current_date, null);
  perform as_user(o);
  rq := respond_lend(rq.id, 'ACCEPTED', 'Står i boden');
  perform as_user(s);
  rq := respond_lend(rq.id, 'CANCELLED');
  perform as_admin();
  assert (select count(*) from notifications where profile_id = o and title like '% avlyste lånet' and body like '«Høytrykksspyler»%') = 1, 'NF9: the owner is told the loan is off';
  select count(*) into before from notifications where profile_id = s and title like 'Husk å levere%';
  update lend_requests set status = 'ACCEPTED' where id = rq.id;
  perform send_feature_reminders();
  if extract(hour from now() at time zone 'Europe/Oslo') >= 9 then
    assert (select count(*) from notifications where profile_id = s and title = 'Husk å levere Høytrykksspyler tilbake') = before + 1, 'NF10: the return day';
  end if;
  delete from lend_items where id = it;
  delete from noticeboard_posts where id = e;
end $$;

-- ---------- 30. «Lån ut» on Oppslagstavla and Utlån are one thing (0107) ----------
do $$
declare
  o uuid := '00000000-0000-4000-8000-0000000000a1'; h uuid := '00000000-0000-4000-8000-0000000000a2';
  s uuid := '00000000-0000-4000-8000-0000000000a4'; y uuid := '00000000-0000-4000-8000-0000000000b1';
  it uuid; nt uuid; n1 uuid; rq lend_requests; b tool_bookings; k int;
  i lend_items; nb noticeboard_posts;
begin
  delete from notifications where kind = 'NABOLAG_POST'::text::notification_kind; -- room under the 3-a-day cap
  update noticeboard_posts set created_at = created_at - interval '2 days' where author_id = o; -- earlier sections used up today's 5

  -- a thing added on Utlån is on the board too
  perform as_user(o);
  insert into lend_items (owner_id, title, category, note) values (o, 'Tilhengerkobling', 'TRANSPORT', 'Passer de fleste biler') returning id into it;
  perform as_admin();
  select * into i from lend_items where id = it;
  select * into nb from noticeboard_posts where id = i.notice_id;
  assert nb.id is not null and nb.kind::text = 'TOOL_LEND' and nb.title = 'Tilhengerkobling' and nb.body = 'Passer de fleste biler', 'LM1: an Utlån thing gets its «Lån ut» oppslag';
  assert nb.author_id = o and nb.municipality = 'Lillehammer' and nb.neighbourhood_id is null, 'LM2: by the owner, for the whole kommune';
  assert exists (select 1 from notifications where route = '/oppslagstavle?oppslag=' || nb.id and kind = 'NABOLAG_POST'::text::notification_kind), 'LM3: neighbours hear about it like any oppslag';

  -- edits, hiding and showing again follow to the board
  perform as_user(o);
  update lend_items set title = 'Tilhengerfeste', note = null, active = false where id = it;
  perform as_admin();
  select * into nb from noticeboard_posts where id = i.notice_id;
  assert nb.title = 'Tilhengerfeste' and nb.body = '' and nb.done_at is not null, 'LM4: an edit and «skjult» show on the board as «Avsluttet»';
  perform as_user(o);
  update lend_items set active = true where id = it;
  perform as_admin();
  assert (select done_at from noticeboard_posts where id = i.notice_id) is null, 'LM5: visible again = open again';
  delete from lend_items where id = it;

  -- a «Lån ut» oppslag is on Utlån too
  perform as_user(o);
  insert into noticeboard_posts (author_id, kind, title, body, municipality, image_paths)
    values (o, 'TOOL_LEND', 'Låner ut snøfreser', 'Honda, går fint', 'Lillehammer', array[o::text || '/fres.jpg']) returning id into nt;
  perform as_admin();
  select * into i from lend_items where notice_id = nt;
  assert i.id is not null and i.owner_id = o and i.title = 'Låner ut snøfreser' and i.note = 'Honda, går fint' and i.active
     and i.image_path = o::text || '/fres.jpg', 'LM6: a «Lån ut» oppslag becomes an Utlån thing, with its photo';

  -- edits on the board follow to Utlån, and «Avsluttet» hides it there
  perform as_user(o);
  update noticeboard_posts set title = 'Låner ut snøfreser (Honda)', done_at = now() where id = nt;
  perform as_admin();
  select * into i from lend_items where notice_id = nt;
  assert i.title = 'Låner ut snøfreser (Honda)' and not i.active, 'LM7: a board edit and «Avsluttet» follow to Utlån';
  perform as_user(o);
  update noticeboard_posts set done_at = null where id = nt;
  perform as_admin();

  -- borrowing works the same from both: the old board functions ask through Utlån
  perform as_user(h);
  b := request_tool_booking(nt, current_date + 1, current_date + 2, 'Til oppkjørselen');
  perform as_admin();
  select * into rq from lend_requests where id = b.id;
  assert rq.item_id = i.id and rq.status = 'PENDING' and rq.borrower_id = h, 'LM8: a loan asked on the board is an Utlån request';
  perform as_user(o);
  perform respond_lend(rq.id, 'ACCEPTED', 'Står i garasjen');
  select count(*) into k from tool_bookings where notice_id = nt and status = 'APPROVED';
  perform as_admin();
  assert k = 1, 'LM9: an older app sees it as approved on the board';
  perform as_user(s);
  k := (select count(*) from tool_booked_days(nt)) * 10 + (select count(*) from lend_busy_days(i.id));
  perform as_admin();
  assert k = 11, 'LM10: a stranger sees the same taken days in both';

  -- the 5-oppslag-a-day limit does not stop lending out a sixth thing
  perform as_user(o);
  for k in 1..6 loop
    insert into lend_items (owner_id, title) values (o, 'Ting nr ' || k);
  end loop;
  perform as_admin();
  assert (select count(*) from noticeboard_posts where author_id = o and title like 'Ting nr %') = 6, 'LM11: six things, six oppslag';
  perform as_user(o);
  delete from lend_items where owner_id = o and title like 'Ting nr %';
  perform as_admin();
  assert (select count(*) from noticeboard_posts where author_id = o and title like 'Ting nr %') = 0, 'LM12: deleting on Utlån deletes the oppslag';

  -- deleting the oppslag deletes the thing, and its requests
  perform as_user(o);
  delete from noticeboard_posts where id = nt;
  perform as_admin();
  assert not exists (select 1 from lend_items where id = i.id) and not exists (select 1 from lend_requests where id = rq.id), 'LM13: deleting on the board deletes the thing';

  -- changed to another kind: it leaves Utlån
  perform as_user(o);
  insert into noticeboard_posts (author_id, kind, title, body, municipality) values (o, 'TOOL_LEND', 'Låner ut stige', 'Tre meter', 'Lillehammer') returning id into nt;
  select id into it from lend_items where notice_id = nt;
  update noticeboard_posts set kind = 'GENERAL' where id = nt;
  perform as_admin();
  assert (select not active and notice_id is null from lend_items where id = it), 'LM14: no longer «Lån ut» = no longer on Utlån';
  delete from lend_items where id = it;
  delete from noticeboard_posts where id = nt;

  -- a youth lends out, and it is on the board too
  perform as_user(y);
  insert into lend_items (owner_id, title, category) values (y, 'Fotballmål', 'FRITID') returning id into it;
  perform as_admin();
  assert exists (select 1 from noticeboard_posts n join lend_items l on l.notice_id = n.id where l.id = it and n.author_id = y), 'LM15: a youth can lend out, and it shows on the board';
  delete from lend_items where id = it;

  -- for one nabolag: only its members see it, on both
  select id into n1 from neighbourhoods where municipality = 'Lillehammer' and place = 'Sentrum';
  delete from neighbourhood_members where neighbourhood_id = n1 and profile_id = s;
  insert into neighbourhood_members (neighbourhood_id, profile_id) values (n1, o) on conflict do nothing;
  perform as_user(o);
  insert into lend_items (owner_id, title, neighbourhood_id) values (o, 'Partytelt', n1) returning id into it;
  perform as_admin();
  select * into i from lend_items where id = it;
  assert (select neighbourhood_id from noticeboard_posts where id = i.notice_id) = n1, 'LM16: the oppslag is for the same nabolag';
  perform as_user(s);
  select count(*) into k from lend_items where id = it;
  perform as_admin();
  assert k = 0, 'LM17: someone outside the nabolag does not see it on Utlån';
  perform as_user(s);
  begin
    insert into lend_items (owner_id, title, neighbourhood_id) values (s, 'Gressklipper', n1);
    assert false, 'LM18: not for a nabolag I am not in';
  exception when insufficient_privilege then null;
  end;
  perform as_admin();
  delete from lend_items where id = it;
end $$;

-- ---------- 31. Fellesskap and the open items (0108) ----------
do $$
declare
  o uuid := '00000000-0000-4000-8000-0000000000a1'; h uuid := '00000000-0000-4000-8000-0000000000a2';
  h2 uuid := '00000000-0000-4000-8000-0000000000a3'; s uuid := '00000000-0000-4000-8000-0000000000a4';
  y uuid := '00000000-0000-4000-8000-0000000000b1';
  l uuid; nt uuid; n1 uuid; org uuid; it uuid; k int; j json;
begin
  delete from notifications where kind = 'NABOLAG_POST'::text::notification_kind;
  update noticeboard_posts set created_at = created_at - interval '2 days' where author_id in (o, h, s, y);
  update profiles set municipality = 'Lillehammer', deleted_at = null where id in (o, h, h2, s, y);

  -- A. shared street: a neighbour joins, the owner hears it and sees the note, a youth may not
  -- finished jobs from earlier sections owe reviews (0072): set them aside while the oppdrag is made
  create temp table cc_keep on commit drop as select * from completion_confirmations;
  delete from completion_confirmations;
  l := make_listing('Måke innkjørselen', 'snomaking');
  insert into completion_confirmations select * from cc_keep;
  update listings set shared_street = true where id = l;
  perform as_user(h);
  k := join_shared_listing(l, true, 'Nr. 14, samme vei');
  perform as_admin();
  assert k = 1 and exists (select 1 from notifications where profile_id = o and route = '/oppdrag/' || l), 'FS1: a neighbour joins, the owner hears it';
  perform as_user(o);
  j := shared_listing_joiners(l);
  perform as_admin();
  assert (j->>'count')::int = 1 and j->'people'->0->>'note' = 'Nr. 14, samme vei', 'FS2: the owner sees who and their note';
  perform as_user(s);
  j := shared_listing_joiners(l);
  perform as_admin();
  assert json_array_length(j->'people') = 0 and (j->>'count')::int = 1, 'FS3: others only see the count';
  perform as_user(y);
  begin
    perform join_shared_listing(l, true, '');
    assert false, 'FS4: a youth cannot join';
  exception when insufficient_privilege then null;
  end;
  perform as_admin();

  -- 1. topics: savnet dyr reaches everyone in the kommune, overskuddsmat closes itself, youth no samkjøring
  update profiles set municipality = 'Lillehammer' where id in (o, h, h2, s);
  perform as_user(o);
  insert into noticeboard_posts (author_id, kind, title, body, municipality, topic) values (o, 'GENERAL', 'Katten Pus', 'Grå katt', 'Lillehammer', 'PET') returning id into nt;
  perform as_admin();
  assert (select count(*) from notifications where route = '/oppslagstavle?oppslag=' || nt) >= 3, 'FS7: savnet dyr goes to the whole kommune';
  perform as_user(o);
  insert into noticeboard_posts (author_id, kind, title, body, municipality, topic) values (o, 'GIVEAWAY', 'Boller', 'Ferske', 'Lillehammer', 'FOOD') returning id into nt;
  perform as_admin();
  assert (select kind::text = 'GENERAL' and expires_at between now() + interval '23 hours' and now() + interval '25 hours' from noticeboard_posts where id = nt),
    'FS8: overskuddsmat is a GENERAL oppslag that runs out after 24 hours';
  update noticeboard_posts set expires_at = now() - interval '1 minute' where id = nt;
  perform close_expired_notices();
  assert (select done_at is not null from noticeboard_posts where id = nt), 'FS9: and then it closes';
  perform as_user(y);
  begin
    insert into noticeboard_posts (author_id, kind, title, body, municipality, topic) values (y, 'GENERAL', 'Skyss til Hamar', '', 'Lillehammer', 'RIDE');
    assert false, 'FS10: no samkjøring for youth';
  exception when insufficient_privilege then null;
  end;
  perform as_admin();

  -- «Ønsker å låne» reaches the owner of a matching thing
  insert into lend_items (owner_id, title, municipality) values (h, 'Høytrykksspyler Kärcher', 'Lillehammer') returning id into it;
  delete from notifications where profile_id = h;
  perform as_user(s);
  insert into noticeboard_posts (author_id, kind, title, body, municipality, topic) values (s, 'GENERAL', 'Noen som har høytrykksspyler?', '', 'Lillehammer', 'WANT_BORROW') returning id into nt;
  perform as_admin();
  assert exists (select 1 from notifications where profile_id = h and route = '/oppslagstavle?oppslag=' || nt), 'FS11: the owner of a matching thing hears it';
  delete from lend_items where id = it;

  -- an author cannot pin, a vert can
  select id into n1 from neighbourhoods where municipality = 'Lillehammer' and place = 'Sentrum';
  insert into neighbourhood_members (neighbourhood_id, profile_id) values (n1, o), (n1, h) on conflict do nothing;
  perform as_user(o);
  insert into noticeboard_posts (author_id, kind, title, body, municipality, neighbourhood_id, pinned_at) values (o, 'GENERAL', 'Husk dugnad', '', 'Lillehammer', n1, now()) returning id into nt;
  perform as_admin();
  assert (select pinned_at is null from noticeboard_posts where id = nt), 'FS12: an author cannot pin their own oppslag';
  perform as_user(h);
  begin
    perform pin_notice(nt, true);
    assert false, 'FS13: only verter pin';
  exception when insufficient_privilege then null;
  end;
  perform as_admin();
  insert into neighbourhood_hosts (neighbourhood_id, profile_id) values (n1, h);
  perform as_user(h);
  perform pin_notice(nt, true);
  perform set_nabolag_rules(n1, 'Hold det vennlig.');
  perform as_admin();
  assert (select pinned_at is not null from noticeboard_posts where id = nt) and (select rules from neighbourhoods where id = n1) = 'Hold det vennlig.', 'FS14: a vert pins and writes the rules';

  -- «Nye naboer» only shows people who said yes
  perform as_user(o);
  perform set_nabolag_intro(n1, 'Ola, flyttet hit i høst', true);
  perform as_admin();
  perform as_user(h);
  j := nabolag_details(n1);
  perform as_admin();
  assert json_array_length(j->'newMembers') = 1 and j->'newMembers'->0->>'intro' = 'Ola, flyttet hit i høst', 'FS15: a new neighbour who said yes is shown';
  perform as_user(s);
  j := nabolag_details(n1);
  perform as_admin();
  assert json_array_length(j->'newMembers') = 0, 'FS16: not to people outside the nabolag';

  -- organisations: only its admins post as it, votes are one per person
  insert into organisations (municipality, name, kind, verified) values ('Lillehammer', 'Lillehammer IL', 'IDRETT', true) returning id into org;
  perform as_user(s);
  begin
    insert into noticeboard_posts (author_id, kind, title, body, municipality, organisation_id, event_type, event_at)
      values (s, 'GENERAL', 'Cup', '', 'Lillehammer', org, 'ANNET', now() + interval '3 days');
    assert false, 'FS17: not for an organisation I do not run';
  exception when insufficient_privilege then null;
  end;
  perform vote_support(org);
  perform vote_support(org);
  perform as_admin();
  assert (select count(*) from support_votes where organisation_id = org) = 1, 'FS18: one vote per person';

  -- arrangementer: a thing to bring has one taker, slots are the organiser's, photos only after the start
  perform as_user(o);
  insert into noticeboard_posts (author_id, kind, title, body, municipality, event_type, event_at) values (o, 'GENERAL', 'Grillfest', '', 'Lillehammer', 'FEST', now() + interval '2 days') returning id into nt;
  it := add_event_item(nt, 'Grill');
  perform as_admin();
  perform as_user(h);
  perform take_event_item(it, true);
  perform as_admin();
  perform as_user(s);
  begin
    perform take_event_item(it, true);
    assert false, 'FS19: a thing to bring has one taker';
  exception when raise_exception then null;
  end;
  begin
    perform add_event_item(nt, 'Rigging', 3);
    assert false, 'FS20: only the organiser adds slots';
  exception when insufficient_privilege then null;
  end;
  begin
    perform add_event_photo(nt, 'x.jpg');
    assert false, 'FS21: no photos before it starts';
  exception when raise_exception then null;
  end;
  perform as_admin();

  -- a weekly arrangement moves on
  update noticeboard_posts set repeat_weekly = true, event_at = now() - interval '3 hours' where id = nt;
  perform close_expired_notices();
  assert (select event_at > now() and event_at < now() + interval '7 days' from noticeboard_posts where id = nt), 'FS25: a weekly arrangement moves to next week';

  -- «Jeg kan hjelpe i dag»: counted for the kommune, never youth
  perform as_user(h);
  perform set_available_today(true);
  perform as_admin();
  update profiles set municipality = 'Lillehammer' where id = y;
  perform as_user(y);
  perform set_available_today(true);
  j := helpers_available_today('Lillehammer');
  perform as_admin();
  assert (j->>'count')::int = 1, 'FS26: one adult helper free today, youth not counted';

  -- vennetjeneste is for adults
  perform as_user(y);
  begin
    perform buddy_signup('VENNETJENESTE', 'GIVES', '');
    assert false, 'FS27: vennetjeneste is for adults';
  exception when insufficient_privilege then null;
  end;
  perform buddy_signup('SPRAKVENN', 'GIVES', 'Snakker gjerne norsk');
  perform as_admin();
end $$;

-- ---------- 31b. «Si hei» to a new neighbour (0108) ----------
do $$
declare
  o uuid := '00000000-0000-4000-8000-0000000000a1'; h uuid := '00000000-0000-4000-8000-0000000000a2';
  s uuid := '00000000-0000-4000-8000-0000000000a4'; n1 uuid; k int;
begin
  select id into n1 from neighbourhoods where municipality = 'Lillehammer' and place = 'Sentrum';
  insert into neighbourhood_members (neighbourhood_id, profile_id) values (n1, o), (n1, h), (n1, s) on conflict do nothing;
  update neighbourhood_members set show_as_new = false where neighbourhood_id = n1 and profile_id = s;
  update neighbourhood_members set show_as_new = true where neighbourhood_id = n1 and profile_id = o;
  delete from notifications where profile_id = o;
  perform as_user(h);
  perform wave_neighbour(n1, o);
  perform wave_neighbour(n1, o);
  begin
    perform wave_neighbour(n1, s);
    assert false, 'FS29: not to someone who did not want to be shown as new';
  exception when raise_exception then null;
  end;
  perform as_admin();
  select count(*) into k from notifications where profile_id = o and title like '%sier hei%';
  assert k = 1, 'FS28: a wave reaches the new neighbour once';
end $$;

-- ---------- 32. Innboks (0109) ----------
do $$
declare
  o uuid := '00000000-0000-4000-8000-0000000000a1'; h uuid := '00000000-0000-4000-8000-0000000000a2';
  s uuid := '00000000-0000-4000-8000-0000000000a4';
  l uuid; conv uuid; m uuid; k int; j json; t text;
begin
  update profiles set deleted_at = null, municipality = 'Lillehammer' where id in (o, h, s);
  create temp table cc_keep2 on commit drop as select * from completion_confirmations;
  delete from completion_confirmations;
  l := make_listing('Bære en sofa', 'flytting');
  insert into completion_confirmations select * from cc_keep2;
  perform as_user(h);
  select (start_conversation_for_listing(l)).id into conv;
  insert into messages (conversation_id, author_id, kind, text) values (conv, h, 'TEXT', 'Hei! Når passer det?') returning id into m;
  perform as_admin();

  -- edit for 15 minutes, only my own
  perform as_user(o);
  begin
    perform edit_message(m, 'Endret av feil person');
    assert false, 'IB1: not someone else''s message';
  exception when raise_exception then null;
  end;
  perform as_user(h);
  perform edit_message(m, 'Hei! Når passer det for deg?');
  perform as_admin();
  assert (select text = 'Hei! Når passer det for deg?' and edited_at is not null from messages where id = m), 'IB2: edited and marked';
  update messages set created_at = now() - interval '20 minutes' where id = m;
  perform as_user(h);
  begin
    perform edit_message(m, 'For sent');
    assert false, 'IB3: not after 15 minutes';
  exception when raise_exception then null;
  end;
  perform as_admin();

  -- snooze ends when the other person writes
  perform as_user(o);
  perform set_conversation_flags(conv, true, now() + interval '1 day');
  perform as_admin();
  assert (select pinned_at is not null and snoozed_until is not null from conversation_participants where conversation_id = conv and profile_id = o), 'IB4: pinned and snoozed';
  insert into messages (conversation_id, author_id, kind, text) values (conv, h, 'TEXT', 'Er du der?');
  assert (select snoozed_until is null from conversation_participants where conversation_id = conv and profile_id = o), 'IB5: a new message ends the snooze';

  -- a scheduled message goes out when due, as its author
  perform as_user(o);
  perform schedule_message(conv, 'God morgen! Kommer kl 10.', now() + interval '2 minutes');
  perform as_admin();
  update scheduled_messages set send_at = now() - interval '1 second' where author_id = o and sent_at is null;
  k := send_scheduled_messages();
  assert k = 1 and exists (select 1 from messages where conversation_id = conv and author_id = o and text = 'God morgen! Kommer kl 10.'), 'IB6: sent when due';

  -- away: one automatic reply per conversation
  perform as_user(o);
  perform set_chat_settings(current_date + 5, 'Er på hytta', false);
  perform as_admin();
  insert into messages (conversation_id, author_id, kind, text) values (conv, h, 'TEXT', 'Hallo?');
  insert into messages (conversation_id, author_id, kind, text) values (conv, h, 'TEXT', 'Hallo igjen?');
  select count(*) into k from messages where conversation_id = conv and author_id = o and text like '🌴 Er på hytta%';
  assert k = 1, 'IB7: one automatic reply';
  -- my «Tilbyr hjelp» rests while I'm away, and opens again when I'm back
  update listings set type = 'SERVICE_OFFER', status = 'ACTIVE' where id = l;
  perform as_user(o);
  perform set_chat_settings(current_date + 5, 'Er på hytta', false);
  perform as_admin();
  assert (select status::text = 'PAUSED' from listings where id = l), 'IB13: an offer rests while I am away';
  perform as_user(o);
  perform set_chat_settings(null, null, true);
  perform as_admin();
  assert (select status::text = 'ACTIVE' from listings where id = l), 'IB14: and opens again when I am back';
  update listings set type = 'TASK_REQUEST', status = 'PUBLISHED' where id = l;

  -- read receipts off: the other person no longer sees how far I read
  perform as_user(o);
  perform set_chat_settings(null, null, false, false);
  perform as_admin();
  update conversation_participants set last_read_at = now() - interval '1 hour' where conversation_id = conv and profile_id = o;
  t := (select last_read_at::text from conversation_participants where conversation_id = conv and profile_id = o);
  update conversation_participants set last_read_at = now() where conversation_id = conv and profile_id = o;
  assert (select last_read_at::text from conversation_participants where conversation_id = conv and profile_id = o) = t, 'IB8: receipts off freezes what the other sees';
  perform as_user(o);
  perform set_chat_settings(null, null, false, true);
  perform as_admin();

  -- search finds my conversations only
  perform as_user(o);
  j := search_my_messages('hytta');
  perform as_admin();
  assert json_array_length(j) >= 1, 'IB9: search finds a word';
  perform as_user(s);
  j := search_my_messages('hytta');
  perform as_admin();
  assert json_array_length(j) = 0, 'IB10: never someone else''s conversations';

  -- the address only with an avtale
  perform as_user(o);
  begin
    perform share_address(conv, 'Storgata 1');
    assert false, 'IB11: no address before an avtale';
  exception when raise_exception then null;
  end;
  perform as_admin();

  -- a PDF must be a PDF
  perform as_user(h);
  begin
    insert into messages (conversation_id, author_id, kind, text, attachment_path, attachment_kind, file_name)
      values (conv, h, 'TEXT', '📄 virus.exe', h::text || '/x.exe', 'FILE', 'virus.exe');
    assert false, 'IB12: only PDF files';
  exception when raise_exception then null;
  end;
  perform as_admin();
end $$;

-- ---------- 33. Oppdrag (0110) ----------
do $$
declare
  o uuid := '00000000-0000-4000-8000-0000000000a1'; h uuid := '00000000-0000-4000-8000-0000000000a2';
  s uuid := '00000000-0000-4000-8000-0000000000a4';
  l uuid; j json; k int;
begin
  update profiles set deleted_at = null, municipality = 'Lillehammer', category_slugs = '{}', available_for_jobs = true, paused = false, suspended_at = null where id in (o, h, s);
  create temp table cc_keep3 on commit drop as select * from completion_confirmations;
  delete from completion_confirmations;
  l := make_listing('Rydde boden', 'bortkjoring');
  insert into completion_confirmations select * from cc_keep3;

  -- a new oppdrag has no tilbud
  perform as_user(s);
  j := listing_offer_counts(array[l]);
  perform as_admin();
  assert (j->>l::text)::int = 0, 'OP1: a new oppdrag has 0 tilbud';

  -- search words: plain words only, and a word needs 3 searches before it is suggested
  perform as_user(s);
  perform log_search_term('Lillehammer', 'snømåking');
  perform log_search_term('Lillehammer', 'snømåking');
  perform log_search_term('Lillehammer', 'Storgata 12');
  perform log_search_term('Lillehammer', 'kari@test.no');
  j := popular_search_terms('Lillehammer');
  perform as_admin();
  assert json_array_length(j) = 0, 'OP2: two searches are not enough';
  assert not exists (select 1 from search_terms where term like '%12%' or term like '%@%'), 'OP3: no numbers or e-mail in the log';
  perform as_user(h);
  perform log_search_term('Lillehammer', 'Snømåking');
  j := popular_search_terms('Lillehammer');
  perform as_admin();
  assert j->>0 = 'snømåking', 'OP4: suggested after 3 searches';

  -- daily mode: no push per oppdrag, one count a day
  insert into profile_settings (profile_id, notification_prefs) values (h, '{"matchDaily": true}')
    on conflict (profile_id) do update set notification_prefs = profile_settings.notification_prefs || '{"matchDaily": true}';
  delete from notifications where profile_id = h;
  create temp table cc_keep4 on commit drop as select * from completion_confirmations;
  delete from completion_confirmations;
  l := make_listing('Bære ved', 'ved');
  insert into completion_confirmations select * from cc_keep4;
  assert not exists (select 1 from notifications where profile_id = h and route = '/oppdrag/' || l and title like 'Nytt oppdrag i %'), 'OP5: no push per oppdrag in daily mode';
  assert (select listing_publicly_visible(x) from listings x where x.id = l), 'OP5b: the new oppdrag is visible';
  assert (select coalesce(available_for_jobs, true) and not coalesce(paused, false) and suspended_at is null from profiles where id = h), 'OP5c: the helper can get jobs';
  k := send_daily_match_digest();
  assert exists (select 1 from notifications where profile_id = h and title like '%nye oppdrag i Lillehammer i dag' or profile_id = h and title like '1 nytt oppdrag%'), 'OP6: one count a day';
  update profile_settings set notification_prefs = notification_prefs - 'matchDaily' where profile_id = h;
end $$;

-- ---------- 33b. 0110: deleting for 15 minutes; an answer varsel opens the answers ----------
do $$
declare v uuid; c1 uuid; m1 uuid; n uuid;
begin
  update profiles set deleted_at = null, paused = false, suspended_at = null
   where id in ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2');
  create temp table cc_keep5 on commit drop as select * from completion_confirmations;
  delete from completion_confirmations;
  v := make_listing('Slette etter tolv minutter', 'hage');
  insert into completion_confirmations select * from cc_keep5;
  perform as_user('00000000-0000-4000-8000-0000000000a2');
  select (start_conversation_for_listing(v)).id into c1;
  insert into messages (conversation_id, author_id, kind, text) values (c1, auth.uid(), 'TEXT', 'Oi, feil') returning id into m1;
  perform as_admin();
  update messages set created_at = now() - interval '12 minutes' where id = m1;
  perform as_user('00000000-0000-4000-8000-0000000000a2');
  perform delete_my_message(m1);
  perform as_admin();
  assert (select deleted_at from messages where id = m1) is not null, 'DM1: deleted after 12 minutes';

  insert into noticeboard_posts (author_id, kind, title, body, municipality)
    values ('00000000-0000-4000-8000-0000000000a1', 'GENERAL', 'Hvem har en stige?', 'Trenger en i morgen', 'Lillehammer')
    returning id into n;
  delete from notifications where profile_id = '00000000-0000-4000-8000-0000000000a1';
  perform as_user('00000000-0000-4000-8000-0000000000a2');
  insert into notice_comments (notice_id, author_id, body) values (n, auth.uid(), 'Jeg har en');
  perform as_admin();
  assert exists (select 1 from notifications where profile_id = '00000000-0000-4000-8000-0000000000a1'
                  and route = '/oppslagstavle?oppslag=' || n || '&svar=1'), 'NR1: the answer varsel opens the answers';
end $$;

\echo ALL CHECKS PASSED
