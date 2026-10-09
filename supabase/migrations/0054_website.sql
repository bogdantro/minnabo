-- =====================================================================================
-- 0054_website.sql — shared schema for the MinNabo website (minnabo-web repo)
--
-- The website (Django, server-side, connects as postgres) shares this database with the app.
-- This adds what the website needs: partners with packages and Stripe billing, settings,
-- kommuner, category colours, donations to clubs, news, contact forms, an admin audit log,
-- and moderation functions the website admin can call. Mapping: minnabo-web docs/SCHEMA_MAP.md.
--
--  * Requires 0047–0053. Source of truth for edits: minnabo-web supabase/sql/0001_website.sql
--    (identical file), tested there with supabase/test/run.sh.
--  * Additive only: no app table, column or policy is dropped or renamed. Two policies are
--    replaced (p_partners_read, p_donations_read), one column loses NOT NULL
--    (donation_records.transferred_at) and six app functions are re-created with the same
--    signature and behaviour (admin_decide_report, admin_reopen_report, admin_set_listing_hidden,
--    admin_set_suspended, admin_decide_business, admin_set_main_partner) + guard_listing_hidden.
--  * Idempotent (safe to run twice). Time zone for business logic: Europe/Oslo.
-- =====================================================================================

-- ---------- Django's private schema (never exposed through the Supabase API) ----------
create schema if not exists web;
revoke all on schema web from anon, authenticated;


-- =====================================================================================
-- 1. Settings
-- =====================================================================================
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);
insert into public.app_settings(key, value) values
  ('partners.prices',               '{"stottespiller":600,"helt":1700,"hoved":5000}'),
  ('partners.stripe_price_ids',     '{}'),
  ('partners.max_hovedpartnere',    '4'),
  ('partners.version',              '"0"'),
  ('billing.grace_days',            '7'),
  ('billing.reminder_steps',        '{"0":true,"3":true,"7":true}'),
  ('billing.invoice_days_until_due','14'),
  ('billing.vat_percent',           '25'),
  ('donations.share_percent',       'null'),
  ('donations.next_date',           'null'),
  ('platform.registration_open',    'true'),
  ('platform.maintenance_mode',     'false'),
  ('platform.default_radius_km',    '10'),
  ('moderation.auto_hide_threshold','3')
on conflict (key) do nothing;
-- The word filter is NOT a setting: the app already has public.banned_words + block_banned_words triggers.

alter table public.app_settings enable row level security;
do $$ begin
  create policy app_settings_read on public.app_settings for select to anon, authenticated
    using (key like 'platform.%' or key in ('partners.version', 'partners.max_hovedpartnere'));
exception when duplicate_object then null; end $$;

create or replace function public.setting_int(p_key text, p_default int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = p_key), p_default)
$$;
revoke all on function public.setting_int(text, int) from public, anon, authenticated;

create or replace function public.bump_partners_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into app_settings(key, value, updated_at) values ('partners.version', to_jsonb(now()::text), now())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  return null;
end $$;


-- =====================================================================================
-- 2. Categories (EXISTING app table: slug, label, icon) – extend, never re-create
-- =====================================================================================
alter table public.categories
  add column if not exists web_icon    text,                      -- website icon class suffix (.i-<web_icon>)
  add column if not exists tile_bg     text,
  add column if not exists icon_color  text,
  add column if not exists active      boolean not null default true,
  add column if not exists sort_order  int not null default 0,
  add column if not exists updated_at  timestamptz not null default now();

-- Colours from APP_REFERENCE §8. Slugs are the app's. Only fills rows that have no colours yet.
update public.categories c
   set web_icon = v.web_icon, tile_bg = v.tile_bg, icon_color = v.icon_color, sort_order = v.sort_order
  from (values
    ('hage',        'hage',        '#D9F0BE', '#3A7010',  1),
    ('renhold',     'rengjoring',  '#D3ECFA', '#0B6FA3',  2),
    ('flytting',    'flytting',    '#F4E6D0', '#8C5714',  3),
    ('transport',   'transport',   '#E4E1FA', '#4F40B5',  4),
    ('montering',   'montering',   '#FBE1D5', '#A5461F',  5),
    ('snomaking',   'snomaking',   '#DFEAF8', '#2E5A9A',  6),
    ('maling',      'maling',      '#F8DCE7', '#9E335E',  7),
    ('dyrepass',    'dyrepass',    '#F7EDC6', '#7A5F00',  8),
    ('datahjelp',   'data',        '#D4F2E8', '#136F5C',  9),
    ('arrangement', 'arrangement', '#EEDDF7', '#7B359F', 10),
    ('snekring',    'montering',   '#EFE3D3', '#7A4A1C', 11),
    ('vinduspuss',  'rengjoring',  '#DDF0F7', '#13708F', 12),
    ('bilpleie',    'transport',   '#E2E7F0', '#34466B', 13),
    ('handling',    'tag',         '#FBEBD3', '#8A5300', 14),
    ('leksehjelp',  'file',        '#E6E2F8', '#4A3BA8', 15),
    ('husvakt',     'home',        '#DCF1DF', '#2D6B37', 16),
    ('ved',         'zap',         '#F6E0D4', '#8C3F1A', 17),
    ('bortkjoring', 'refresh',     '#E0EEE6', '#2F6248', 18),
    ('sykkel',      'montering',   '#DCEBF6', '#1F5C8A', 19),
    ('matlaging',   'heart',       '#FBE4E0', '#9A3426', 20),
    ('selskap',     'users',       '#F7E2EE', '#8A2F62', 21),
    ('barnevakt',   'smile',       '#FDF0CF', '#7A5A00', 22),
    ('annet',       'annet',       '#E9ECF1', '#46506A', 23)
  ) as v(slug, web_icon, tile_bg, icon_color, sort_order)
 where c.slug = v.slug and c.tile_bg is null;
-- web_icon values tag/file/home/zap/refresh/heart/users/smile and the reused ones are generic stand-ins
-- until proper masks are added to _icons.scss.


-- =====================================================================================
-- 3. Kommuner (NEW – the app stores kommune as free text; kommuner.name must equal that text)
-- =====================================================================================
create table if not exists public.kommuner (
  id          serial primary key,
  name        text not null unique,
  region      text not null,            -- 'Lillehammer-regionen', 'Hamar-regionen', 'Gjøvik-regionen', …
  active      boolean not null default false,
  sort_order  int not null default 0
);
alter table public.kommuner enable row level security;
do $$ begin
  create policy kommuner_read on public.kommuner for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;
-- Seeded by `manage.py seed_kommuner` (46 kommuner, launch areas active).


-- =====================================================================================
-- 4. Partners
--    public.partners           = the app's public partner card (EXISTING, every app user can read it)
--    public.partner_placements = the app's hovedpartner slot (EXISTING)
--    public.partner_accounts   = NEW private business/billing data, 1:1 with partners
-- =====================================================================================
alter table public.partners
  add column if not exists category_slug  text references public.categories(slug),
  add column if not exists sort_order     int not null default 0,
  add column if not exists partner_since  date,
  add column if not exists created_at     timestamptz not null default now(),
  add column if not exists updated_at     timestamptz not null default now();

create table if not exists public.partner_accounts (
  partner_id             uuid primary key references public.partners(id) on delete cascade,
  billing_mode           text not null default 'stripe' check (billing_mode in ('stripe','free')),
                         -- 'free' = «Gratis»: managed in admin, no Stripe, never hidden for payment
  org_nr                 text unique check (org_nr ~ '^[0-9]{9}$'),
  legal_name             text,                      -- from Enhetsregisteret
  org_form               text,
  business_address       text,
  contact_name           text,
  contact_phone          text,
  contact_email          text,
  billing_email          text,
  invoice_reference      text,
  package                text not null check (package in ('stottespiller','helt','hoved')),
  status                 text not null default 'draft'
                         check (status in ('draft','pending_payment','pending_approval','active','paused','cancelled','rejected')),
  payment_method         text check (payment_method in ('card','invoice')),
  payment_state          text not null default 'none'
                         check (payment_state in ('none','paid','upcoming','failed','overdue','cancelled')),
  payment_due_since      timestamptz,
  admin_hidden           boolean not null default false,
  admin_hidden_reason    text,
  admin_force_visible    boolean not null default false,   -- «Vis i appen» although payment is missing
  paused_at              timestamptz,
  approved_at            timestamptz,
  approved_by            text,
  rejected_reason        text,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  hold_expires_at        timestamptz,               -- Hovedpartner slot hold during checkout (30 min)
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- paying partners must have the business + contact details
  check (billing_mode = 'free'
         or (org_nr is not null and legal_name is not null and contact_name is not null and contact_email is not null))
);
create index if not exists partner_accounts_status_idx on public.partner_accounts(status, package);
alter table public.partner_accounts enable row level security;   -- no policies: website (postgres) only

-- ---------- Visibility (THE rule; app + website). Partners without an account keep today's rule: active ----------
create or replace function public.partner_is_visible(p_partner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.active and (
             a.partner_id is null
             or (a.status = 'active' and not a.admin_hidden and (
                   a.billing_mode = 'free'
                   or a.admin_force_visible
                   or a.payment_state in ('paid','upcoming')
                   or (a.payment_state in ('failed','overdue')
                       and a.payment_due_since > now() - make_interval(days => setting_int('billing.grace_days', 7))))))
      from partners p left join partner_accounts a on a.partner_id = p.id
     where p.id = p_partner_id), false)
$$;
revoke all on function public.partner_is_visible(uuid) from public, anon;
grant execute on function public.partner_is_visible(uuid) to authenticated;

-- App users only see visible partners (was: active or is_admin()). Unpaid partners vanish from the app
-- after the grace period with no app change and no cron.
drop policy if exists p_partners_read on public.partners;
create policy p_partners_read on public.partners for select to authenticated
  using (public.partner_is_visible(id) or public.is_admin());

-- ---------- Hovedpartner limit (setting, default 4, all of Innlandet) ----------
-- Taken = website partners in a holding state + legacy hovedpartnere (active placement, no account row).
create or replace function public.hovedpartner_taken(p_exclude uuid default null)
returns int language sql stable security definer set search_path = public as $$
  select ((select count(*) from partner_accounts a
            where a.package = 'hoved' and a.partner_id is distinct from p_exclude
              and (a.status in ('pending_approval','active','paused')
                   or (a.status = 'pending_payment' and a.hold_expires_at > now())))
        + (select count(distinct pp.partner_id) from partner_placements pp
            where pp.surface = 'fellesskap' and pp.active and pp.partner_id is distinct from p_exclude
              and not exists (select 1 from partner_accounts a where a.partner_id = pp.partner_id)))::int
$$;
revoke all on function public.hovedpartner_taken(uuid) from public, anon, authenticated;

create or replace function public.hovedpartner_slots()
returns table(max_slots int, taken int, free int) language sql stable security definer set search_path = public as $$
  select setting_int('partners.max_hovedpartnere', 4), hovedpartner_taken(),
         greatest(setting_int('partners.max_hovedpartnere', 4) - hovedpartner_taken(), 0)
$$;
revoke all on function public.hovedpartner_slots() from public, anon;
grant execute on function public.hovedpartner_slots() to authenticated;

create or replace function public.partner_accounts_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_holding boolean := new.package = 'hoved' and (new.status in ('pending_approval','active','paused')
                       or (new.status = 'pending_payment' and new.hold_expires_at > now()));
  v_was     boolean := tg_op = 'UPDATE' and old.package = 'hoved' and (old.status in ('pending_approval','active','paused')
                       or (old.status = 'pending_payment' and old.hold_expires_at > now()));
begin
  -- only check when the row starts holding a slot, so lowering the max never blocks existing partners
  if v_holding and not v_was then
    perform pg_advisory_xact_lock(hashtext('minnabo.hovedpartner_slots'));
    if hovedpartner_taken(new.partner_id) >= setting_int('partners.max_hovedpartnere', 4) then
      raise exception 'HOVEDPARTNER_FULL' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists partner_accounts_before on public.partner_accounts;
create trigger partner_accounts_before before insert or update on public.partner_accounts
  for each row execute function public.partner_accounts_before();

-- Keeps the app's tier columns in step with the package, so the app needs no change:
--   hoved → active 'fellesskap' placement · helt → local_hero · stottespiller → neither
create or replace function public.partner_accounts_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update partners set
    local_hero    = (new.package = 'helt'),
    active        = (new.status = 'active'),
    partner_since = case when new.status = 'active' then coalesce(partner_since, (now() at time zone 'Europe/Oslo')::date)
                         else partner_since end,
    updated_at    = now()
   where id = new.partner_id;
  if new.package = 'hoved' then
    update partner_placements set active = true where partner_id = new.partner_id and surface = 'fellesskap';
    if not found then
      insert into partner_placements (partner_id, surface, headline, active)
        values (new.partner_id, 'fellesskap', 'Hovedpartner', true);
    end if;
  else
    update partner_placements set active = false where partner_id = new.partner_id and surface = 'fellesskap';
  end if;
  return new;
end $$;
drop trigger if exists partner_accounts_sync on public.partner_accounts;
create trigger partner_accounts_sync after insert or update of package, status on public.partner_accounts
  for each row execute function public.partner_accounts_sync();

-- Any partner change (website or app admin) bumps partners.version → the app refetches.
drop trigger if exists partners_bump_version on public.partners;
create trigger partners_bump_version after insert or update or delete on public.partners
  for each statement execute function public.bump_partners_version();
drop trigger if exists partner_accounts_bump_version on public.partner_accounts;
create trigger partner_accounts_bump_version after insert or update or delete on public.partner_accounts
  for each statement execute function public.bump_partners_version();
drop trigger if exists partner_placements_bump_version on public.partner_placements;
create trigger partner_placements_bump_version after insert or update or delete on public.partner_placements
  for each statement execute function public.bump_partners_version();

-- App function re-created: same signature/behaviour, but uses the shared count + the setting.
create or replace function public.admin_set_main_partner(p_partner_id uuid, p_main boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  if p_main then
    perform pg_advisory_xact_lock(hashtext('minnabo.hovedpartner_slots'));
    if hovedpartner_taken(p_partner_id) >= setting_int('partners.max_hovedpartnere', 4) then
      raise exception 'Maks % hovedpartnere.', setting_int('partners.max_hovedpartnere', 4);
    end if;
    update partner_placements set active = true where partner_id = p_partner_id and surface = 'fellesskap';
    if not found then
      insert into partner_placements (partner_id, surface, headline, active)
        values (p_partner_id, 'fellesskap', 'Hovedpartner', true);
    end if;
    -- a hovedpartner is not also a lokal helt
    update partners set active = true, local_hero = false where id = p_partner_id;
  else
    update partner_placements set active = false where partner_id = p_partner_id and surface = 'fellesskap';
  end if;
end $$;

-- Free partners already in the app (seed 0025): Webiser and Håndverker Innlandet, both hovedpartnere today.
-- They get a «Gratis» account so the website admin can view and change them like any other partner.
insert into public.partner_accounts (partner_id, billing_mode, package, status, approved_at, approved_by)
select p.id, 'free', 'hoved', 'active', now(), 'migration'
  from public.partners p
 where p.id in ('6b1f3c2e-0000-4000-8000-000000000001', '6b1f3c2e-0000-4000-8000-000000000002')
on conflict (partner_id) do nothing;

-- What the public website (and the app, if it wants) reads. Filter is applied here because the view runs as owner.
create or replace view public.partners_public as
select p.id, p.name, p.blurb, p.url, p.logo_path, p.cover_path, p.municipality, k.region, p.category_slug,
       case when a.partner_id is not null then a.package
            when exists (select 1 from partner_placements pp
                          where pp.partner_id = p.id and pp.surface = 'fellesskap' and pp.active) then 'hoved'
            when p.local_hero then 'helt'
            else 'stottespiller' end as package,
       p.about, p.offer, p.address, p.phone, p.email, p.opening_hours, p.gallery,
       p.partner_since, p.sort_order
  from public.partners p
  left join public.partner_accounts a on a.partner_id = p.id
  left join public.kommuner k on k.name = p.municipality
 where public.partner_is_visible(p.id);
revoke all on public.partners_public from public, anon, authenticated;
grant select on public.partners_public to anon, authenticated;

-- ---------- Partner portal tables (website only) ----------
create table if not exists public.partner_profile_changes (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  changes      jsonb not null,        -- {"name":…, "blurb":…, "logo_path":…, "url":…, "category_slug":…}
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason       text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  text
);
create unique index if not exists partner_profile_changes_one_pending
  on public.partner_profile_changes(partner_id) where status = 'pending';
alter table public.partner_profile_changes enable row level security;

create table if not exists public.partner_events (
  id          bigserial primary key,
  partner_id  uuid not null references public.partners(id) on delete cascade,
  kind        text not null check (kind in ('impression','click')),
  source      text not null check (source in ('app','web')),
  kommune     text,
  created_at  timestamptz not null default now()
);
create index if not exists partner_events_idx on public.partner_events(partner_id, created_at);
alter table public.partner_events enable row level security;

create or replace function public.log_partner_event(p_partner uuid, p_kind text, p_kommune text default null)
returns void language sql security definer set search_path = public as $$
  insert into partner_events(partner_id, kind, source, kommune)
  select p_partner, p_kind, 'app', p_kommune
   where p_kind in ('impression','click') and partner_is_visible(p_partner)
$$;
revoke all on function public.log_partner_event(uuid, text, text) from public, anon;
grant execute on function public.log_partner_event(uuid, text, text) to authenticated;

create table if not exists public.partner_invoices (
  stripe_invoice_id   text primary key,
  partner_id          uuid references public.partners(id) on delete set null,
  number              text,
  status              text not null,     -- draft | open | paid | void | uncollectible | credited
  collection_method   text,              -- charge_automatically | send_invoice
  amount_excl         int not null,      -- øre
  vat                 int not null,      -- øre
  amount_incl         int not null,      -- øre
  amount_remaining    int not null default 0,
  currency            text not null default 'nok',
  period_start        timestamptz,
  period_end          timestamptz,
  due_date            timestamptz,
  paid_at             timestamptz,
  hosted_invoice_url  text,
  invoice_pdf         text,
  last_payment_error  text,
  created_at          timestamptz not null,
  updated_at          timestamptz not null default now()
);
create index if not exists partner_invoices_partner_idx on public.partner_invoices(partner_id, created_at desc);
alter table public.partner_invoices enable row level security;

create table if not exists public.stripe_events (
  id            text primary key,
  type          text not null,
  payload       jsonb,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);
alter table public.stripe_events enable row level security;

create table if not exists public.partner_reminders (
  id          bigserial primary key,
  partner_id  uuid not null references public.partners(id) on delete cascade,
  invoice_id  text,
  step        text not null,          -- 'upcoming' | 'd0' | 'd3' | 'd7' | 'visible_again' | 'cancel_confirm' | 'manual-<ts>'
  sent_at     timestamptz not null default now(),
  unique (invoice_id, step)
);
alter table public.partner_reminders enable row level security;


-- =====================================================================================
-- 5. Donations: EXISTING donation_records (recipient, amount_kr, period, transferred_at) + NEW clubs
-- =====================================================================================
create table if not exists public.clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text,                    -- Idrettslag, Korps, Speidergruppe, …
  kommune     text not null,           -- = kommuner.name
  org_nr      text check (org_nr ~ '^[0-9]{9}$'),
  active      boolean not null default true,
  suggested   boolean not null default false,  -- from the public «Kjenner du et lag?» form
  created_at  timestamptz not null default now()
);
alter table public.clubs enable row level security;

alter table public.donation_records
  add column if not exists club_id    uuid references public.clubs(id) on delete set null,
  add column if not exists status     text not null default 'transferred',
  add column if not exists note       text,
  add column if not exists reference  text,
  add column if not exists created_at timestamptz not null default now();
alter table public.donation_records alter column transferred_at drop not null;   -- planned payouts have none
do $$ begin
  alter table public.donation_records add constraint donation_records_status_check
    check (status in ('planned','transferred') and ((status = 'transferred') = (transferred_at is not null)));
exception when duplicate_object then null; end $$;

-- The app shows every row as «Overført»: only expose transferred rows (was: using (true)).
drop policy if exists p_donations_read on public.donation_records;
create policy p_donations_read on public.donation_records for select to authenticated
  using (status = 'transferred');


-- =====================================================================================
-- 6. News, public forms, audit log (website only)
-- =====================================================================================
create table if not exists public.news_articles (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  excerpt       text,
  body_html     text not null default '',     -- sanitised server-side (nh3)
  category      text not null,                -- Oppdateringer | Fellesskap | Partnere | Trygghet | Lansering | Tips
  cover_color   text not null default '#EDF8D6',
  cover_icon    text,
  cover_image   text,
  author_name   text not null default 'MinNabo-teamet',
  reading_min   int,
  status        text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  publish_at    timestamptz,
  published_at  timestamptz,
  show_in_app   boolean not null default false,
  partner_ids   uuid[] not null default '{}', -- articles that mention partners («Les nyheten» on Fellesskap)
  views         int not null default 0,
  helpful_yes   int not null default 0,
  helpful_no    int not null default 0,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists news_articles_published_idx on public.news_articles(status, published_at desc);
alter table public.news_articles enable row level security;

create or replace view public.news_public as
  select id, slug, title, excerpt, body_html, category, cover_color, cover_icon, cover_image,
         author_name, reading_min, published_at
    from public.news_articles where status = 'published' and show_in_app;
-- simple views are auto-updatable: grant SELECT only
revoke all on public.news_public from public, anon, authenticated;
grant select on public.news_public to authenticated;

create table if not exists public.newsletter_subscribers (
  email         text primary key,
  topics        text[] not null default '{}',
  status        text not null default 'pending' check (status in ('pending','confirmed','unsubscribed')),
  token         text not null,
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);
alter table public.newsletter_subscribers enable row level security;

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('hjelp','bedrift','presse','lag_forslag')),
  name        text,
  company     text,
  email       text not null,
  subject     text,
  message     text,
  meta        jsonb not null default '{}',  -- e.g. lag_forslag: {"lag":…, "kommune":…}
  handled     boolean not null default false,
  handled_by  text,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists contact_messages_kind_idx on public.contact_messages(kind, handled, created_at desc);
alter table public.contact_messages enable row level security;

create table if not exists public.admin_audit_log (
  id           bigserial primary key,
  at           timestamptz not null default now(),
  actor_id     text, actor_email text, actor_role text,
  action       text not null,         -- e.g. 'listing.hide', 'user.suspend', 'partner.approve'
  target_type  text, target_id text,
  before       jsonb, after jsonb,
  ip           inet, user_agent text
);
create index if not exists admin_audit_log_at_idx on public.admin_audit_log(at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log(target_type, target_id);
alter table public.admin_audit_log enable row level security;


-- =====================================================================================
-- 7. Moderation on EXISTING app tables
-- =====================================================================================

-- ---------- Oppdrag: reuse listings.admin_hidden; add the why/who/when ----------
alter table public.listings
  add column if not exists hidden_reason text,
  add column if not exists hidden_at     timestamptz,
  add column if not exists hidden_by     text;

create or replace function public.guard_listing_hidden() returns trigger
language plpgsql as $$
begin
  if not is_admin() and current_user = 'authenticated' then
    new.admin_hidden  := old.admin_hidden;
    new.hidden_reason := old.hidden_reason;
    new.hidden_at     := old.hidden_at;
    new.hidden_by     := old.hidden_by;
  end if;
  return new;
end $$;

-- ---------- Reports: keep the OPEN/RESOLVED enum; «Under behandling» = OPEN + claimed ----------
alter table public.reports
  add column if not exists claimed_at        timestamptz,
  add column if not exists claimed_by        text,      -- staff id/e-mail
  add column if not exists resolved_by_staff text,      -- resolved_by references profiles; staff go here
  add column if not exists resolution_note   text;
create index if not exists reports_status_idx on public.reports(status, created_at desc);

-- ---------- Users: private moderation data (profiles is readable by every app user) ----------
create table if not exists public.profile_moderation (
  profile_id         uuid primary key references public.profiles(id) on delete cascade,
  suspended_until    timestamptz,             -- null while suspended = permanent
  suspension_reason  text,
  warning_count      int not null default 0,
  last_warned_at     timestamptz,
  updated_at         timestamptz not null default now(),
  updated_by         text
);
alter table public.profile_moderation enable row level security;
do $$ begin
  create policy profile_moderation_own on public.profile_moderation for select to authenticated
    using (profile_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ---------- Bedrift verification ----------
alter table public.business_profiles
  add column if not exists rejection_reason text,
  add column if not exists decided_by_staff text;

-- ---------- Shared moderation logic --------------------------------------------------
-- Bodies moved out of the app's admin_* RPCs, unchanged except where noted, so the app's admin panel and
-- the website run the same code. Not callable by app users. The admin_* wrappers keep their signatures.

create or replace function public.moderation_decide_report(p_report_id uuid, p_outcome text, p_resolved_by uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare r reports; v_owner uuid; v_undo jsonb := null;
begin
  if p_outcome not in ('dismiss','remove','warn') then raise exception 'Ukjent utfall.'; end if;
  select * into r from reports where id = p_report_id for update;
  if not found then raise exception 'Fant ikke rapporten.'; end if;
  if r.status = 'RESOLVED' then return; end if;
  v_owner := report_target_owner(r.target_type, r.target_id);

  if p_outcome = 'remove' then
    case r.target_type::text
      when 'LISTING' then
        -- added: hidden_reason / hidden_at
        update listings set admin_hidden = true, hidden_reason = r.reason, hidden_at = now() where id::text = r.target_id;
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
    -- added: count warnings for Admin › Brukere («Advart»)
    if v_owner is not null then
      insert into profile_moderation (profile_id, warning_count, last_warned_at) values (v_owner, 1, now())
      on conflict (profile_id) do update
        set warning_count = profile_moderation.warning_count + 1, last_warned_at = now(), updated_at = now();
    end if;
  end if;

  update reports set status = 'RESOLVED', outcome = p_outcome, undo = v_undo,
         resolved_by = p_resolved_by, resolved_at = now()
   where id = p_report_id;

  perform notify_moderation(r.by_profile_id, 'Rapporten din er behandlet',
    'Takk for at du sa fra. Vi har sett på rapporten om «' || r.reason || '».', null);
end $$;

create or replace function public.admin_decide_report(p_report_id uuid, p_outcome text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  perform moderation_decide_report(p_report_id, p_outcome, auth.uid());
end $$;

create or replace function public.moderation_reopen_report(p_report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r reports; v_owner uuid;
begin
  select * into r from reports where id = p_report_id for update;
  if not found or r.status = 'OPEN' then return; end if;
  if r.outcome = 'remove' then
    v_owner := report_target_owner(r.target_type, r.target_id);
    case r.target_type::text
      when 'LISTING' then
        update listings set admin_hidden = false, hidden_reason = null, hidden_at = null, hidden_by = null
         where id::text = r.target_id;
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
  update reports set status = 'OPEN', outcome = null, undo = null, resolved_by = null, resolved_at = null,
         resolved_by_staff = null, resolution_note = null
   where id = p_report_id;
end $$;

create or replace function public.admin_reopen_report(p_report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  perform moderation_reopen_report(p_report_id);
end $$;

create or replace function public.moderation_set_listing_hidden(p_listing_id uuid, p_hidden boolean,
                                                                p_reason text default null, p_by text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text;
begin
  update listings set admin_hidden = p_hidden,
         hidden_reason = case when p_hidden then p_reason end,
         hidden_at     = case when p_hidden then now() end,
         hidden_by     = case when p_hidden then p_by end
   where id = p_listing_id returning owner_id, title into v_owner, v_title;
  if p_hidden then
    perform notify_moderation(v_owner, 'Oppdraget ditt er skjult',
      '«' || v_title || '» bryter med reglene for MinNabo og vises ikke for andre.', '/mine');
  end if;
end $$;

create or replace function public.admin_set_listing_hidden(p_listing_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  perform moderation_set_listing_hidden(p_listing_id, p_hidden);
end $$;

-- p_until: null = permanent. The existing trigger profiles_suspension_ban bans/unbans the auth user.
create or replace function public.moderation_set_suspended(p_profile_id uuid, p_suspended boolean,
                                                           p_until timestamptz default null, p_reason text default null,
                                                           p_by text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set suspended_at = case when p_suspended then coalesce(suspended_at, now()) end
   where id = p_profile_id;
  insert into profile_moderation (profile_id, suspended_until, suspension_reason, updated_by)
    values (p_profile_id, case when p_suspended then p_until end, case when p_suspended then p_reason end, p_by)
  on conflict (profile_id) do update
    set suspended_until = excluded.suspended_until, suspension_reason = excluded.suspension_reason,
        updated_by = excluded.updated_by, updated_at = now();
  if p_suspended then
    perform notify_moderation(p_profile_id, 'Kontoen din er suspendert',
      'Du kan ikke legge ut, gi tilbud eller sende meldinger før saken er behandlet. Kontakt MinNabo hvis du mener dette er feil.', '/vilkar');
  else
    perform notify_moderation(p_profile_id, 'Kontoen din er aktiv igjen', 'Du kan bruke MinNabo som vanlig.', null);
  end if;
end $$;

create or replace function public.admin_set_suspended(p_profile_id uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  if p_profile_id = auth.uid() then raise exception 'Du kan ikke suspendere deg selv.'; end if;
  perform moderation_set_suspended(p_profile_id, p_suspended);
end $$;

-- Timed suspensions end here (a late run only means a slightly longer suspension).
create or replace function public.lift_expired_suspensions()
returns int language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int := 0;
begin
  for v_id in
    select m.profile_id from profile_moderation m join profiles p on p.id = m.profile_id
     where p.suspended_at is not null and m.suspended_until is not null and m.suspended_until <= now()
  loop
    perform moderation_set_suspended(v_id, false, null, null, 'system');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.moderation_decide_business(p_profile_id uuid, p_approve boolean,
                                                             p_reason text default null, p_by text default null)
returns void language plpgsql security definer set search_path = public as $$
declare b business_profiles;
begin
  update business_profiles
     set status = case when p_approve then 'APPROVED' else 'REJECTED' end::business_status,
         decided_at = now(),
         rejection_reason = case when p_approve then null else p_reason end,
         decided_by_staff = p_by
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
      'Sjekk opplysningene om ' || b.company_name || ' og send inn på nytt.'
      || coalesce(' Grunn: ' || nullif(btrim(p_reason), '') || '.', ''), '/bedrift');
  end if;
end $$;

create or replace function public.admin_decide_business(p_profile_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  perform moderation_decide_business(p_profile_id, p_approve);
end $$;

-- Internal functions: website (postgres) + the admin_* wrappers only. Supabase grants new functions to
-- anon/authenticated by default, so revoke explicitly.
revoke all on function public.moderation_decide_report(uuid, text, uuid)                       from public, anon, authenticated;
revoke all on function public.moderation_reopen_report(uuid)                                   from public, anon, authenticated;
revoke all on function public.moderation_set_listing_hidden(uuid, boolean, text, text)         from public, anon, authenticated;
revoke all on function public.moderation_set_suspended(uuid, boolean, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.moderation_decide_business(uuid, boolean, text, text)            from public, anon, authenticated;
revoke all on function public.lift_expired_suspensions()                                       from public, anon, authenticated;
revoke all on function public.bump_partners_version()                                          from public, anon, authenticated;

select cron.schedule('minnabo-lift-suspensions', '*/10 * * * *', 'select public.lift_expired_suspensions()');


-- =====================================================================================
-- 8. Realtime: tables the app listens to (views are not in the publication; listen to the base table)
-- =====================================================================================
do $$
declare t text;
begin
  foreach t in array array['partners','partner_placements','categories','kommuner','app_settings','donation_records'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
-- Realtime respects RLS: when a partner becomes hidden the app gets no row event for it.
-- The app must listen to app_settings 'partners.version' (bumped by trigger on every partner change) and refetch.


-- =====================================================================================
-- 9. Storage: partner logos + news images (public read; only the service role writes)
-- =====================================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-web', 'public-web', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
-- partners.logo_path stores the FULL public URL (existing rows already hold full https URLs).
