-- 0094_youth_community_and_review_approval.sql
--  Asked 2026-11-07:
--    * Youth accounts can offer help in every category, not only four.
--    * Youth accounts can use Oppslagstavla (post, comment, dugnad, tool loans), save searches and
--      review others. Starting a private chat from an oppslag stays closed (0065).
--    * Every review a youth gives or gets must be approved by a moderator before anyone sees it or
--      it counts: reviews.approval, decided on the website through moderation_decide_review.
--      Reviews between two adults are approved at once, as before.
--    * «Spørsmål fra naboer» belongs on «Tilbyr hjelp» only.
--    * Likes on oppslag.

-- ---------------------------------------------------------------------------
-- 1. Youth rights
-- ---------------------------------------------------------------------------
create or replace function youth_offer_category(p_slug text) returns boolean
language sql immutable as $$
  select true;
$$;

drop trigger if exists noticeboard_posts_block_youth on noticeboard_posts;
drop trigger if exists notice_comments_block_youth on notice_comments;
drop trigger if exists reviews_block_youth on reviews;
drop trigger if exists saved_searches_block_youth on saved_searches;

create or replace function set_dugnad_signup(p_notice_id uuid, p_join boolean) returns int
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); n noticeboard_posts; v_name text; v_count int;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  select * into n from noticeboard_posts where id = p_notice_id and hidden_at is null;
  if not found or not n.is_dugnad then raise exception 'Fant ikke dugnaden.'; end if;
  if n.neighbourhood_id is not null and not is_nabolag_member(n.neighbourhood_id) then
    raise exception 'Ikke tilgang.' using errcode = '42501';
  end if;

  if p_join then
    if n.done_at is not null or (n.event_at is not null and n.event_at < now()) then
      raise exception 'Dugnaden er over.';
    end if;
    insert into notice_signups (notice_id, profile_id) values (p_notice_id, v_me) on conflict do nothing;
    if found and n.author_id <> v_me then
      v_name := first_name(v_me);
      insert into notifications (profile_id, kind, title, body, route)
        values (n.author_id, 'NOTICE_REPLY'::text::notification_kind, coalesce(v_name, 'En nabo') || ' blir med på dugnaden',
                '«' || n.title || '»', '/oppslagstavle?oppslag=' || n.id);
    end if;
  else
    delete from notice_signups where notice_id = p_notice_id and profile_id = v_me;
  end if;
  select count(*)::int into v_count from notice_signups where notice_id = p_notice_id;
  return v_count;
end $$;

create or replace function request_tool_booking(p_notice_id uuid, p_from date, p_to date, p_note text) returns tool_bookings
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); n noticeboard_posts; v_name text; b tool_bookings; v_open int;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  select * into n from noticeboard_posts where id = p_notice_id and hidden_at is null;
  if not found or n.kind::text <> 'TOOL_LEND' then raise exception 'Fant ikke oppslaget.'; end if;
  if n.done_at is not null then raise exception 'Oppslaget er avsluttet.'; end if;
  if n.author_id = v_me then raise exception 'Dette er ditt eget verktøy.'; end if;
  if p_from < current_date then raise exception 'Velg en dag fra i dag og framover.'; end if;
  if p_to < p_from then raise exception 'Siste dag kan ikke være før første dag.'; end if;
  if p_to > p_from + 30 then raise exception 'Du kan låne i maks 30 dager om gangen.'; end if;
  if exists (select 1 from blocks x where (x.by_profile_id = n.author_id and x.blocked_profile_id = v_me)
                                       or (x.by_profile_id = v_me and x.blocked_profile_id = n.author_id)) then
    raise exception 'Du kan ikke låne her.' using errcode = '42501';
  end if;
  if exists (select 1 from tool_bookings t where t.notice_id = p_notice_id and t.status = 'APPROVED'
              and t.from_date <= p_to and t.to_date >= p_from) then
    raise exception 'Noen av dagene er allerede tatt.';
  end if;
  select count(*) into v_open from tool_bookings t
   where t.notice_id = p_notice_id and t.borrower_id = v_me and t.status = 'PENDING';
  if v_open > 0 then raise exception 'Du har allerede en forespørsel som venter på svar.'; end if;

  insert into tool_bookings (notice_id, borrower_id, from_date, to_date, note)
    values (p_notice_id, v_me, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''))
    returning * into b;
  v_name := first_name(v_me);
  insert into notifications (profile_id, kind, title, body, route)
    values (n.author_id, 'NOTICE_REPLY'::text::notification_kind, coalesce(v_name, 'En nabo') || ' vil låne',
            '«' || n.title || '» · ' || to_char(p_from, 'DD.MM') || '–' || to_char(p_to, 'DD.MM'),
            '/oppslagstavle?oppslag=' || n.id);
  return b;
end $$;

create or replace function confirm_completion(p_agreement_proposal_id uuid)
returns setof completion_confirmations language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_both int; v_party uuid; v_new int;
begin
  select * into p from proposals where id = p_agreement_proposal_id;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Ikke tilgang.'; end if;

  insert into completion_confirmations (agreement_proposal_id, by_profile_id)
    values (p_agreement_proposal_id, v_me)
  on conflict do nothing;
  get diagnostics v_new = row_count;

  -- confirming twice changes nothing and sends nothing again
  if v_new = 0 then
    return query select * from completion_confirmations
      where agreement_proposal_id = p_agreement_proposal_id;
    return;
  end if;

  select count(*) into v_both from completion_confirmations
   where agreement_proposal_id = p_agreement_proposal_id;
  if v_both >= 2 then
    update listings set status = 'COMPLETED' where id = p.listing_id;
    foreach v_party in array array[p.from_profile_id, p.to_profile_id] loop
      if is_youth(v_party) then
        -- a youth may review too (0094), but is never required to
        perform notify(v_party,'REVIEW_RECEIVED','Oppdrag fullført',
          'Bra jobbet! Du kan gi en vurdering hvis du vil.','/vurder/' || p_agreement_proposal_id);
      else
        perform notify(v_party,'REVIEW_RECEIVED','Oppdrag fullført – gi en vurdering',
          'Velg antall stjerner for å fullføre. Du må gi vurderingen før du kan legge ut eller gi tilbud igjen.','/vurder/'||p.id);
      end if;
    end loop;
  else
    perform notify(case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end,
      'COMPLETION_REQUESTED','Bekreft fullføring',
      'Den andre parten markerte oppdraget som fullført.','/fullfor/'||p.id);
  end if;

  return query select * from completion_confirmations
    where agreement_proposal_id = p_agreement_proposal_id;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Reviews involving a youth wait for a moderator
-- ---------------------------------------------------------------------------
alter table reviews add column if not exists approval text not null default 'APPROVED';
alter table reviews drop constraint if exists reviews_approval_values;
alter table reviews add constraint reviews_approval_values check (approval in ('PENDING','APPROVED','REJECTED'));
alter table reviews add column if not exists approval_decided_at timestamptz;
alter table reviews add column if not exists approval_reason text;
create index if not exists reviews_pending_idx on reviews (created_at) where approval = 'PENDING';

create or replace function reviews_need_approval() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.approval := case when is_youth(new.from_profile_id) or is_youth(new.to_profile_id) then 'PENDING' else 'APPROVED' end;
  return new;
end $$;
revoke all on function reviews_need_approval() from public, anon, authenticated;
drop trigger if exists t_reviews_need_approval on reviews;
create trigger t_reviews_need_approval before insert on reviews
  for each row execute function reviews_need_approval();

-- A client can never approve its own review.
create or replace function reviews_guard_approval() returns trigger
language plpgsql as $$
begin
  if new.approval is distinct from old.approval and auth.uid() is not null and not is_admin() then
    new.approval := old.approval;
  end if;
  return new;
end $$;
drop trigger if exists t_reviews_guard_approval on reviews;
create trigger t_reviews_guard_approval before update on reviews
  for each row execute function reviews_guard_approval();

-- The person hears about a review when it can be seen, not while it waits.
create or replace function review_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.approval <> 'APPROVED' then return new; end if;
  insert into notifications (profile_id, kind, title, body, route)
    values (new.to_profile_id, 'REVIEW_RECEIVED', 'Ny vurdering',
            'Du har fått en vurdering. Den vises når dere begge har vurdert, eller når fristen går ut.',
            '/profil?fane=vurderinger');
  return new;
end $$;

create or replace view visible_reviews as
  select r.id, r.agreement_proposal_id, r.listing_id, r.from_profile_id, r.to_profile_id,
         r.rating, r.comment, r.created_at, r.tags, r.reply, r.replied_at, r.recommends
    from reviews r
   where r.approval = 'APPROVED'
     and (now() - r.created_at > interval '10 days'
          or exists (select 1 from reviews x
                      where x.agreement_proposal_id = r.agreement_proposal_id
                        and x.from_profile_id = r.to_profile_id));
revoke all on visible_reviews from anon, public;
grant select on visible_reviews to authenticated;

-- For the website's moderators (service role). A rejected review is kept, but never shown.
create or replace function moderation_decide_review(p_id uuid, p_approved boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r reviews;
begin
  select * into r from reviews where id = p_id for update;
  if not found then raise exception 'Fant ikke vurderingen.'; end if;
  if r.approval <> 'PENDING' then raise exception 'Vurderingen er allerede behandlet.'; end if;
  update reviews
     set approval = case when p_approved then 'APPROVED' else 'REJECTED' end,
         approval_decided_at = now(),
         approval_reason = case when p_approved then null else nullif(btrim(coalesce(p_reason, '')), '') end
   where id = p_id;
  if p_approved then
    perform notify(r.to_profile_id, 'REVIEW_RECEIVED', 'Ny vurdering',
      'Du har fått en vurdering. Den er sjekket av MinNabo.', '/profil?fane=vurderinger');
  end if;
  perform notify(r.from_profile_id, 'MODERATION',
    case when p_approved then 'Vurderingen din er godkjent' else 'Vurderingen din ble ikke godkjent' end,
    case when p_approved then 'Den er nå synlig på profilen.'
         else coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Den følger ikke reglene for vurderinger.') end,
    '/varsler');
end $$;
revoke all on function moderation_decide_review(uuid, boolean, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Questions: only on «Tilbyr hjelp»
-- ---------------------------------------------------------------------------
create or replace function ask_listing_question(p_listing_id uuid, p_body text) returns listing_questions
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); l listings; v_body text := btrim(coalesce(p_body, '')); v_recent int; v_row listing_questions;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  if is_youth(v_me) then raise exception 'Ungdomskontoer kan ikke stille spørsmål her.' using errcode = '42501'; end if;
  select * into l from listings where id = p_listing_id;
  if not found or not is_open_listing(p_listing_id) then
    raise exception 'Oppføringen tar ikke imot spørsmål nå.';
  end if;
  if l.type::text <> 'SERVICE_OFFER' then raise exception 'Spørsmål kan bare stilles på «Tilbyr hjelp».'; end if;
  if l.owner_id = v_me then raise exception 'Du kan ikke stille spørsmål på din egen oppføring.'; end if;
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
  perform notify(l.owner_id, 'NEW_MESSAGE', 'Nytt spørsmål til deg',
    '«' || l.title || '»: ' || left(v_body, 120), '/oppdrag/' || l.id || '?sporsmal=1');
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Likes on oppslag
-- ---------------------------------------------------------------------------
create table if not exists notice_likes (
  notice_id uuid not null references noticeboard_posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (notice_id, profile_id)
);
alter table notice_likes enable row level security;
drop policy if exists p_notice_likes_read on notice_likes;
-- the noticeboard's own policy decides who can see the oppslag
create policy p_notice_likes_read on notice_likes for select to authenticated
  using (exists (select 1 from noticeboard_posts n where n.id = notice_id));
drop policy if exists p_notice_likes_own on notice_likes;
create policy p_notice_likes_own on notice_likes for insert to authenticated
  with check (profile_id = auth.uid() and exists (select 1 from noticeboard_posts n where n.id = notice_id));
drop policy if exists p_notice_likes_del on notice_likes;
create policy p_notice_likes_del on notice_likes for delete to authenticated
  using (profile_id = auth.uid());

create or replace function profile_deleted_new_data() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_path text;
begin
  if new.deleted_at is null or old.deleted_at is not null then return new; end if;
  delete from listing_questions where author_id = new.id;
  delete from notice_signups where profile_id = new.id;
  delete from notice_likes where profile_id = new.id;
  delete from tool_bookings where borrower_id = new.id and status in ('PENDING','APPROVED');
  delete from thank_cards where from_profile_id = new.id or to_profile_id = new.id;
  select file_path into v_path from police_certificates where profile_id = new.id;
  if v_path is not null then perform queue_file_purge('police-certificates', v_path); end if;
  delete from police_certificates where profile_id = new.id;
  return new;
end $$;
