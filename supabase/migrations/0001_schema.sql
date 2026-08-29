-- 0001_schema.sql — MinNabo core schema (spec §3)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------------
create type listing_type as enum ('TASK_REQUEST','SERVICE_OFFER');
create type price_mode as enum ('FIXED','BUDGET','FROM','BY_AGREEMENT');
create type listing_status as enum (
  'DRAFT','PUBLISHED','RECEIVING_OFFERS','OFFER_ACCEPTED','AGREED','IN_PROGRESS',
  'COMPLETION_SENT','COMPLETED','REVIEWED','CANCELLED','EXPIRED','REMOVED',
  'ACTIVE','PAUSED','ARCHIVED');
create type verification_kind as enum ('PHONE','EMAIL','BUSINESS');
create type business_status as enum ('PENDING','APPROVED','REJECTED');
create type message_kind as enum ('TEXT','PROPOSAL','SYSTEM','IMAGE');
create type proposal_status as enum ('DRAFT','SENT','WITHDRAWN','DECLINED','ACCEPTED','REVISION_PENDING');
create type report_target as enum ('USER','LISTING','PROPOSAL','MESSAGE','REVIEW');
create type report_status as enum ('OPEN','RESOLVED');
create type notification_kind as enum (
  'NEW_MESSAGE','NEW_OFFER','OFFER_CHANGED','OFFER_WITHDRAWN','OFFER_ACCEPTED',
  'OFFER_DECLINED','AGREED_TIME','COMPLETION_REQUESTED','REVIEW_RECEIVED','MODERATION');
create type purpose as enum ('NEED_HELP','WANT_JOBS','BOTH');

-- ---------------------------------------------------------------------------
-- identity & profile
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Nabo',
  avatar_path text,
  initials text not null default 'N',
  presentation text,
  member_since text not null default to_char(now(),'YYYY'),
  municipality text,
  place text,
  purpose purpose default 'BOTH',
  max_distance_km int default 15,
  is_business boolean not null default false,
  role text not null default 'user' check (role in ('user','admin')),
  onboarded_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table verifications (
  profile_id uuid not null references profiles(id) on delete cascade,
  kind verification_kind not null,
  verified boolean not null default false,
  explanation text not null default '',
  verified_at timestamptz,
  primary key (profile_id, kind)
);

create table business_profiles (
  profile_id uuid primary key references profiles(id) on delete cascade,
  org_nr text not null,
  company_name text not null,
  contact_person text not null,
  email text not null,
  phone text not null,
  status business_status not null default 'PENDING',
  category_slugs text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table consent_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  terms boolean not null,
  privacy boolean not null,
  age boolean not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- catalog & listings
-- ---------------------------------------------------------------------------
create table categories (
  slug text primary key,
  label text not null,
  icon text not null
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  type listing_type not null,
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  category_slug text not null references categories(slug),
  price_amount_minor bigint,
  price_currency text not null default 'NOK',
  price_mode price_mode not null,
  municipality text not null,
  place text not null,
  status listing_status not null default 'PUBLISHED',
  search tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index listings_search_idx on listings using gin (search);
create index listings_type_status_idx on listings (type, status);
create index listings_owner_idx on listings (owner_id);
create index listings_category_idx on listings (category_slug);

create table task_details (
  listing_id uuid primary key references listings(id) on delete cascade,
  description text not null,
  equipment text,
  meeting_note text,
  duration_text text,
  scheduled_text text
);

create table service_offer_details (
  listing_id uuid primary key references listings(id) on delete cascade,
  about text not null,
  experience_years int,
  completed_jobs int,
  services text[] not null default '{}',
  availability_text text,
  equipment_text text,
  max_distance_km int
);

create table listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  storage_path text not null,
  ord int not null default 0
);

create table saved_listings (
  profile_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, listing_id)
);

create table saved_searches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  filter jsonb not null default '{}',
  sort text not null default 'RELEVANCE',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- conversations, proposals, agreements
-- ---------------------------------------------------------------------------
create table conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  created_at timestamptz not null default now()
);
create index conversations_listing_idx on conversations (listing_id);

create table conversation_participants (
  conversation_id uuid not null references conversations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (conversation_id, profile_id)
);
create index conv_participants_profile_idx on conversation_participants (profile_id);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  price_amount_minor bigint not null,
  price_currency text not null default 'NOK',
  message text,
  scheduled_text text,
  caveats text,
  status proposal_status not null default 'SENT',
  client_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index proposals_listing_idx on proposals (listing_id);
create index proposals_to_idx on proposals (to_profile_id);
create index proposals_conversation_idx on proposals (conversation_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  kind message_kind not null default 'TEXT',
  text text not null default '',
  proposal_id uuid references proposals(id) on delete set null,
  attachment_path text,
  client_token text,
  created_at timestamptz not null default now(),
  unique (conversation_id, author_id, client_token)
);
create index messages_conversation_idx on messages (conversation_id, created_at);

create table message_reads (
  conversation_id uuid not null references conversations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create table proposal_revisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  actor_id uuid not null references profiles(id) on delete cascade,
  note text,
  price_amount_minor bigint,
  scheduled_text text,
  caveats text,
  created_at timestamptz not null default now()
);

create table agreement_snapshots (
  proposal_id uuid primary key references proposals(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  price_amount_minor bigint not null,
  price_currency text not null default 'NOK',
  scheduled_text text,
  description text not null default '',
  caveats text,
  agreed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- completion, reviews, safety, notifications
-- ---------------------------------------------------------------------------
create table completion_confirmations (
  agreement_proposal_id uuid not null references agreement_snapshots(proposal_id) on delete cascade,
  by_profile_id uuid not null references profiles(id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  primary key (agreement_proposal_id, by_profile_id)
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  agreement_proposal_id uuid not null references agreement_snapshots(proposal_id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (agreement_proposal_id, from_profile_id)
);
create index reviews_to_idx on reviews (to_profile_id);

create table reports (
  id uuid primary key default gen_random_uuid(),
  target_type report_target not null,
  target_id text not null,
  reason text not null,
  details text,
  by_profile_id uuid not null references profiles(id) on delete cascade,
  status report_status not null default 'OPEN',
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table blocks (
  by_profile_id uuid not null references profiles(id) on delete cascade,
  blocked_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (by_profile_id, blocked_profile_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  kind notification_kind not null,
  title text not null,
  body text not null,
  route text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_profile_idx on notifications (profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- read-only content (seeded, no CMS this phase)
-- ---------------------------------------------------------------------------
create table partners (
  id uuid primary key default gen_random_uuid(),
  name text not null, blurb text not null, logo_path text, url text
);
create table partner_placements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  surface text not null, headline text not null, active boolean not null default true
);
create table donation_records (
  id uuid primary key default gen_random_uuid(),
  recipient text not null, amount_kr int not null, period text not null,
  transferred_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- views
-- ---------------------------------------------------------------------------
create view profile_ratings as
  select to_profile_id as profile_id,
         round(avg(rating)::numeric, 1) as average,
         count(*)::int as count
  from reviews group by to_profile_id;

-- ---------------------------------------------------------------------------
-- functions & triggers
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger t_profiles_touch before update on profiles
  for each row execute function touch_updated_at();
create trigger t_listings_touch before update on listings
  for each row execute function touch_updated_at();
create trigger t_proposals_touch before update on proposals
  for each row execute function touch_updated_at();

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text; ini text;
begin
  nm := coalesce(new.raw_user_meta_data->>'display_name',
                 split_part(new.email,'@',1), 'Nabo');
  ini := upper(left(regexp_replace(nm,'[^A-Za-zÆØÅæøå]','','g'), 2));
  insert into public.profiles (id, display_name, initials)
    values (new.id, nm, coalesce(nullif(ini,''),'N'));
  insert into public.verifications (profile_id, kind, verified, explanation, verified_at)
    values (new.id,'EMAIL', true,
            'E-postadressen din er bekreftet ved innlogging.', now());
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function listings_search_tsv() returns trigger
language plpgsql as $$
begin
  new.search := to_tsvector('simple',
    coalesce(new.title,'') || ' ' || coalesce(new.place,'') || ' ' || coalesce(new.category_slug,''));
  return new;
end $$;
create trigger t_listings_search before insert or update on listings
  for each row execute function listings_search_tsv();

create or replace function bump_conversation() returns trigger
language plpgsql as $$
begin
  update conversations set
    last_message_at = new.created_at,
    last_message_preview = case new.kind
      when 'TEXT' then left(new.text, 120)
      when 'IMAGE' then '📷 Bilde'
      when 'PROPOSAL' then 'Sendte et tilbud'
      when 'SYSTEM' then new.text end
  where id = new.conversation_id;
  return new;
end $$;
create trigger t_messages_bump after insert on messages
  for each row execute function bump_conversation();
