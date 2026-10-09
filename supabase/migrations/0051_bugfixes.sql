-- 0051_bugfixes.sql – the bug round of 2026-10-06.
--  1. Blocking stops messages (and with them the push).
--  2. Comments on an oppslag can be reported and removed by an admin.
--  3. An oppdrag with an avtale can't be deleted / archived / paused by its owner,
--     and calling an avtale off never revives an oppdrag the owner had removed.
--  4. Clear reason when a tilbud can't be accepted because the oppdrag is paused or removed.
--  5. Accounts without an e-mail (the temporary test login, Vipps logins) are no
--     longer marked "e-post bekreftet".
--  6. "Levert" in chat is real: it is set when the other person's app has fetched the message.
--  7. The notification for a new comment opens that oppslag.

-- ---------------------------------------------------------------------------
-- 1. blocking
-- ---------------------------------------------------------------------------
create or replace function messages_respect_blocks() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind::text = 'SYSTEM' then return new; end if;
  if exists (
    select 1 from conversation_participants cp
      join blocks b on (b.by_profile_id = cp.profile_id and b.blocked_profile_id = new.author_id)
                    or (b.by_profile_id = new.author_id and b.blocked_profile_id = cp.profile_id)
     where cp.conversation_id = new.conversation_id and cp.profile_id <> new.author_id
  ) then
    raise exception 'Du kan ikke sende meldinger til denne personen.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists messages_respect_blocks on messages;
create trigger messages_respect_blocks before insert on messages
  for each row execute function messages_respect_blocks();

-- ---------------------------------------------------------------------------
-- 2. reports on comments
-- ---------------------------------------------------------------------------
alter type report_target add value if not exists 'COMMENT';

create or replace function report_target_owner(p_type report_target, p_id text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  case p_type::text
    when 'USER' then v := p_id::uuid;
    when 'LISTING' then select owner_id into v from listings where id::text = p_id;
    when 'MESSAGE' then select author_id into v from messages where id::text = p_id;
    when 'REVIEW' then select from_profile_id into v from reviews where id::text = p_id;
    when 'PROPOSAL' then select from_profile_id into v from proposals where id::text = p_id;
    when 'NOTICE' then select author_id into v from noticeboard_posts where id::text = p_id;
    when 'COMMENT' then select author_id into v from notice_comments where id::text = p_id;
    else v := null;
  end case;
  return v;
exception when invalid_text_representation then return null;
end $$;

create or replace function report_target_text(p_type report_target, p_id text)
returns text language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  case p_type::text
    when 'USER' then
      select display_name || coalesce(' · ' || place, '') into v from profiles where id::text = p_id;
    when 'LISTING' then
      select '«' || title || '»' into v from listings where id::text = p_id;
    when 'MESSAGE' then
      select 'Samtale om «' || coalesce(l.title, c.notice_title, 'oppslag') || '» – «' || left(m.text, 120) || '»' into v
        from messages m join conversations c on c.id = m.conversation_id
        left join listings l on l.id = c.listing_id where m.id::text = p_id;
    when 'REVIEW' then
      select 'Vurdering: «' || coalesce(left(comment, 120), rating || ' stjerner') || '»' into v
        from reviews where id::text = p_id;
    when 'PROPOSAL' then
      select 'Tilbud på «' || l.title || '»' || coalesce(' – «' || left(p.message, 120) || '»', '') into v
        from proposals p join listings l on l.id = p.listing_id where p.id::text = p_id;
    when 'NOTICE' then
      select '«' || title || '» på oppslagstavla' || coalesce(' i ' || nullif(place, ''), '') into v
        from noticeboard_posts where id::text = p_id;
    when 'COMMENT' then
      select 'Svar på «' || n.title || '» – «' || left(c.body, 120) || '»' into v
        from notice_comments c join noticeboard_posts n on n.id = c.notice_id where c.id::text = p_id;
    else v := null;
  end case;
  return coalesce(v, 'Innholdet finnes ikke lenger');
end $$;

create or replace function admin_decide_report(p_report_id uuid, p_outcome text)
returns void language plpgsql security definer set search_path = public as $$
declare r reports; v_owner uuid; v_undo jsonb := null;
begin
  perform admin_guard();
  if p_outcome not in ('dismiss','remove','warn') then raise exception 'Ukjent utfall.'; end if;
  select * into r from reports where id = p_report_id for update;
  if not found then raise exception 'Fant ikke rapporten.'; end if;
  if r.status = 'RESOLVED' then return; end if;
  v_owner := report_target_owner(r.target_type, r.target_id);

  if p_outcome = 'remove' then
    case r.target_type::text
      when 'LISTING' then
        update listings set admin_hidden = true where id::text = r.target_id;
      when 'NOTICE' then
        update noticeboard_posts set hidden_at = now() where id::text = r.target_id;
      when 'MESSAGE' then
        select jsonb_build_object('text', messages.text) into v_undo from messages where id::text = r.target_id;
        update messages set text = 'Meldingen er fjernet av MinNabo.' where id::text = r.target_id;
      when 'COMMENT' then
        select jsonb_build_object('body', body) into v_undo from notice_comments where id::text = r.target_id;
        update notice_comments set body = 'Svaret er fjernet av MinNabo.' where id::text = r.target_id;
      when 'REVIEW' then
        select jsonb_build_object('comment', comment) into v_undo from reviews where id::text = r.target_id;
        update reviews set comment = null where id::text = r.target_id;
      when 'PROPOSAL' then
        select jsonb_build_object('status', status) into v_undo from proposals where id::text = r.target_id;
        update proposals set status = 'WITHDRAWN', updated_at = now()
         where id::text = r.target_id and status in ('SENT','REVISION_PENDING');
      when 'USER' then
        select jsonb_build_object('suspended_at', suspended_at) into v_undo from profiles where id = v_owner;
        update profiles set suspended_at = coalesce(suspended_at, now()) where id = v_owner;
      else null;
    end case;
    perform notify_moderation(v_owner, 'Innhold er fjernet',
      'Noe du har lagt ut bryter med reglene for MinNabo og er fjernet. Grunn: ' || r.reason || '.', '/vilkar');
  elsif p_outcome = 'warn' then
    perform notify_moderation(v_owner, 'Du har fått en advarsel',
      'Vi har fått en rapport om deg: ' || r.reason || '. Gjentatte brudd på reglene kan føre til at kontoen blir suspendert.', '/vilkar');
  end if;

  update reports set status = 'RESOLVED', outcome = p_outcome, undo = v_undo,
         resolved_by = auth.uid(), resolved_at = now()
   where id = p_report_id;

  perform notify_moderation(r.by_profile_id, 'Rapporten din er behandlet',
    'Takk for at du sa fra. Vi har sett på rapporten om «' || r.reason || '».', null);
end $$;

create or replace function admin_reopen_report(p_report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r reports; v_owner uuid;
begin
  perform admin_guard();
  select * into r from reports where id = p_report_id for update;
  if not found or r.status = 'OPEN' then return; end if;
  if r.outcome = 'remove' then
    v_owner := report_target_owner(r.target_type, r.target_id);
    case r.target_type::text
      when 'LISTING' then update listings set admin_hidden = false where id::text = r.target_id;
      when 'NOTICE' then update noticeboard_posts set hidden_at = null where id::text = r.target_id;
      when 'MESSAGE' then
        if r.undo ? 'text' then update messages set text = r.undo->>'text' where id::text = r.target_id; end if;
      when 'COMMENT' then
        if r.undo ? 'body' then update notice_comments set body = r.undo->>'body' where id::text = r.target_id; end if;
      when 'REVIEW' then
        if r.undo ? 'comment' then update reviews set comment = r.undo->>'comment' where id::text = r.target_id; end if;
      when 'PROPOSAL' then
        if r.undo ? 'status' then
          update proposals set status = (r.undo->>'status')::proposal_status where id::text = r.target_id;
        end if;
      when 'USER' then
        update profiles set suspended_at = (r.undo->>'suspended_at')::timestamptz where id = v_owner;
      else null;
    end case;
  end if;
  update reports set status = 'OPEN', outcome = null, undo = null, resolved_by = null, resolved_at = null
   where id = p_report_id;
end $$;

-- ---------------------------------------------------------------------------
-- 3. an oppdrag with an avtale is protected
-- ---------------------------------------------------------------------------
-- Not SECURITY DEFINER on purpose: `current_user` must be the caller's role
-- ('authenticated' for a direct update from the app, the owner role inside our RPCs).
create or replace function listings_guard_agreement() returns trigger
language plpgsql as $$
begin
  if new.status is not distinct from old.status then return new; end if;

  -- the owner (a direct update from the app) can't remove, archive, pause or reopen
  -- an oppdrag that has an avtale; the avtale has to be called off first
  if current_user = 'authenticated'
     and old.status::text in ('OFFER_ACCEPTED','AGREED','IN_PROGRESS','COMPLETION_SENT') then
    raise exception 'Oppdraget har en avtale. Avlys avtalen før du endrer oppdraget.' using errcode = '42501';
  end if;

  -- calling an avtale off reopens the oppdrag – but never one the owner has removed or archived
  if current_user <> 'authenticated'
     and new.status::text = 'RECEIVING_OFFERS'
     and old.status::text in ('REMOVED','ARCHIVED','PAUSED') then
    new.status := old.status;
  end if;
  return new;
end $$;
drop trigger if exists listings_guard_agreement on listings;
create trigger listings_guard_agreement before update of status on listings
  for each row execute function listings_guard_agreement();

-- ---------------------------------------------------------------------------
-- 4. the real reason a tilbud can't be accepted
-- ---------------------------------------------------------------------------
create or replace function proposals_accept_needs_open_listing() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if new.status::text = 'ACCEPTED' and old.status::text <> 'ACCEPTED' and not is_open_listing(new.listing_id) then
    select status::text into v_status from listings where id = new.listing_id;
    if v_status in ('PAUSED','ARCHIVED','REMOVED','EXPIRED') then
      raise exception 'Oppdraget er satt på pause eller fjernet. Aktiver det igjen for å godta tilbud.' using errcode = '42501';
    end if;
    raise exception 'Oppdraget har allerede en avtale.' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 5. no "e-post bekreftet" without an e-mail
-- ---------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text; ini text;
begin
  nm := coalesce(new.raw_user_meta_data->>'display_name',
                 split_part(new.email,'@',1), 'Nabo');
  ini := upper(left(regexp_replace(nm,'[^A-Za-zÆØÅæøå]','','g'), 2));
  insert into public.profiles (id, display_name, initials)
    values (new.id, nm, coalesce(nullif(ini,''),'N'));
  -- only a real, confirmed address counts (not the test login, not Vipps' internal address)
  if new.email is not null
     and new.email not like '%@vipps.minnabo.invalid'
     and coalesce(new.is_anonymous, false) = false then
    insert into public.verifications (profile_id, kind, verified, explanation, verified_at)
      values (new.id,'EMAIL', true,
              'E-postadressen din er bekreftet ved innlogging.', now());
  end if;
  return new;
end $$;

delete from verifications v
 using auth.users u
 where u.id = v.profile_id
   and v.kind = 'EMAIL'
   and v.explanation = 'E-postadressen din er bekreftet ved innlogging.'
   and (u.email is null or coalesce(u.is_anonymous, false) or u.email like '%@vipps.minnabo.invalid');

-- ---------------------------------------------------------------------------
-- 6. "Levert"
-- ---------------------------------------------------------------------------
alter table conversation_participants
  add column if not exists last_delivered_at timestamptz not null default 'epoch';

-- Called when my app fetches its conversations: everything sent to me so far has arrived.
create or replace function mark_conversations_delivered()
returns void language sql security definer set search_path = public as $$
  update conversation_participants cp set last_delivered_at = now()
   where cp.profile_id = auth.uid()
     and exists (select 1 from messages m
                  where m.conversation_id = cp.conversation_id
                    and m.author_id <> auth.uid()
                    and m.created_at > cp.last_delivered_at);
$$;
grant execute on function mark_conversations_delivered() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. comment notification → that oppslag
-- ---------------------------------------------------------------------------
create or replace function notice_comment_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare n noticeboard_posts; v_name text; v_recent int;
begin
  select * into n from noticeboard_posts where id = new.notice_id;
  if not found or n.hidden_at is not null then raise exception 'Fant ikke oppslaget.'; end if;
  if n.done_at is not null then raise exception 'Oppslaget er avsluttet.'; end if;
  if exists (select 1 from blocks b
              where (b.by_profile_id = n.author_id and b.blocked_profile_id = new.author_id)
                 or (b.by_profile_id = new.author_id and b.blocked_profile_id = n.author_id)) then
    raise exception 'Du kan ikke svare på dette oppslaget.' using errcode = '42501';
  end if;
  select count(*) into v_recent from notice_comments
   where author_id = new.author_id and created_at > now() - interval '1 minute';
  if v_recent >= 6 then raise exception 'For mange svar. Vent litt og prøv igjen.'; end if;

  if n.author_id <> new.author_id then
    select display_name into v_name from profiles where id = new.author_id;
    insert into notifications (profile_id, kind, title, body, route)
      values (n.author_id, 'NOTICE_REPLY'::text::notification_kind,
              coalesce(v_name, 'En nabo') || ' svarte på oppslaget ditt',
              '«' || n.title || '»: ' || left(new.body, 100), '/oppslagstavle?oppslag=' || n.id);
  end if;
  return new;
end $$;
