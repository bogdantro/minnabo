-- 0032_admin.sql — Adminpanel (design/screens/Admin.dc.html).
-- Everything here is admin-only and enforced in the database: every RPC checks
-- is_admin() and runs as security definer; the tables stay read-protected by RLS.
--
--  * reports: outcome (dismiss / remove / warn), undo data, NOTICE target
--  * moderation flags: profiles.suspended_at, listings.admin_hidden,
--    noticeboard_posts.hidden_at — plus triggers that stop suspended users
--  * business verification: approval (not submission) sets is_business
--  * partners: main slots (max 2) and the supporter carousel (partners.active)
--  * KPIs and weekly statistics

alter type report_target add value if not exists 'NOTICE';

alter table reports add column if not exists outcome text check (outcome in ('dismiss','remove','warn'));
alter table reports add column if not exists undo jsonb;

alter table profiles add column if not exists suspended_at timestamptz;
alter table listings add column if not exists admin_hidden boolean not null default false;
alter table noticeboard_posts add column if not exists hidden_at timestamptz;
alter table partners add column if not exists active boolean not null default true;
alter table business_profiles add column if not exists decided_at timestamptz;

-- Hidden content disappears for everyone except its owner and admins.
drop policy if exists p_listings_read on listings;
create policy p_listings_read on listings for select to authenticated
  using ((status <> 'REMOVED' and not admin_hidden) or owner_id = auth.uid() or is_admin());

drop policy if exists noticeboard_read_all on noticeboard_posts;
create policy noticeboard_read_all on noticeboard_posts for select to authenticated
  using (hidden_at is null or author_id = auth.uid() or is_admin());

-- Supporters switched off in the admin carousel are not shown to users.
drop policy if exists p_partners_read on partners;
create policy p_partners_read on partners for select to authenticated
  using (active or is_admin());

-- Users can't change their own moderation flags through the profile update policy.
create or replace function guard_moderation_columns() returns trigger
language plpgsql as $$
begin
  if not is_admin() and current_user = 'authenticated' then
    new.suspended_at := old.suspended_at;
    new.role := old.role;
    new.is_business := old.is_business;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_moderation on profiles;
create trigger profiles_guard_moderation before update on profiles
  for each row execute function guard_moderation_columns();

create or replace function guard_listing_hidden() returns trigger
language plpgsql as $$
begin
  if not is_admin() and current_user = 'authenticated' then
    new.admin_hidden := old.admin_hidden;
  end if;
  return new;
end $$;
drop trigger if exists listings_guard_hidden on listings;
create trigger listings_guard_hidden before update on listings
  for each row execute function guard_listing_hidden();

create or replace function guard_notice_hidden() returns trigger
language plpgsql as $$
begin
  if not is_admin() and current_user = 'authenticated' then
    new.hidden_at := old.hidden_at;
  end if;
  return new;
end $$;
drop trigger if exists noticeboard_guard_hidden on noticeboard_posts;
create trigger noticeboard_guard_hidden before update on noticeboard_posts
  for each row execute function guard_notice_hidden();

-- Suspended users can read, but not publish anything new.
create or replace function block_suspended_writes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and exists (
    select 1 from profiles where id = auth.uid() and suspended_at is not null
  ) then
    raise exception 'Kontoen din er suspendert. Kontakt MinNabo.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['listings','proposals','messages','noticeboard_posts','reviews'] loop
    execute format('drop trigger if exists %I on %I', t || '_block_suspended', t);
    execute format(
      'create trigger %I before insert on %I for each row execute function block_suspended_writes()',
      t || '_block_suspended', t);
  end loop;
end $$;

-- Business: submission waits for an admin; approval sets the flag.
create or replace function submit_business_profile(
  p_org_nr text, p_company_name text, p_contact_person text,
  p_email text, p_phone text, p_category_slugs text[])
returns business_profiles language plpgsql security definer set search_path = public as $$
declare b business_profiles;
begin
  insert into business_profiles (profile_id, org_nr, company_name, contact_person,
      email, phone, category_slugs, status)
    values (auth.uid(), p_org_nr, p_company_name, p_contact_person, p_email, p_phone,
      coalesce(p_category_slugs,'{}'), 'PENDING')
  on conflict (profile_id) do update set
    org_nr = excluded.org_nr, company_name = excluded.company_name,
    contact_person = excluded.contact_person, email = excluded.email,
    phone = excluded.phone, category_slugs = excluded.category_slugs,
    status = 'PENDING', decided_at = null, created_at = now()
  returning * into b;
  return b;
end $$;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function admin_guard() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Kun administratorer.' using errcode = '42501'; end if;
end $$;

create or replace function notify_moderation(p_profile uuid, p_title text, p_body text, p_route text default null)
returns void language sql security definer set search_path = public as $$
  insert into notifications (profile_id, kind, title, body, route)
  select p_profile, 'MODERATION', p_title, p_body, p_route where p_profile is not null;
$$;
revoke all on function notify_moderation(uuid, text, text, text) from public, anon, authenticated;

-- The profile responsible for a reported target.
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
  end case;
  return v;
exception when invalid_text_representation then return null;
end $$;

-- Short text describing the reported target for the admin queue.
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
      select 'Samtale om «' || l.title || '» – «' || left(m.text, 120) || '»' into v
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
  end case;
  return coalesce(v, 'Innholdet finnes ikke lenger');
end $$;

-- ---------------------------------------------------------------------------
-- KPIs
-- ---------------------------------------------------------------------------
create or replace function admin_overview()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return json_build_object(
    'open_reports', (select count(*) from reports where status = 'OPEN'),
    'pending_businesses', (select count(*) from business_profiles where status = 'PENDING'),
    'new_users_today', (select count(*) from profiles
        where deleted_at is null and created_at >= date_trunc('day', now() at time zone 'Europe/Oslo') at time zone 'Europe/Oslo'),
    'active_listings', (select count(*) from listings
        where not admin_hidden and status in ('PUBLISHED','RECEIVING_OFFERS','ACTIVE'))
  );
end $$;

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
create or replace function admin_reports()
returns table (
  id uuid, target_type text, target_id text, reason text, details text, target_text text,
  by_name text, created_at timestamptz, status text, outcome text, resolved_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
    select r.id, r.target_type::text, r.target_id, r.reason, r.details,
           report_target_text(r.target_type, r.target_id),
           coalesce(p.display_name, 'Slettet bruker'), r.created_at, r.status::text, r.outcome, r.resolved_at
      from reports r left join profiles p on p.id = r.by_profile_id
     where r.status = 'OPEN' or r.resolved_at > now() - interval '14 days'
     order by r.created_at desc
     limit 200;
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

-- Angre: put the report back in the queue and restore removed content.
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
      when 'REVIEW' then
        if r.undo ? 'comment' then update reviews set comment = r.undo->>'comment' where id::text = r.target_id; end if;
      when 'PROPOSAL' then
        if r.undo ? 'status' then
          update proposals set status = (r.undo->>'status')::proposal_status where id::text = r.target_id;
        end if;
      when 'USER' then
        update profiles set suspended_at = (r.undo->>'suspended_at')::timestamptz where id = v_owner;
    end case;
  end if;
  update reports set status = 'OPEN', outcome = null, undo = null, resolved_by = null, resolved_at = null
   where id = p_report_id;
end $$;

-- ---------------------------------------------------------------------------
-- business verification
-- ---------------------------------------------------------------------------
create or replace function admin_businesses()
returns table (
  profile_id uuid, org_nr text, company_name text, contact_person text, email text, phone text,
  category_slugs text[], status text, created_at timestamptz, decided_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
    select b.profile_id, b.org_nr, b.company_name, b.contact_person, b.email, b.phone,
           b.category_slugs, b.status::text, b.created_at, b.decided_at
      from business_profiles b
     where b.status = 'PENDING' or b.decided_at > now() - interval '30 days'
     order by b.created_at;
end $$;

create or replace function admin_decide_business(p_profile_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare b business_profiles;
begin
  perform admin_guard();
  update business_profiles
     set status = case when p_approve then 'APPROVED' else 'REJECTED' end::business_status,
         decided_at = now()
   where profile_id = p_profile_id returning * into b;
  if not found then raise exception 'Fant ikke bedriften.'; end if;
  update profiles set is_business = p_approve where id = p_profile_id;
  insert into verifications (profile_id, kind, verified, explanation, verified_at)
    values (p_profile_id, 'BUSINESS', p_approve,
      case when p_approve then 'Organisasjonsnummeret er sjekket mot Enhetsregisteret.'
           else 'Bedriften ble ikke godkjent.' end,
      case when p_approve then now() end)
  on conflict (profile_id, kind) do update
    set verified = excluded.verified, explanation = excluded.explanation, verified_at = excluded.verified_at;
  if p_approve then
    perform notify_moderation(p_profile_id, 'Bedriften er verifisert',
      b.company_name || ' er verifisert. Verifisert-merket vises nå på profilen din.', '/bedrift');
  else
    perform notify_moderation(p_profile_id, 'Bedriften ble ikke godkjent',
      'Sjekk opplysningene om ' || b.company_name || ' og send inn på nytt.', '/bedrift');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create or replace function admin_users(p_q text default '')
returns table (
  id uuid, display_name text, initials text, avatar_path text, place text, municipality text,
  member_since text, rating numeric, rating_count int, suspended boolean, role text)
language plpgsql stable security definer set search_path = public as $$
declare v_q text := '%' || lower(trim(coalesce(p_q, ''))) || '%';
begin
  perform admin_guard();
  return query
    select p.id, p.display_name, p.initials, p.avatar_path, p.place, p.municipality,
           p.member_since, pr.average, coalesce(pr.count, 0), p.suspended_at is not null, p.role
      from profiles p left join profile_ratings pr on pr.profile_id = p.id
     where p.deleted_at is null
       and lower(p.display_name || ' ' || coalesce(p.place, '') || ' ' || coalesce(p.municipality, '')) like v_q
     order by p.suspended_at desc nulls last, p.created_at desc
     limit 100;
end $$;

create or replace function admin_set_suspended(p_profile_id uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  if p_profile_id = auth.uid() then raise exception 'Du kan ikke suspendere deg selv.'; end if;
  update profiles set suspended_at = case when p_suspended then coalesce(suspended_at, now()) end
   where id = p_profile_id;
  if p_suspended then
    perform notify_moderation(p_profile_id, 'Kontoen din er suspendert',
      'Du kan ikke legge ut, gi tilbud eller sende meldinger før saken er behandlet. Kontakt MinNabo hvis du mener dette er feil.', '/vilkar');
  else
    perform notify_moderation(p_profile_id, 'Kontoen din er aktiv igjen', 'Du kan bruke MinNabo som vanlig.', null);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- flagged listings
-- ---------------------------------------------------------------------------
create or replace function admin_flagged_listings()
returns table (id uuid, title text, category_slug text, report_count int, last_reason text, hidden boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
    select l.id, l.title, l.category_slug, count(r.id)::int,
           (select r2.reason from reports r2 where r2.target_type = 'LISTING' and r2.target_id = l.id::text
             order by r2.created_at desc limit 1),
           l.admin_hidden
      from listings l
      join reports r on r.target_type = 'LISTING' and r.target_id = l.id::text
     group by l.id
     order by max(r.created_at) desc
     limit 100;
end $$;

create or replace function admin_set_listing_hidden(p_listing_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text;
begin
  perform admin_guard();
  update listings set admin_hidden = p_hidden where id = p_listing_id returning owner_id, title into v_owner, v_title;
  if p_hidden then
    perform notify_moderation(v_owner, 'Oppdraget ditt er skjult',
      '«' || v_title || '» bryter med reglene for MinNabo og vises ikke for andre.', '/mine-oppdrag');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- partners
-- ---------------------------------------------------------------------------
create or replace function admin_partners()
returns table (id uuid, name text, blurb text, municipality text, main boolean, active boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
    select p.id, p.name, p.blurb, p.municipality,
           exists (select 1 from partner_placements pp
                    where pp.partner_id = p.id and pp.surface = 'fellesskap' and pp.active),
           p.active
      from partners p order by p.name;
end $$;

create or replace function admin_set_main_partner(p_partner_id uuid, p_main boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  perform admin_guard();
  if p_main then
    select count(distinct partner_id) into v_n from partner_placements
     where surface = 'fellesskap' and active and partner_id <> p_partner_id;
    if v_n >= 2 then raise exception 'Maks 2 hovedpartnere.'; end if;
    update partner_placements set active = true where partner_id = p_partner_id and surface = 'fellesskap';
    if not found then
      insert into partner_placements (partner_id, surface, headline, active)
        values (p_partner_id, 'fellesskap', 'Hovedpartner', true);
    end if;
    update partners set active = true where id = p_partner_id;
  else
    update partner_placements set active = false where partner_id = p_partner_id and surface = 'fellesskap';
  end if;
end $$;

create or replace function admin_set_partner_active(p_partner_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update partners set active = p_active where id = p_partner_id;
end $$;

-- ---------------------------------------------------------------------------
-- weekly statistics (Mon–Sun of the week containing p_day, Oslo time)
-- ---------------------------------------------------------------------------
create or replace function admin_week_stats(p_day date default null)
returns table (stat_day date, n_listings int, n_offers int, n_completed int)
language plpgsql stable security definer set search_path = public as $$
declare v_mon date := date_trunc('week', coalesce(p_day, (now() at time zone 'Europe/Oslo')::date))::date;
begin
  perform admin_guard();
  return query
    select d::date,
      (select count(*)::int from listings l
        where l.type = 'TASK_REQUEST' and l.status <> 'DRAFT'
          and (l.created_at at time zone 'Europe/Oslo')::date = d::date),
      (select count(*)::int from proposals p
        where p.status <> 'DRAFT' and (p.created_at at time zone 'Europe/Oslo')::date = d::date),
      (select count(*)::int from (
          select c.agreement_proposal_id, max(c.confirmed_at) as at
            from completion_confirmations c group by c.agreement_proposal_id having count(*) >= 2
        ) done where (done.at at time zone 'Europe/Oslo')::date = d::date)
    from generate_series(v_mon, v_mon + 6, interval '1 day') d
    order by 1;
end $$;

revoke all on function admin_overview(), admin_reports(), admin_decide_report(uuid, text),
  admin_reopen_report(uuid), admin_businesses(), admin_decide_business(uuid, boolean),
  admin_users(text), admin_set_suspended(uuid, boolean), admin_flagged_listings(),
  admin_set_listing_hidden(uuid, boolean), admin_partners(), admin_set_main_partner(uuid, boolean),
  admin_set_partner_active(uuid, boolean), admin_week_stats(date) from public, anon;
grant execute on function admin_overview(), admin_reports(), admin_decide_report(uuid, text),
  admin_reopen_report(uuid), admin_businesses(), admin_decide_business(uuid, boolean),
  admin_users(text), admin_set_suspended(uuid, boolean), admin_flagged_listings(),
  admin_set_listing_hidden(uuid, boolean), admin_partners(), admin_set_main_partner(uuid, boolean),
  admin_set_partner_active(uuid, boolean), admin_week_stats(date) to authenticated;
