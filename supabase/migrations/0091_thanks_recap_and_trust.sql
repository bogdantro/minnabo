-- 0091_thanks_recap_and_trust.sql
--  Asked 2026-11-06:
--    * Takkekort: after a finished job, one card per person per avtale. Shown on the profile.
--    * «Året ditt på MinNabo»: my own numbers for a year (jobs, neighbours helped, top category).
--    * «Avtalt sum i år»: what a helper has agreed per oppdragsgiver this year. Only the agreed
--      prices from avtaler: MinNabo doesn't know what was actually paid (rule 4).
--    * Politiattest: a badge for child care and company categories. The file is private, only the
--      moderators can open it, and it is deleted as soon as they have decided – only «sett, dato»
--      is kept. Hidden in the app behind the flag policeCertificate until the lawyer has answered.
--    * Snow: snow_alert() is called by the `snow-alert` edge function for a kommune with snow in
--      the forecast, at most once a day per kommune.

-- ---------------------------------------------------------------------------
-- Takkekort
-- ---------------------------------------------------------------------------
create table if not exists thank_cards (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  card text not null check (card in ('STRONG','KIND','SAVED','PRECISE','TIDY')),
  message text check (message is null or char_length(message) <= 200),
  created_at timestamptz not null default now(),
  unique (proposal_id, from_profile_id)
);
create index if not exists thank_cards_to_idx on thank_cards (to_profile_id, created_at desc);
alter table thank_cards enable row level security;
drop policy if exists p_thank_cards_read on thank_cards;
create policy p_thank_cards_read on thank_cards for select to authenticated using (true);
revoke insert, update, delete on thank_cards from anon, authenticated;

create or replace function send_thank_card(p_proposal_id uuid, p_card text, p_message text) returns thank_cards
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_to uuid; v_name text; v_message text := nullif(btrim(coalesce(p_message, '')), ''); c thank_cards; v_done int;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  if is_youth(v_me) then raise exception 'Takkekort er låst for ungdomskontoer.' using errcode = '42501'; end if;
  select * into p from proposals where id = p_proposal_id;
  if not found or v_me not in (p.from_profile_id, p.to_profile_id) then
    raise exception 'Ikke tilgang.' using errcode = '42501';
  end if;
  select count(*) into v_done from completion_confirmations where agreement_proposal_id = p.id;
  if p.status <> 'ACCEPTED' or v_done < 2 then raise exception 'Du kan takke når jobben er fullført.'; end if;
  if has_banned_word(v_message) then raise exception 'Teksten inneholder ord som ikke er tillatt.'; end if;
  v_to := case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end;

  insert into thank_cards (proposal_id, from_profile_id, to_profile_id, card, message)
    values (p.id, v_me, v_to, p_card, v_message)
    on conflict (proposal_id, from_profile_id) do update set card = excluded.card, message = excluded.message
    returning * into c;
  v_name := first_name(v_me);
  perform notify(v_to, 'REVIEW_RECEIVED', coalesce(v_name, 'En nabo') || ' sendte deg et takkekort',
    coalesce(v_message, 'Se det på profilen din.'), '/profil');
  return c;
end $$;
revoke all on function send_thank_card(uuid, text, text) from public, anon;
grant execute on function send_thank_card(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- My own numbers
-- ---------------------------------------------------------------------------
-- Jobs finished by both, for one person, in one Oslo calendar year.
create or replace function finished_jobs(p_me uuid, p_year int)
returns table (proposal_id uuid, helper uuid, client uuid, amount_minor bigint, category text, done_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.from_profile_id, p.to_profile_id, p.price_amount_minor, l.category_slug, max(c.confirmed_at)
    from proposals p
    join listings l on l.id = p.listing_id
    join completion_confirmations c on c.agreement_proposal_id = p.id
   where p.status = 'ACCEPTED' and p_me in (p.from_profile_id, p.to_profile_id)
   group by p.id, p.from_profile_id, p.to_profile_id, p.price_amount_minor, l.category_slug
  having count(*) >= 2
     and extract(year from max(c.confirmed_at) at time zone 'Europe/Oslo') = p_year;
$$;
revoke all on function finished_jobs(uuid, int) from public, anon, authenticated;

create or replace function my_year_recap(p_year int) returns jsonb
language sql stable security definer set search_path = public as $$
  with j as (select * from finished_jobs(auth.uid(), p_year))
  select jsonb_build_object(
    'year', p_year,
    'helped', (select count(*) from j where helper = auth.uid()),
    'gotHelp', (select count(*) from j where client = auth.uid()),
    'neighbours', (select count(distinct case when helper = auth.uid() then client else helper end) from j),
    'topCategory', (select category from j where helper = auth.uid() group by category order by count(*) desc, category limit 1),
    'thanks', (select count(*) from thank_cards t where t.to_profile_id = auth.uid()
                 and extract(year from t.created_at at time zone 'Europe/Oslo') = p_year),
    'stars', (select round(avg(r.rating)::numeric, 1) from reviews r where r.to_profile_id = auth.uid()
                 and extract(year from r.created_at at time zone 'Europe/Oslo') = p_year));
$$;
revoke all on function my_year_recap(int) from public, anon;
grant execute on function my_year_recap(int) to authenticated;

-- Per oppdragsgiver: the tax-free limit counts each private person on their own.
create or replace function my_agreed_sum(p_year int) returns jsonb
language sql stable security definer set search_path = public as $$
  with j as (select * from finished_jobs(auth.uid(), p_year) where helper = auth.uid()),
       per as (select client, sum(amount_minor)::bigint as minor, count(*)::int as jobs from j group by client)
  select jsonb_build_object(
    'year', p_year,
    'totalMinor', coalesce((select sum(minor) from per), 0),
    'jobs', coalesce((select sum(jobs) from per), 0),
    'people', coalesce((select jsonb_agg(jsonb_build_object('name', pr.display_name, 'minor', per.minor, 'jobs', per.jobs) order by per.minor desc)
                          from per join profiles pr on pr.id = per.client), '[]'::jsonb));
$$;
revoke all on function my_agreed_sum(int) from public, anon;
grant execute on function my_agreed_sum(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Politiattest
-- ---------------------------------------------------------------------------
create table if not exists police_certificates (
  profile_id uuid primary key references profiles(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  file_path text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  rejection_reason text
);
alter table police_certificates enable row level security;
drop policy if exists p_police_read_own on police_certificates;
create policy p_police_read_own on police_certificates for select to authenticated
  using (profile_id = auth.uid());
revoke insert, update, delete on police_certificates from anon, authenticated;

-- Only ever «seen», never what it says.
create or replace function has_police_certificate(p_profile uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from police_certificates c where c.profile_id = p_profile and c.status = 'APPROVED');
$$;
revoke all on function has_police_certificate(uuid) from public, anon;
grant execute on function has_police_certificate(uuid) to authenticated;

insert into storage.buckets (id, name, public)
  values ('police-certificates', 'police-certificates', false)
on conflict (id) do nothing;

drop policy if exists "police certificates write own" on storage.objects;
create policy "police certificates write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'police-certificates' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function submit_police_certificate(p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_old text;
begin
  if v_me is null then raise exception 'Ikke innlogget.' using errcode = '42501'; end if;
  if is_youth(v_me) then raise exception 'Ikke tilgjengelig for ungdomskontoer.' using errcode = '42501'; end if;
  if split_part(p_path, '/', 1) <> v_me::text then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  select file_path into v_old from police_certificates where profile_id = v_me;
  if v_old is not null then perform queue_file_purge('police-certificates', v_old); end if;
  insert into police_certificates (profile_id, status, file_path, submitted_at, decided_at, rejection_reason)
    values (v_me, 'PENDING', p_path, now(), null, null)
  on conflict (profile_id) do update
    set status = 'PENDING', file_path = excluded.file_path, submitted_at = now(), decided_at = null, rejection_reason = null;
end $$;
revoke all on function submit_police_certificate(text) from public, anon;
grant execute on function submit_police_certificate(text) to authenticated;

-- For the website's moderators (service role): the file is deleted as soon as it has been read.
create or replace function moderation_decide_police_certificate(p_profile uuid, p_approved boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_path text;
begin
  select file_path into v_path from police_certificates where profile_id = p_profile for update;
  if not found then raise exception 'Fant ikke politiattesten.'; end if;
  perform queue_file_purge('police-certificates', v_path);
  update police_certificates
     set status = case when p_approved then 'APPROVED' else 'REJECTED' end,
         file_path = null, decided_at = now(),
         rejection_reason = case when p_approved then null else nullif(btrim(coalesce(p_reason, '')), '') end
   where profile_id = p_profile;
  perform notify(p_profile, 'MODERATION',
    case when p_approved then 'Politiattesten er godkjent' else 'Politiattesten ble ikke godkjent' end,
    case when p_approved then 'Merket vises nå på profilen din.'
         else coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Se Verifisering for hva du kan gjøre.') end,
    '/verifisering');
end $$;
revoke all on function moderation_decide_police_certificate(uuid, boolean, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Snow in the forecast
-- ---------------------------------------------------------------------------
create table if not exists snow_alerts (
  kommune text not null,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (kommune, day)
);
alter table snow_alerts enable row level security;
revoke all on snow_alerts from public, anon, authenticated;

-- Helpers who do snømåking and adults who posted a snømåking oppdrag before hear about it.
create or replace function snow_alert(p_kommune text) returns int
language plpgsql security definer set search_path = public as $$
declare v_day date := (now() at time zone 'Europe/Oslo')::date; v_helpers int := 0; v_posters int := 0;
begin
  insert into snow_alerts (kommune, day) values (p_kommune, v_day) on conflict do nothing;
  if not found then return 0; end if;

  insert into notifications (profile_id, kind, title, body, route)
  select p.id, 'NEW_MATCH'::text::notification_kind, 'Det er meldt snø i natt',
         'Naboene i ' || p_kommune || ' kan trenge hjelp til å måke.', '/oppdrag-liste?category=snomaking'
    from profiles p
   where p.municipality = p_kommune and p.deleted_at is null and p.suspended_at is null
     and not coalesce(p.paused, false) and coalesce(p.available_for_jobs, true)
     and 'snomaking' = any(p.category_slugs);
  get diagnostics v_helpers = row_count;

  insert into notifications (profile_id, kind, title, body, route)
  select distinct p.id, 'NEW_MATCH'::text::notification_kind, 'Det er meldt snø i natt',
         'Trenger du måkehjelp? Legg ut oppdraget i kveld, så er det gjort i morgen tidlig.', '/legg-ut?kategori=snomaking'
    from profiles p
    join listings l on l.owner_id = p.id and l.category_slug = 'snomaking' and l.type = 'TASK_REQUEST'
   where p.municipality = p_kommune and p.deleted_at is null and p.suspended_at is null
     and not is_youth(p.id)
     and not coalesce(p.paused, false)
     and not ('snomaking' = any(p.category_slugs));
  get diagnostics v_posters = row_count;
  return v_helpers + v_posters;
end $$;
revoke all on function snow_alert(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Minimum app version: the website's admin can raise it; 0.0.0 means nobody is stopped.
-- ---------------------------------------------------------------------------
insert into app_settings (key, value) values ('platform.min_app_version', '"0.0.0"'::jsonb)
on conflict (key) do nothing;
