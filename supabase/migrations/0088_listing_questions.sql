-- 0088_listing_questions.sql
--  Asked 2026-11-06: «Spørsmål fra naboer» – public questions on an oppdrag or a «Tilbyr hjelp», so
--  the same thing isn't asked five times in separate chats. The owner answers once, everyone reads.
--  Youth accounts read but don't ask (rule 5). Same word filter as the rest of the app.

create table if not exists listing_questions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 3 and 300),
  answer text check (answer is null or char_length(btrim(answer)) between 1 and 500),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists listing_questions_listing_idx on listing_questions (listing_id, created_at);
alter table listing_questions enable row level security;

-- Whoever can see the post can read its questions: the listings policy runs inside the subquery.
drop policy if exists p_listing_questions_read on listing_questions;
create policy p_listing_questions_read on listing_questions for select to authenticated
  using (exists (select 1 from listings l where l.id = listing_id));

revoke insert, update, delete on listing_questions from anon, authenticated;

create or replace function ask_listing_question(p_listing_id uuid, p_body text) returns listing_questions
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); l listings; v_body text := btrim(coalesce(p_body, '')); v_recent int; v_row listing_questions;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  if is_youth(v_me) then raise exception 'Ungdomskontoer kan ikke stille spørsmål her.' using errcode = '42501'; end if;
  select * into l from listings where id = p_listing_id;
  if not found or not is_open_listing(p_listing_id) then
    raise exception 'Oppdraget tar ikke imot spørsmål nå.';
  end if;
  if l.owner_id = v_me then raise exception 'Du kan ikke stille spørsmål på ditt eget oppdrag.'; end if;
  if char_length(v_body) < 3 then raise exception 'Skriv litt mer.'; end if;
  if char_length(v_body) > 300 then raise exception 'Spørsmålet kan være på maks 300 tegn.'; end if;
  if has_banned_word(v_body) then raise exception 'Teksten inneholder ord som ikke er tillatt.'; end if;
  if exists (select 1 from blocks b where (b.by_profile_id = l.owner_id and b.blocked_profile_id = v_me)
                                       or (b.by_profile_id = v_me and b.blocked_profile_id = l.owner_id)) then
    raise exception 'Du kan ikke stille spørsmål her.' using errcode = '42501';
  end if;
  select count(*) into v_recent from listing_questions
   where author_id = v_me and created_at > now() - interval '1 hour';
  perform rate_check(v_recent, 8, 'spørsmål');

  insert into listing_questions (listing_id, author_id, body) values (p_listing_id, v_me, v_body)
    returning * into v_row;
  perform notify(l.owner_id, 'NEW_MESSAGE', 'Nytt spørsmål på oppdraget ditt',
    '«' || l.title || '»: ' || left(v_body, 120), '/oppdrag/' || l.id || '?sporsmal=1');
  return v_row;
end $$;
revoke all on function ask_listing_question(uuid, text) from public, anon;
grant execute on function ask_listing_question(uuid, text) to authenticated;

create or replace function answer_listing_question(p_id uuid, p_answer text) returns listing_questions
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); q listing_questions; l listings; v_answer text := btrim(coalesce(p_answer, ''));
begin
  select * into q from listing_questions where id = p_id for update;
  if not found then raise exception 'Fant ikke spørsmålet.'; end if;
  select * into l from listings where id = q.listing_id;
  if l.owner_id is distinct from v_me then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if char_length(v_answer) = 0 then raise exception 'Skriv et svar.'; end if;
  if char_length(v_answer) > 500 then raise exception 'Svaret kan være på maks 500 tegn.'; end if;
  if has_banned_word(v_answer) then raise exception 'Teksten inneholder ord som ikke er tillatt.'; end if;

  update listing_questions set answer = v_answer, answered_at = now() where id = p_id returning * into q;
  perform notify(q.author_id, 'NEW_MESSAGE', 'Spørsmålet ditt er besvart',
    '«' || l.title || '»: ' || left(v_answer, 120), '/oppdrag/' || l.id || '?sporsmal=1');
  return q;
end $$;
revoke all on function answer_listing_question(uuid, text) from public, anon;
grant execute on function answer_listing_question(uuid, text) to authenticated;

-- The author can take a question back; the owner can remove anything on their own post.
create or replace function delete_listing_question(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from listing_questions q
   where q.id = p_id
     and (q.author_id = auth.uid()
          or exists (select 1 from listings l where l.id = q.listing_id and l.owner_id = auth.uid()));
  if not found then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
end $$;
revoke all on function delete_listing_question(uuid) from public, anon;
grant execute on function delete_listing_question(uuid) to authenticated;
