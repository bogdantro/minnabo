# MinNabo Supabase Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MinNabo's in-memory mock data layer with a real Supabase backend so every function (auth, profiles, verification, listings, search, saved items, proposals, agreements, chat, completion, reviews, reports, blocks, notifications, image uploads) persists server-side and works end-to-end across two accounts.

**Architecture:** Supabase (Postgres + Auth + Storage + Realtime + RLS). The app keeps the `apiClient` method surface and the `queries.ts` React Query hook signatures unchanged — a new `SupabaseApiClient` implements the same interface, and `MockApiClient` is retained for Jest. Reads use RLS-guarded table access; rules-heavy mutations (proposal state machine, agreement snapshot, completion, reviews, reports) are Postgres `SECURITY DEFINER` RPC functions. Realtime subscriptions invalidate React Query keys.

**Tech Stack:** Expo SDK 57 / React Native 0.86 / expo-router 57 / TanStack Query v5 / TypeScript; `@supabase/supabase-js` v2; Supabase CLI (hosted project, no Docker); `expo-image-picker`, `expo-image-manipulator`, `@tanstack/query-async-storage-persister`.

**Spec:** `docs/superpowers/specs/2026-08-29-minnabo-supabase-backend-design.md`

## Global Constraints

- **Norwegian bokmål only** for all user-facing copy; light theme only; **no payment handling or payment tables — ever** (spec §23).
- Price is always stored as `amount_minor bigint` + `currency text default 'NOK'`.
- `listing.type` is a stored enum `TASK_REQUEST | SERVICE_OFFER`, never inferred from text.
- Profile avatar top-right only on the main tab screens (Oppdrag / Fellesskap / Innboks) and listing-related detail screens — NOT on `/legg-ut/*` or `/oppdrag/[id]` (already done).
- Design tokens in `src/theme/tokens.ts` are the only source of colour/spacing; components never hardcode hex.
- `IS_TEST = process.env.NODE_ENV === 'test'` — Jest must never hit the network; it always uses `MockApiClient`.
- Supabase project ref: `hvxuzvhzsaocsnwznsai` — URL `https://hvxuzvhzsaocsnwznsai.supabase.co`.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`) live only in gitignored `.env` and are never imported by any file under `src/` or `app/`. Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` reach the bundle.
- All commits: `git -c core.autocrlf=false -c user.email=kontaktwebiser@gmail.com -c user.name="Bibi" commit`, message body ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Commit directly to `main`.
- After any task that touches `src/` or `app/`: `npm run typecheck` and `npm test` must be green before the commit. After the final task in an arc: `npx expo export --platform ios` must succeed.

---

## Prerequisites (human, one-time)

Before Task 1 the user must supply, pasted into a gitignored `.env` at repo root:

```
EXPO_PUBLIC_SUPABASE_URL=https://hvxuzvhzsaocsnwznsai.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_pmY85Uq6vbw9qwlsgTRzig_dx4zD-9j
SUPABASE_DB_PASSWORD=<the real DB password>
SUPABASE_SERVICE_ROLE_KEY=<sb_secret_... from dashboard > Project Settings > API>
SUPABASE_ACCESS_TOKEN=<personal token from supabase.com/dashboard/account/tokens>
```

If `SUPABASE_ACCESS_TOKEN` is not provided, the user runs `npx supabase login` interactively once instead.

---

## Task 1: Supabase CLI wiring, client library, dependencies

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `.env.example`
- Modify: `.gitignore` (add `.env`, `supabase/.temp`, `supabase/.branches`)
- Create: `src/lib/supabase.ts`
- Create: `src/lib/env.ts`
- Modify: `package.json` (deps + scripts)
- Modify: `app.config.ts` or create it if only `app.json` exists — to pass env through (verify current state first)
- Modify: `jest-setup.ts` (mock `@supabase/supabase-js` and `src/lib/supabase`)

**Interfaces:**
- Produces: `supabase` (the `SupabaseClient` singleton) from `src/lib/supabase.ts`; `ENV` object from `src/lib/env.ts` with `supabaseUrl: string`, `supabaseAnonKey: string`.

- [ ] **Step 1: Install dependencies**

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
npm install --save-dev supabase
npx expo install expo-image-picker expo-image-manipulator
npm install @tanstack/query-async-storage-persister @tanstack/react-query-persist-client
```

`@react-native-async-storage/async-storage` is already a dep — `expo install` will confirm the pinned version. `supabase` (CLI) as devDependency avoids `npx` re-downloading it each run.

- [ ] **Step 2: Init and link the Supabase project**

```bash
npx supabase init          # creates supabase/config.toml, supabase/.gitignore
# login: either
npx supabase login         # interactive, if no SUPABASE_ACCESS_TOKEN
# or rely on SUPABASE_ACCESS_TOKEN env var
set -a; source .env; set +a
npx supabase link --project-ref hvxuzvhzsaocsnwznsai --password "$SUPABASE_DB_PASSWORD"
```

Expected: `Finished supabase link.` and `supabase/config.toml` now has `project_id = "hvxuzvhzsaocsnwznsai"`.

- [ ] **Step 3: Add `.env.example` and update `.gitignore`**

`.env.example`:
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_DB_PASSWORD=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ACCESS_TOKEN=
```

Append to `.gitignore`:
```
.env
supabase/.temp/
supabase/.branches/
```

- [ ] **Step 4: Create `src/lib/env.ts`**

```ts
// Reads EXPO_PUBLIC_* vars (inlined by Expo at build time). No secrets here.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in dev; tests mock this module so they never hit this.
  throw new Error(
    'Mangler EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Kopier .env.example til .env.',
  );
}

export const ENV = { supabaseUrl, supabaseAnonKey } as const;
```

- [ ] **Step 5: Create `src/lib/supabase.ts`**

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { ENV } from './env';
import type { Database } from './database.types';

export const supabase = createClient<Database>(ENV.supabaseUrl, ENV.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Pause token auto-refresh when the app is backgrounded (Supabase RN guidance).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

Install the polyfill too: `npx expo install react-native-url-polyfill`. `database.types.ts` does not exist yet — create a stub so this compiles:

`src/lib/database.types.ts`:
```ts
// Regenerated by `npm run db:types` after each migration. Stub until Task 2.
export type Database = Record<string, never>;
```

- [ ] **Step 6: Add npm scripts**

In `package.json` `scripts`:
```json
"db:push": "supabase db push",
"db:types": "supabase gen types typescript --project-id hvxuzvhzsaocsnwznsai > src/lib/database.types.ts",
"db:seed:static": "supabase db push && psql \"$SUPABASE_DB_URL\" -f supabase/seed_static.sql",
"seed:demo": "tsx scripts/seed-demo.ts",
"test:backend": "tsx scripts/test-backend.ts"
```

Add `tsx` as a devDependency: `npm install --save-dev tsx`. Note `SUPABASE_DB_URL` is the pooler/direct connection string from `.env` — document in `.env.example`:
```
SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.hvxuzvhzsaocsnwznsai.supabase.co:5432/postgres
```

- [ ] **Step 7: Mock Supabase in Jest**

In `jest-setup.ts`, add near the other `jest.mock` calls:
```ts
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
      verifyOtp: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      track: jest.fn(),
      presenceState: jest.fn().mockReturnValue({}),
    }),
    removeChannel: jest.fn(),
  },
}));
jest.mock('@/lib/env', () => ({ ENV: { supabaseUrl: 'http://test', supabaseAnonKey: 'test' } }));
```

- [ ] **Step 8: Verify typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS (93 tests). `src/lib/supabase.ts` is only imported by nothing yet — it must still compile.

- [ ] **Step 9: Commit**

```bash
git add -A
git -c core.autocrlf=false -c user.email=kontaktwebiser@gmail.com -c user.name="Bibi" commit -m "$(cat <<'EOF'
Supabase CLI wiring + client library + deps

supabase init/link, src/lib/supabase.ts + env.ts, .env.example, db:* npm
scripts, Jest mock for the supabase client.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Schema migration (`0001_schema.sql`)

**Files:**
- Create: `supabase/migrations/0001_schema.sql`
- Modify: `src/lib/database.types.ts` (regenerated)

**Interfaces:**
- Produces: every table, enum, view, and the `handle_new_user`, `touch_updated_at`, `bump_conversation` triggers described in spec §3. Generated `Database` type in `src/lib/database.types.ts`.

- [ ] **Step 1: Create the migration file**

`supabase/migrations/0001_schema.sql` — full DDL. Write it in this order: extensions → enums → tables (identity, catalog, listings, conversations, proposals, completion/reviews/safety/notifications, read-only content) → indexes → views → functions → triggers.

```sql
-- 0001_schema.sql — MinNabo core schema
create extension if not exists "pgcrypto";

-- ---------- enums ----------
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

-- ---------- identity & profile ----------
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

-- ---------- catalog & listings ----------
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

-- ---------- conversations, proposals, agreements ----------
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

-- ---------- completion, reviews, safety, notifications ----------
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

-- ---------- read-only content ----------
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

-- ---------- views ----------
create view profile_ratings as
  select to_profile_id as profile_id,
         round(avg(rating)::numeric, 1) as average,
         count(*)::int as count
  from reviews group by to_profile_id;

-- ---------- functions & triggers ----------
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
```

- [ ] **Step 2: Push the migration**

```bash
set -a; source .env; set +a
npm run db:push
```
Expected: `Applying migration 0001_schema.sql...` then `Finished supabase db push.`

- [ ] **Step 3: Regenerate types**

```bash
npm run db:types
```
Expected: `src/lib/database.types.ts` now ~hundreds of lines with a real `Database` type. `git diff --stat` shows it grew.

- [ ] **Step 4: Verify typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS. (`database.types.ts` is only consumed by `src/lib/supabase.ts`; the generic must resolve.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_schema.sql src/lib/database.types.ts
git -c core.autocrlf=false -c user.email=kontaktwebiser@gmail.com -c user.name="Bibi" commit -m "$(cat <<'EOF'
DB schema migration 0001: all core tables, enums, triggers, views

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: RLS migration (`0002_rls.sql`)

**Files:**
- Create: `supabase/migrations/0002_rls.sql`

**Interfaces:**
- Produces: `is_participant(uuid) -> boolean`, `is_admin() -> boolean` helpers; RLS enabled + policies on every table per spec §4.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0002_rls.sql`:

```sql
-- 0002_rls.sql — row level security

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function is_participant(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = conv and profile_id = auth.uid()
  );
$$;

-- helper: does the current user own this listing
create or replace function owns_listing(l uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from listings where id = l and owner_id = auth.uid());
$$;

alter table profiles                 enable row level security;
alter table verifications            enable row level security;
alter table business_profiles        enable row level security;
alter table consent_records          enable row level security;
alter table categories               enable row level security;
alter table listings                 enable row level security;
alter table task_details             enable row level security;
alter table service_offer_details    enable row level security;
alter table listing_images           enable row level security;
alter table saved_listings           enable row level security;
alter table saved_searches           enable row level security;
alter table conversations            enable row level security;
alter table conversation_participants enable row level security;
alter table proposals                enable row level security;
alter table messages                 enable row level security;
alter table message_reads            enable row level security;
alter table proposal_revisions       enable row level security;
alter table agreement_snapshots      enable row level security;
alter table completion_confirmations enable row level security;
alter table reviews                  enable row level security;
alter table reports                  enable row level security;
alter table blocks                   enable row level security;
alter table notifications            enable row level security;
alter table partners                 enable row level security;
alter table partner_placements       enable row level security;
alter table donation_records         enable row level security;

-- profiles
create policy p_profiles_read on profiles for select to authenticated using (true);
create policy p_profiles_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- verifications / business_profiles: read own or admin; writes via RPC only
create policy p_verif_read on verifications for select to authenticated
  using (profile_id = auth.uid() or is_admin());
create policy p_biz_read on business_profiles for select to authenticated
  using (profile_id = auth.uid() or is_admin());

-- consent: own only
create policy p_consent_all on consent_records for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- categories / partners / placements / donations: read-only to all authenticated
create policy p_categories_read on categories for select to authenticated using (true);
create policy p_partners_read on partners for select to authenticated using (true);
create policy p_placements_read on partner_placements for select to authenticated using (true);
create policy p_donations_read on donation_records for select to authenticated using (true);

-- listings + detail + images
create policy p_listings_read on listings for select to authenticated
  using (status <> 'REMOVED' or owner_id = auth.uid());
create policy p_listings_ins on listings for insert to authenticated
  with check (owner_id = auth.uid());
create policy p_listings_upd on listings for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy p_listings_del on listings for delete to authenticated
  using (owner_id = auth.uid());

create policy p_task_read on task_details for select to authenticated using (true);
create policy p_task_write on task_details for all to authenticated
  using (owns_listing(listing_id)) with check (owns_listing(listing_id));
create policy p_soffer_read on service_offer_details for select to authenticated using (true);
create policy p_soffer_write on service_offer_details for all to authenticated
  using (owns_listing(listing_id)) with check (owns_listing(listing_id));
create policy p_limg_read on listing_images for select to authenticated using (true);
create policy p_limg_write on listing_images for all to authenticated
  using (owns_listing(listing_id)) with check (owns_listing(listing_id));

-- saved
create policy p_saved_all on saved_listings for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy p_savedsearch_all on saved_searches for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- conversations
create policy p_conv_read on conversations for select to authenticated
  using (is_participant(id));
create policy p_convpart_read on conversation_participants for select to authenticated
  using (is_participant(conversation_id));

-- messages
create policy p_msg_read on messages for select to authenticated
  using (is_participant(conversation_id));
create policy p_msg_ins on messages for insert to authenticated
  with check (is_participant(conversation_id)
              and author_id = auth.uid()
              and kind in ('TEXT','IMAGE'));

create policy p_reads_all on message_reads for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- proposals / revisions / agreements: read if participant; write via RPC only
create policy p_prop_read on proposals for select to authenticated
  using (is_participant(conversation_id));
create policy p_prev_read on proposal_revisions for select to authenticated
  using (exists (select 1 from proposals p where p.id = proposal_id and is_participant(p.conversation_id)));
create policy p_agree_read on agreement_snapshots for select to authenticated
  using (exists (select 1 from proposals p where p.id = proposal_id and is_participant(p.conversation_id)));

-- completion / reviews
create policy p_comp_read on completion_confirmations for select to authenticated
  using (exists (select 1 from proposals p where p.id = agreement_proposal_id and is_participant(p.conversation_id)));
create policy p_reviews_read on reviews for select to authenticated using (true);

-- reports / blocks
create policy p_reports_read on reports for select to authenticated
  using (by_profile_id = auth.uid() or is_admin());
create policy p_reports_ins on reports for insert to authenticated
  with check (by_profile_id = auth.uid());
create policy p_reports_upd on reports for update to authenticated
  using (is_admin()) with check (is_admin());
create policy p_blocks_all on blocks for all to authenticated
  using (by_profile_id = auth.uid()) with check (by_profile_id = auth.uid());

-- notifications
create policy p_notif_all on notifications for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
```

- [ ] **Step 2: Push + verify**

```bash
set -a; source .env; set +a
npm run db:push
```
Expected: `Applying migration 0002_rls.sql...` success.

- [ ] **Step 3: Smoke check with `psql`**

```bash
psql "$SUPABASE_DB_URL" -c "select tablename, rowsecurity from pg_tables where schemaname='public' order by 1;" | grep -c ' t$'
```
Expected: count equals the number of tables (26). Every `public` table has `rowsecurity = t`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_rls.sql
git -c core.autocrlf=false -c user.email=kontaktwebiser@gmail.com -c user.name="Bibi" commit -m "$(cat <<'EOF'
DB migration 0002: row level security on every table

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: RPC + realtime migration (`0003_rpc_realtime.sql`)

**Files:**
- Create: `supabase/migrations/0003_rpc_realtime.sql`
- Modify: `src/lib/database.types.ts` (regenerated — now includes RPC arg/return types)

**Interfaces:**
- Produces these callable RPCs (all `SECURITY DEFINER`, `search_path = public`, raise `exception` with Norwegian messages on violation):
  - `start_conversation_for_listing(p_listing_id uuid) -> conversations`
  - `send_proposal(p_conversation_id uuid, p_listing_id uuid, p_price_minor bigint, p_message text, p_scheduled_text text, p_caveats text, p_client_token text) -> proposals`
  - `respond_to_proposal(p_proposal_id uuid, p_event text, p_actor text) -> proposals`
  - `revise_proposal(p_proposal_id uuid, p_note text, p_price_minor bigint, p_scheduled_text text, p_caveats text) -> proposals`
  - `mark_conversation_read(p_conversation_id uuid) -> void`
  - `confirm_completion(p_agreement_proposal_id uuid) -> completion_confirmations[]` (returns setof)
  - `submit_review(p_agreement_proposal_id uuid, p_rating int, p_comment text) -> reviews`
  - `submit_report(p_target_type text, p_target_id text, p_reason text, p_details text) -> reports`
  - `resolve_report(p_report_id uuid) -> reports`
  - `request_verification(p_kind text) -> verifications`
  - `submit_business_profile(p_org_nr text, p_company_name text, p_contact_person text, p_email text, p_phone text, p_category_slugs text[]) -> business_profiles`

- [ ] **Step 1: Write the migration — helpers + proposal state machine**

`supabase/migrations/0003_rpc_realtime.sql` (part 1):

```sql
-- 0003_rpc_realtime.sql

-- notify helper
create or replace function notify(p_profile uuid, p_kind notification_kind,
  p_title text, p_body text, p_route text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (profile_id, kind, title, body, route)
  values (p_profile, p_kind, p_title, p_body, p_route);
end $$;

-- rate limit helper: raise if > p_max rows in p_table for auth.uid() in last minute
create or replace function rate_check(p_count int, p_max int, p_what text)
returns void language plpgsql as $$
begin
  if p_count >= p_max then
    raise exception 'For mange %. Vent litt og prøv igjen.', p_what
      using errcode = 'check_violation';
  end if;
end $$;

-- proposal transition table (mirrors src/domain/proposalMachine.ts)
create or replace function proposal_next(
  p_from proposal_status, p_event text, p_actor text)
returns proposal_status language plpgsql as $$
begin
  -- actor is 'PROPOSER' or 'RECIPIENT'
  if p_from = 'DRAFT' and p_event = 'SEND' and p_actor = 'PROPOSER' then return 'SENT'; end if;
  if p_from = 'SENT' then
    if p_event = 'WITHDRAW' and p_actor = 'PROPOSER'  then return 'WITHDRAWN'; end if;
    if p_event = 'DECLINE'  and p_actor = 'RECIPIENT' then return 'DECLINED';  end if;
    if p_event = 'ACCEPT'   and p_actor = 'RECIPIENT' then return 'ACCEPTED';  end if;
    if p_event = 'REQUEST_REVISION' and p_actor = 'RECIPIENT' then return 'REVISION_PENDING'; end if;
  end if;
  if p_from = 'ACCEPTED' and p_event = 'REQUEST_REVISION' and p_actor = 'RECIPIENT'
    then return 'REVISION_PENDING'; end if;
  if p_from = 'REVISION_PENDING' then
    if p_event = 'SUBMIT_REVISION'  and p_actor = 'PROPOSER'  then return 'SENT';      end if;
    if p_event = 'CONFIRM_REVISION' and p_actor = 'PROPOSER'  then return 'ACCEPTED';  end if;
    if p_event = 'WITHDRAW'         and p_actor = 'PROPOSER'  then return 'WITHDRAWN'; end if;
    if p_event = 'DECLINE'          and p_actor = 'RECIPIENT' then return 'DECLINED';  end if;
  end if;
  raise exception 'Ugyldig endring av tilbudet.' using errcode = 'check_violation';
end $$;
```

- [ ] **Step 2: Write the migration — conversation + proposal RPCs**

Part 2 of `0003_rpc_realtime.sql`:

```sql
create or replace function start_conversation_for_listing(p_listing_id uuid)
returns conversations language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_me uuid := auth.uid(); v_conv conversations;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  select owner_id into v_owner from listings where id = p_listing_id;
  if v_owner is null then raise exception 'Fant ikke oppføringen.'; end if;
  if v_owner = v_me then raise exception 'Du kan ikke kontakte deg selv.'; end if;

  select c.* into v_conv from conversations c
    join conversation_participants a on a.conversation_id = c.id and a.profile_id = v_me
    join conversation_participants b on b.conversation_id = c.id and b.profile_id = v_owner
   where c.listing_id = p_listing_id limit 1;
  if found then return v_conv; end if;

  insert into conversations (listing_id) values (p_listing_id) returning * into v_conv;
  insert into conversation_participants (conversation_id, profile_id)
    values (v_conv.id, v_me), (v_conv.id, v_owner);
  return v_conv;
end $$;

create or replace function send_proposal(
  p_conversation_id uuid, p_listing_id uuid, p_price_minor bigint,
  p_message text, p_scheduled_text text, p_caveats text, p_client_token text)
returns proposals language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_type listing_type; v_owner uuid;
        v_to uuid; v_prop proposals; v_recent int;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;

  -- idempotency
  select * into v_prop from proposals where client_token = p_client_token;
  if found then return v_prop; end if;

  if not is_participant(p_conversation_id) then
    raise exception 'Du er ikke deltaker i denne samtalen.'; end if;

  select type, owner_id into v_type, v_owner from listings where id = p_listing_id;
  -- recipient is the other participant
  select profile_id into v_to from conversation_participants
   where conversation_id = p_conversation_id and profile_id <> v_me limit 1;

  -- role rule: on a TASK_REQUEST the requester (owner) receives; a helper sends.
  -- on a SERVICE_OFFER the provider (owner) receives; a customer sends.
  if v_me = v_owner then
    raise exception 'Eieren av oppføringen kan ikke sende tilbud på den.'; end if;

  select count(*) into v_recent from proposals
   where from_profile_id = v_me and created_at > now() - interval '1 minute';
  perform rate_check(v_recent, 5, 'tilbud');

  insert into proposals (listing_id, conversation_id, from_profile_id, to_profile_id,
      price_amount_minor, message, scheduled_text, caveats, status, client_token)
    values (p_listing_id, p_conversation_id, v_me, v_to,
      p_price_minor, nullif(p_message,''), nullif(p_scheduled_text,''),
      nullif(p_caveats,''), 'SENT', p_client_token)
    returning * into v_prop;

  insert into messages (conversation_id, author_id, kind, proposal_id, text)
    values (p_conversation_id, v_me, 'PROPOSAL', v_prop.id, '');

  perform notify(v_to, 'NEW_OFFER', 'Nytt tilbud',
    'Du har fått et nytt tilbud.', '/tilbud/' || v_prop.id);
  return v_prop;
end $$;

create or replace function respond_to_proposal(
  p_proposal_id uuid, p_event text, p_actor text)
returns proposals language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_next proposal_status;
        v_actor_ok boolean; v_desc text;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found then raise exception 'Fant ikke tilbudet.'; end if;
  if not is_participant(p.conversation_id) then raise exception 'Ikke tilgang.'; end if;

  -- verify the claimed actor matches who the caller actually is
  v_actor_ok := (p_actor = 'PROPOSER' and v_me = p.from_profile_id)
             or (p_actor = 'RECIPIENT' and v_me = p.to_profile_id);
  if not v_actor_ok then raise exception 'Feil rolle for denne handlingen.'; end if;

  v_next := proposal_next(p.status, p_event, p_actor);
  update proposals set status = v_next where id = p.id returning * into p;

  if v_next = 'ACCEPTED' then
    select coalesce(td.description, so.about, l.title) into v_desc
      from listings l
      left join task_details td on td.listing_id = l.id
      left join service_offer_details so on so.listing_id = l.id
     where l.id = p.listing_id;
    insert into agreement_snapshots (proposal_id, listing_id, price_amount_minor,
        price_currency, scheduled_text, description, caveats)
      values (p.id, p.listing_id, p.price_amount_minor, p.price_currency,
        p.scheduled_text, coalesce(v_desc,''), p.caveats)
      on conflict (proposal_id) do update set
        price_amount_minor = excluded.price_amount_minor,
        scheduled_text = excluded.scheduled_text, caveats = excluded.caveats,
        agreed_at = now();
    update listings set status = 'AGREED' where id = p.listing_id;
    insert into messages (conversation_id, author_id, kind, text)
      values (p.conversation_id, v_me, 'SYSTEM', 'Tilbud godtatt');
    perform notify(p.from_profile_id, 'OFFER_ACCEPTED', 'Tilbud godtatt',
      'Tilbudet ditt ble godtatt.', '/avtale/' || p.id);
  elsif v_next = 'DECLINED' then
    perform notify(p.from_profile_id, 'OFFER_DECLINED', 'Tilbud avslått',
      'Tilbudet ditt ble avslått.', '/chat/' || p.conversation_id);
  elsif v_next = 'WITHDRAWN' then
    perform notify(p.to_profile_id, 'OFFER_WITHDRAWN', 'Tilbud trukket',
      'Et tilbud ble trukket tilbake.', '/chat/' || p.conversation_id);
  elsif v_next = 'REVISION_PENDING' then
    perform notify(p.from_profile_id, 'OFFER_CHANGED', 'Endring ønsket',
      'Mottakeren ba om en endring.', '/tilbud/' || p.id);
  end if;
  return p;
end $$;

create or replace function revise_proposal(
  p_proposal_id uuid, p_note text, p_price_minor bigint,
  p_scheduled_text text, p_caveats text)
returns proposals language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found then raise exception 'Fant ikke tilbudet.'; end if;
  if not is_participant(p.conversation_id) then raise exception 'Ikke tilgang.'; end if;

  if v_me = p.to_profile_id then
    -- recipient asks for a change
    p := respond_to_proposal(p_proposal_id, 'REQUEST_REVISION', 'RECIPIENT');
    insert into proposal_revisions (proposal_id, actor_id, note)
      values (p.id, v_me, nullif(p_note,''));
    insert into messages (conversation_id, author_id, kind, text)
      values (p.conversation_id, v_me, 'TEXT',
              coalesce(nullif(p_note,''),'Kan vi endre litt på tilbudet?'));
  elsif v_me = p.from_profile_id then
    -- proposer submits new terms
    update proposals set
      price_amount_minor = coalesce(p_price_minor, price_amount_minor),
      scheduled_text = coalesce(nullif(p_scheduled_text,''), scheduled_text),
      caveats = coalesce(nullif(p_caveats,''), caveats)
    where id = p.id;
    p := respond_to_proposal(p_proposal_id, 'SUBMIT_REVISION', 'PROPOSER');
    insert into proposal_revisions (proposal_id, actor_id, note, price_amount_minor,
        scheduled_text, caveats)
      values (p.id, v_me, nullif(p_note,''), p_price_minor,
              nullif(p_scheduled_text,''), nullif(p_caveats,''));
    insert into messages (conversation_id, author_id, kind, proposal_id, text)
      values (p.conversation_id, v_me, 'PROPOSAL', p.id, '');
  else
    raise exception 'Ikke tilgang.';
  end if;
  return p;
end $$;
```

- [ ] **Step 3: Write the migration — read, completion, review, safety, verification RPCs**

Part 3 of `0003_rpc_realtime.sql`:

```sql
create or replace function mark_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_participant(p_conversation_id) then raise exception 'Ikke tilgang.'; end if;
  insert into message_reads (conversation_id, profile_id, last_read_at)
    values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, profile_id) do update set last_read_at = now();
end $$;

create or replace function confirm_completion(p_agreement_proposal_id uuid)
returns setof completion_confirmations
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_both int;
begin
  select * into p from proposals where id = p_agreement_proposal_id;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Ikke tilgang.'; end if;

  insert into completion_confirmations (agreement_proposal_id, by_profile_id)
    values (p_agreement_proposal_id, v_me)
  on conflict do nothing;

  select count(*) into v_both from completion_confirmations
   where agreement_proposal_id = p_agreement_proposal_id;
  if v_both >= 2 then
    update listings set status = 'COMPLETED' where id = p.listing_id;
    perform notify(p.from_profile_id,'REVIEW_RECEIVED','Oppdrag fullført',
      'Oppdraget er markert som fullført. Legg gjerne igjen en vurdering.','/vurder/'||p.id);
    perform notify(p.to_profile_id,'REVIEW_RECEIVED','Oppdrag fullført',
      'Oppdraget er markert som fullført. Legg gjerne igjen en vurdering.','/vurder/'||p.id);
  else
    perform notify(case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end,
      'COMPLETION_REQUESTED','Bekreft fullføring',
      'Den andre parten markerte oppdraget som fullført.','/fullfor/'||p.id);
  end if;

  return query select * from completion_confirmations
    where agreement_proposal_id = p_agreement_proposal_id;
end $$;

create or replace function submit_review(
  p_agreement_proposal_id uuid, p_rating int, p_comment text)
returns reviews language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_to uuid; v_done int; r reviews;
begin
  select * into p from proposals where id = p_agreement_proposal_id;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Ikke tilgang.'; end if;

  select count(*) into v_done from completion_confirmations
   where agreement_proposal_id = p_agreement_proposal_id;
  if v_done < 2 then raise exception 'Oppdraget er ikke fullført ennå.'; end if;

  v_to := case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end;
  insert into reviews (agreement_proposal_id, listing_id, from_profile_id, to_profile_id, rating, comment)
    values (p_agreement_proposal_id, p.listing_id, v_me, v_to, p_rating, nullif(p_comment,''))
  on conflict (agreement_proposal_id, from_profile_id)
    do update set rating = excluded.rating, comment = excluded.comment
  returning * into r;

  update listings set status = 'REVIEWED' where id = p.listing_id;
  perform notify(v_to,'REVIEW_RECEIVED','Ny vurdering','Du har fått en ny vurdering.','/profil/'||v_to);
  return r;
end $$;

create or replace function submit_report(
  p_target_type text, p_target_id text, p_reason text, p_details text)
returns reports language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_recent int; r reports;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  select count(*) into v_recent from reports
   where by_profile_id = v_me and created_at > now() - interval '1 minute';
  perform rate_check(v_recent, 3, 'rapporter');
  insert into reports (target_type, target_id, reason, details, by_profile_id)
    values (p_target_type::report_target, p_target_id, p_reason, nullif(p_details,''), v_me)
  returning * into r;
  return r;
end $$;

create or replace function resolve_report(p_report_id uuid)
returns reports language plpgsql security definer set search_path = public as $$
declare r reports;
begin
  if not is_admin() then raise exception 'Kun administratorer.'; end if;
  update reports set status = 'RESOLVED', resolved_by = auth.uid(), resolved_at = now()
   where id = p_report_id returning * into r;
  return r;
end $$;

create or replace function request_verification(p_kind text)
returns verifications language plpgsql security definer set search_path = public as $$
declare v verifications;
begin
  insert into verifications (profile_id, kind, verified, explanation, verified_at)
  values (auth.uid(), p_kind::verification_kind,
    case when p_kind = 'EMAIL' then true else false end,
    case p_kind
      when 'EMAIL' then 'E-postadressen din er bekreftet ved innlogging.'
      when 'PHONE' then 'Telefonverifisering kommer snart.'
      when 'BUSINESS' then 'Bedriftsverifisering behandles manuelt.' end,
    case when p_kind = 'EMAIL' then now() else null end)
  on conflict (profile_id, kind) do update set explanation = excluded.explanation
  returning * into v;
  return v;
end $$;

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
    phone = excluded.phone, category_slugs = excluded.category_slugs, status = 'PENDING'
  returning * into b;
  update profiles set is_business = true where id = auth.uid();
  return b;
end $$;
```

- [ ] **Step 4: Write the migration — message rate limit trigger + realtime publication**

Part 4 of `0003_rpc_realtime.sql`:

```sql
create or replace function message_rate_guard() returns trigger
language plpgsql as $$
declare v_recent int;
begin
  if new.kind in ('TEXT','IMAGE') then
    select count(*) into v_recent from messages
     where author_id = new.author_id and created_at > now() - interval '10 seconds';
    perform rate_check(v_recent, 10, 'meldinger');
  end if;
  return new;
end $$;
create trigger t_messages_rate before insert on messages
  for each row execute function message_rate_guard();

-- realtime
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table proposals;
alter publication supabase_realtime add table notifications;
```

- [ ] **Step 5: Push + regenerate types**

```bash
set -a; source .env; set +a
npm run db:push && npm run db:types
```
Expected: migration applies; `database.types.ts` now has a `Functions` block with the RPC signatures.

- [ ] **Step 6: Verify typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0003_rpc_realtime.sql src/lib/database.types.ts
git -c core.autocrlf=false -c user.email=kontaktwebiser@gmail.com -c user.name="Bibi" commit -m "$(cat <<'EOF'
DB migration 0003: RPC functions, rate limits, realtime publication

Proposal state machine, agreements, completion, reviews, reports,
verification and business-profile RPCs; message rate-limit trigger.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Seed data — static + demo + Storage buckets

**Files:**
- Create: `supabase/seed_static.sql`
- Create: `supabase/migrations/0004_storage.sql`
- Create: `scripts/seed-demo.ts`
- Modify: `package.json` (already has `seed:demo`, `db:seed:static`)

**Interfaces:**
- Produces: 11 `categories` rows; 3 `partners` + placements; 3 `donation_records`; Storage buckets `avatars`, `listing-images`, `chat-attachments` with policies. `scripts/seed-demo.ts` creates 6 demo `auth.users` (password `minnabo-demo`) + their profiles/listings/conversations/proposals.

- [ ] **Step 1: `supabase/seed_static.sql`**

Copy the category list from `src/data/seed.ts` (`categories` array — slug/label/icon) verbatim into an idempotent upsert, then partners/donations. Read `src/data/seed.ts` and `src/data/seedCommunity.ts` first for exact strings.

```sql
insert into categories (slug, label, icon) values
  ('hage','Hage','feather'),
  ('renhold','Rengjøring','droplet'),
  ('flytting','Flytting/bæring','package'),
  ('transport','Transport/levering','truck'),
  ('montering','Montering','tool'),
  ('snomaking','Snømåking','cloud-snow'),
  ('maling','Maling/vedlikehold','edit-3'),
  ('dyrepass','Dyrepass','heart'),
  ('datahjelp','Datahjelp','monitor'),
  ('arrangement','Arrangementshjelp','calendar'),
  ('annet','Annet','more-horizontal')
on conflict (slug) do update set label = excluded.label, icon = excluded.icon;

insert into partners (id, name, blurb, url) values
  ('00000000-0000-0000-0000-000000000001','Sparebanken Innlandet','Lokalbanken som heier på nabohjelp.','https://example.no')
on conflict (id) do nothing;
-- (repeat for the partners/donations actually rendered in FellesskapScreen)
```

- [ ] **Step 2: `supabase/migrations/0004_storage.sql` — buckets + policies**

```sql
insert into storage.buckets (id, name, public) values
  ('avatars','avatars', true),
  ('listing-images','listing-images', true),
  ('chat-attachments','chat-attachments', false)
on conflict (id) do nothing;

-- anyone authenticated can read public buckets; owner-folder writes only
create policy "avatars read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "avatars write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "listing-images read" on storage.objects for select to authenticated
  using (bucket_id = 'listing-images');
create policy "listing-images write" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "chat read participant" on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "chat write" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
```

Note: chat attachments are stored under `{senderId}/...`; the recipient reads them via a signed URL minted by the sender's client and passed in the message, OR — simpler and chosen here — store chat attachments in the **public** `listing-images` bucket path `chat/{conversationId}/...` and rely on message-row RLS for privacy of the reference. Update the policy block to make `chat-attachments` public too and drop the participant policy. Keep it simple: **all three buckets public**, privacy enforced by row RLS on the tables that hold the paths.

- [ ] **Step 3: Push storage migration + run static seed**

```bash
set -a; source .env; set +a
npm run db:push
psql "$SUPABASE_DB_URL" -f supabase/seed_static.sql
psql "$SUPABASE_DB_URL" -c "select count(*) from categories;"
```
Expected: `11`.

- [ ] **Step 4: Write `scripts/seed-demo.ts`**

```ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

const DEMO = [
  { email: 'emma@minnabo.test', name: 'Emma Larsen', place: 'Lillehammer' },
  { email: 'martin@minnabo.test', name: 'Martin Ruud', place: 'Hamar' },
  { email: 'sara@minnabo.test', name: 'Sara Ahmed', place: 'Gjøvik' },
  { email: 'andreas@minnabo.test', name: 'Andreas Berg', place: 'Lillehammer' },
  { email: 'fjellbygg@minnabo.test', name: 'Fjellbygg AS', place: 'Øyer' },
  { email: 'me@minnabo.test', name: 'Marius B.', place: 'Lillehammer' },
];

async function main() {
  const ids: Record<string, string> = {};
  for (const d of DEMO) {
    const { data, error } = await admin.auth.admin.createUser({
      email: d.email, password: 'minnabo-demo', email_confirm: true,
      user_metadata: { display_name: d.name },
    });
    if (error && !error.message.includes('already been registered')) throw error;
    const id = data?.user?.id
      ?? (await admin.auth.admin.listUsers()).data.users.find(u => u.email === d.email)!.id;
    ids[d.email] = id;
    await admin.from('profiles').update({
      place: d.place, municipality: d.place, onboarded_at: new Date().toISOString(),
    }).eq('id', id);
  }

  // one TASK_REQUEST + one SERVICE_OFFER per a couple of users, a conversation, a live proposal.
  // Use admin.from(...).insert(...) directly (service role bypasses RLS).
  // Keep it small: ~8 listings, 2 conversations, 1 SENT proposal, 1 completed+reviewed agreement.
  // ... (full inserts written out here, mirroring src/data/seed.ts + seedChat.ts shapes)

  console.log('Seed complete:', ids);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Write out the full listing/conversation/proposal inserts mirroring `src/data/seed.ts`, `src/data/seedChat.ts`, `src/data/seedProfile.ts` content (titles, categories, prices, the `l-male-gjerdet` competing-proposals scenario). Make the script idempotent (upsert on stable ids or check-existence).

- [ ] **Step 5: Run the demo seed**

```bash
set -a; source .env; set +a
npm run seed:demo
```
Expected: `Seed complete: { ... 6 uuids ... }`. Re-running is a no-op.

- [ ] **Step 6: Commit**

```bash
git add supabase/seed_static.sql supabase/migrations/0004_storage.sql scripts/seed-demo.ts
git -c core.autocrlf=false -c user.email=kontaktwebiser@gmail.com -c user.name="Bibi" commit -m "$(cat <<'EOF'
Seed: static catalog, storage buckets, demo users + listings + chats

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: ApiClient interface, mappers, SupabaseApiClient, selector

**Files:**
- Create: `src/api/ApiClient.ts`
- Create: `src/api/mappers.ts`
- Create: `src/api/supabaseClient.ts`
- Rename: `src/api/client.ts` → keep name, but move current `MockApiClient` class body to `src/api/mockClient.ts`
- Modify: `src/api/client.ts` (becomes the selector)
- Test: `tests/api/supabaseClient.test.ts` (mapper unit tests only — no network)

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase.ts`; `Database` from `src/lib/database.types.ts`; all `domain/types.ts` types.
- Produces: `interface ApiClient` with the exact method set currently on `MockApiClient` (see `src/api/client.ts` lines 34–210). `export const apiClient: ApiClient`. `mappers.ts` exports `toListing(row)`, `toProfile(row)`, `toConversation(row, meId)`, `toMessage(row)`, `toProposal(row)`, `toAgreement(row)`, `toReview(row)`, `toNotification(row)`.

- [ ] **Step 1: Extract the interface**

Create `src/api/ApiClient.ts` — copy every public method signature from the current `MockApiClient` into `export interface ApiClient { ... }`. No implementation. This is the contract both clients honour.

- [ ] **Step 2: Move MockApiClient**

`git mv` conceptually: create `src/api/mockClient.ts` with the current `MockApiClient` class (unchanged), `implements ApiClient`. Add `import type { ApiClient } from './ApiClient'`.

- [ ] **Step 3: Rewrite `src/api/client.ts` as the selector**

```ts
import type { ApiClient } from './ApiClient';
import { MockApiClient } from './mockClient';

const IS_TEST = process.env.NODE_ENV === 'test';

// Lazily require the Supabase client so tests never load supabase-js.
function makeClient(): ApiClient {
  if (IS_TEST) return new MockApiClient();
  const { SupabaseApiClient } = require('./supabaseClient') as typeof import('./supabaseClient');
  return new SupabaseApiClient();
}

export const apiClient: ApiClient = makeClient();
export type { ApiClient };
```

- [ ] **Step 4: Write `src/api/mappers.ts` with a failing test first**

`tests/api/mappers.test.ts`:
```ts
import { toProposal, toListing } from '@/api/mappers';

test('toProposal maps snake_case row to domain Proposal', () => {
  const row = {
    id: 'p1', listing_id: 'l1', conversation_id: 'c1',
    from_profile_id: 'a', to_profile_id: 'b',
    price_amount_minor: 60000, price_currency: 'NOK',
    message: 'hei', scheduled_text: null, caveats: null,
    status: 'SENT', created_at: '2026-08-01T10:00:00Z',
  };
  const p = toProposal(row as never);
  expect(p).toMatchObject({
    id: 'p1', listingId: 'l1', fromProfileId: 'a', toProfileId: 'b',
    price: { amountMinor: 60000, currency: 'NOK' }, message: 'hei', status: 'SENT',
  });
});
```
Run: `npx jest mappers` → FAIL (module missing).

- [ ] **Step 5: Implement `mappers.ts`**

One pure function per entity, snake→camel, `price_amount_minor`/`price_currency` → `{ amountMinor, currency }`, `created_at` → `createdAt`. For `toConversation(row, meId)` derive `counterpart` (participant ≠ meId), `unread` (`row.last_message_at > myRead.last_read_at`), `statusTag` (latest proposal status: `SENT`→`'NEW_OFFER'`, `ACCEPTED`→`'OFFER_ACCEPTED'`, else `null`).

Run: `npx jest mappers` → PASS.

- [ ] **Step 6: Implement `SupabaseApiClient`**

`src/api/supabaseClient.ts` — `class SupabaseApiClient implements ApiClient`. Each method:
- reads → `supabase.from('table').select('nested…')` then map; throw `new Error(error.message)` on `error`.
- `createListing` → insert `listings` + detail row + `listing_images` (transaction via a single `rpc` is nicer, but sequential inserts with the owner check via RLS is acceptable; wrap in try/rollback-by-delete on failure).
- proposal/agreement/completion/review/report/verify/business → `supabase.rpc('fn', { ...args })`.
- `getConversation` also calls `supabase.rpc('mark_conversation_read', ...)` after fetching (mirrors current mock behaviour).
- `sendProposal` generates a `client_token` (`crypto.randomUUID()` via `expo-crypto` or `Date.now()+random`) for idempotency.

- [ ] **Step 7: Typecheck + full test run**

Run: `npm run typecheck && npm test`
Expected: PASS (93 + new mapper tests). Tests still use `MockApiClient` via the selector.

- [ ] **Step 8: Commit**

```bash
git add src/api/ tests/api/
git -c core.autocrlf=false -c user.email=kontaktwebiser@gmail.com -c user.name="Bibi" commit -m "$(cat <<'EOF'
API: ApiClient interface + mappers + SupabaseApiClient + selector

MockApiClient retained for Jest; runtime uses SupabaseApiClient.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Auth, session, onboarding wiring, dev switch

**Files:**
- Create: `src/auth/session.ts`
- Delete: `src/data/authStore.ts`
- Modify: `src/hooks/useCurrentUser.ts`
- Modify: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`
- Modify: `src/screens/Onboarding/LoginScreen.tsx`, `ConsentScreen.tsx`, `SetupScreen.tsx`
- Modify: `src/screens/SettingsScreen.tsx` + `src/screens/DeleteAccountScreen.tsx`
- Create: `src/screens/DevSwitchScreen.tsx`, `app/dev-switch.tsx`
- Create: `supabase/functions/delete-account/index.ts`
- Modify: `src/config/appMenu.ts` (dev-only "Bytt testbruker" row)
- Test: update `tests/screens/onboarding.test.tsx`, any test importing `authStore`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase.ts`; `apiClient`.
- Produces: `useSession() -> { session, userId: string | null, status: 'loading'|'authed'|'anon' }`; `useCurrentUser()` returns the caller's `PublicProfile` (from `apiClient.getProfile(userId)`), `isDev` guard.

- [ ] **Step 1: Failing test for the session hook shape**

`tests/auth/session.test.tsx`:
```ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useSession } from '@/auth/session';

test('useSession reports anon when there is no session', async () => {
  const { result } = renderHook(() => useSession());
  await waitFor(() => expect(result.current.status).toBe('anon'));
});
```
(The Jest mock from Task 1 returns `session: null`.) Run → FAIL.

- [ ] **Step 2: Implement `src/auth/session.ts`**

```ts
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Status = 'loading' | 'authed' | 'anon';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? 'authed' : 'anon');
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setStatus(s ? 'authed' : 'anon');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { session, userId: session?.user.id ?? null, status };
}
```

Run test → PASS.

- [ ] **Step 3: Replace `authStore` consumers**

- `useCurrentUser()` → uses `useSession().userId` + `useProfile(userId)` (existing query hook); returns a `PublicProfile` plus `id`. Keep the same return shape the screens already use (`avatarUrl`, `initials`, `id`, `displayName`).
- Delete `src/data/authStore.ts`. Grep `authStore` / `useAuth` and replace: `useAuth().isOnboarded` → `useCurrentUser()?.onboardedAt != null` (add `onboardedAt` to the profile mapper/type). Onboarding screens use `apiClient` calls instead of `authStore.patch`.
- `jest-setup.ts`: remove the `authStore._reset()` line.

- [ ] **Step 4: Wire the onboarding screens**

- `LoginScreen`: step `contact` → `await supabase.auth.signInWithOtp({ email: contact })`; step `code` → `await supabase.auth.verifyOtp({ email: contact, token: code, type: 'email' })`; on error show Norwegian message. Remove the `'0000'` shortcut.
- `ConsentScreen.next()` → `await supabase.from('consent_records').insert({ terms, privacy, age })` then `router.push('/oppsett')`.
- `SetupScreen.finish()` → `await supabase.from('profiles').update({ display_name, purpose, municipality, place, max_distance_km, onboarded_at: new Date().toISOString() }).eq('id', userId)` then `router.replace('/')`.

- [ ] **Step 5: Route gate**

`app/_layout.tsx`: render a splash while `status === 'loading'`. `app/(tabs)/_layout.tsx`: `if (status === 'anon') return <Redirect href="/velkommen" />;` `if (authed && !profile?.onboardedAt) return <Redirect href="/oppsett" />;` (Login/Consent lead into Setup.)

- [ ] **Step 6: Dev switch**

`src/screens/DevSwitchScreen.tsx`: list the 6 demo emails; each row → `supabase.auth.signInWithPassword({ email, password: 'minnabo-demo' })` → `router.replace('/')`. `app/dev-switch.tsx` route. In `src/config/appMenu.ts`, add the row only when `__DEV__`. Guard the screen: `if (!__DEV__) return <Redirect href="/" />`.

- [ ] **Step 7: Sign-out + delete account**

- `SettingsScreen` "Logg ut" → `await supabase.auth.signOut()`.
- `supabase/functions/delete-account/index.ts` — Deno edge function: verifies the caller's JWT, calls `admin.auth.admin.deleteUser(uid)` (cascades via FK `on delete cascade`). Deploy: `npx supabase functions deploy delete-account`.
- `DeleteAccountScreen` confirm → `await supabase.functions.invoke('delete-account')` → `signOut()` → `router.replace('/velkommen')`.

- [ ] **Step 8: Typecheck + tests**

Run: `npm run typecheck && npm test`
Fix `tests/screens/onboarding.test.tsx` to assert against the mocked `supabase.auth` calls (e.g. `expect(supabase.auth.verifyOtp).toHaveBeenCalled()`), not `authStore`.
Expected: PASS.

- [ ] **Step 9: Manual check + commit**

Manual: `npm start`, load the app, sign in with a real email, receive the 6-digit code, complete onboarding, land on Oppdrag. Then commit.

```bash
git add -A
git -c core.autocrlf=false -c user.email=kontaktwebiser@gmail.com -c user.name="Bibi" commit -m "$(cat <<'EOF'
Auth: real email-OTP session, onboarding wired to Supabase, dev switch

Deletes authStore; adds useSession, delete-account edge function.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Realtime, presence, offline persistence

**Files:**
- Create: `src/api/realtime.ts`
- Modify: `app/_layout.tsx` (mount `<InboxRealtime/>`, query persistence)
- Modify: `src/screens/ChatScreen.tsx` (subscribe to the conversation)
- Modify: `src/components/ActiveUsersRow.tsx` / wherever `online` is read (presence)
- Test: `tests/api/realtime.test.tsx` (mock channel; assert invalidation callback wired)

**Interfaces:**
- Consumes: `supabase`, `useQueryClient`, `chatKeys` / `profileKeys` from `queries.ts`.
- Produces: `useConversationChannel(conversationId: string): void`, `useInboxChannel(): void`, `usePresence(): Set<string>` (online profile ids), `<InboxRealtime/>` component.

- [ ] **Step 1: Implement `src/api/realtime.ts`**

```ts
export function useConversationChannel(conversationId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase.channel(`conv:${conversationId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
          qc.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) });
          qc.invalidateQueries({ queryKey: chatKeys.agreement(conversationId) });
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'proposals', filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ['proposal'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, qc]);
}
```
`useInboxChannel()` subscribes to `notifications` + `conversations` filtered by the current `profile_id` / participation and invalidates `['conversations']` + `profileKeys.notifications`. `usePresence()` joins `presence:lobby`, `track({ profileId })` on subscribe, returns the set of tracked ids from `presenceState()`.

- [ ] **Step 2: Test the wiring**

`tests/api/realtime.test.tsx`: render a component using `useConversationChannel('c1')`; assert `supabase.channel` was called with `conv:c1` and `.subscribe()` ran. (Channel is mocked in `jest-setup.ts`.)
Run → implement → PASS.

- [ ] **Step 3: Mount in the app**

- `ChatScreen`: call `useConversationChannel(conversation.id)`.
- `app/_layout.tsx`: render `<InboxRealtime/>` inside the authed tree; wrap `QueryClientProvider` with `PersistQueryClientProvider` + `createAsyncStoragePersister({ storage: AsyncStorage })`; set `defaultOptions.queries.networkMode = 'offlineFirst'` and `gcTime: 1000*60*60*24`.
- Presence: in `ActiveUsersRow` / profile cards, read `usePresence()` and set `online = set.has(profile.id)`.

- [ ] **Step 4: Typecheck + tests + manual two-device check**

Run: `npm run typecheck && npm test` → PASS.
Manual: two simulators / a phone + simulator signed in as two demo users; send a message from one, watch it appear on the other without refresh.

- [ ] **Step 5: Commit**

```bash
git add -A
git -c core.autocrlf=false -c user.email=kontaktwebiser@gmail.com -c user.name="Bibi" commit -m "$(cat <<'EOF'
Realtime chat + presence + offline query persistence

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Image uploads

**Files:**
- Create: `src/lib/uploads.ts`
- Modify: `src/components/AttachSheet.tsx`
- Modify: `src/components/ui/ImagePickerField.tsx`
- Modify: `src/screens/EditProfileScreen.tsx`
- Modify: `src/screens/LeggUt/*Form.tsx` + `buildListing.ts` (image paths instead of stock URLs)
- Modify: `app.json` (expo-image-picker plugin + permission strings, bokmål)
- Test: `tests/lib/uploads.test.ts` (validation only; upload mocked)

**Interfaces:**
- Consumes: `supabase.storage`, `expo-image-picker`, `expo-image-manipulator`.
- Produces: `pickAndUpload(opts: { bucket: 'avatars'|'listing-images'|'chat-attachments'; source: 'camera'|'library'; folder: string }) => Promise<{ path: string; publicUrl: string }>`; `validateImage(asset) => string | null` (Norwegian error or null).

- [ ] **Step 1: `app.json` plugin + permissions**

Add to `plugins`: `["expo-image-picker", { "photosPermission": "MinNabo trenger tilgang til bildene dine for å legge ved bilder.", "cameraPermission": "MinNabo trenger tilgang til kameraet for å ta bilder." }]`.

- [ ] **Step 2: Failing test for `validateImage`**

`tests/lib/uploads.test.ts`:
```ts
import { validateImage } from '@/lib/uploads';
test('rejects non-image mime', () => {
  expect(validateImage({ mimeType: 'application/pdf', fileSize: 100 } as never))
    .toMatch(/bilde/i);
});
test('rejects > 8 MB', () => {
  expect(validateImage({ mimeType: 'image/jpeg', fileSize: 9_000_000 } as never))
    .toMatch(/for stor/i);
});
test('accepts a normal jpeg', () => {
  expect(validateImage({ mimeType: 'image/jpeg', fileSize: 500_000 } as never)).toBeNull();
});
```
Run → FAIL.

- [ ] **Step 3: Implement `src/lib/uploads.ts`**

`validateImage` (mime in `image/jpeg|png|webp`, size ≤ 8 MB). `pickAndUpload`: `ImagePicker.launchCameraAsync` / `launchImageLibraryAsync` (`quality: 0.8`), validate, `ImageManipulator.manipulateAsync` (resize longest side ≤ 1600, `compress: 0.8`, `format: JPEG`), read as `ArrayBuffer`, `supabase.storage.from(bucket).upload(\`${folder}/${uuid}.jpg\`, bytes, { contentType: 'image/jpeg' })`, return `{ path, publicUrl: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl }`.
Run test → PASS.

- [ ] **Step 4: Wire the three surfaces**

- `AttachSheet`: "Ta bilde" → `pickAndUpload({ bucket:'chat-attachments', source:'camera', folder: conversationId })`; "Velg fra bibliotek" → same, `source:'library'`. `onPick(publicUrl)` unchanged downstream (`useSendAttachment`).
- `ImagePickerField`: replace the stock-URL grid with real multi-pick; store `path`s; on submit the form passes paths → `createListing` inserts `listing_images` rows.
- `EditProfileScreen`: avatar tap → `pickAndUpload({ bucket:'avatars', source:'library', folder: userId })` → `apiClient.updateProfile({ avatarPath: path })`.

- [ ] **Step 5: Typecheck + tests + manual**

Run: `npm run typecheck && npm test` → PASS.
Manual: attach a photo in chat; add photos to a new listing; change avatar. Confirm they appear for the other demo account.

- [ ] **Step 6: Commit**

```bash
git add -A
git -c core.autocrlf=false -c user.email=kontaktwebiser@gmail.com -c user.name="Bibi" commit -m "$(cat <<'EOF'
Real image uploads to Supabase Storage (chat, listings, avatar)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Screen-by-screen audit + stub removal

**Files:** every file under `src/screens/` and the components they use. No new files expected; this task is verification + fixes.

**Interfaces:** none new. Each screen must, against the real backend, correctly render: **loading, empty, error, offline, success, no-access**.

- [ ] **Step 1: Build the audit checklist**

Create `docs/superpowers/plans/screen-audit.md` listing every route with: data hook(s) used, the 6 states, and a checkbox. Group: Onboarding, Oppdrag/Search/Lists, Detail, Legg ut, Chat/Inbox, Tilbud/Avtale/Fullfør/Vurder, Profil/Rediger/Verifisering, Fellesskap, Innstillinger family, Admin, Bedrift, Lagrede/Varsler.

- [ ] **Step 2: Kill remaining mock stores used at runtime**

Grep for `savedStore`, `savedSearchStore`, `safetyStore`, `draftStore`, `repositories`, `chatRepository`, `profileRepository` imports **outside** `src/api/mockClient.ts` and `src/data/` and tests. Each runtime use is replaced by an `apiClient` call / query hook:
- `savedStore` → `saved_listings` table via `useToggleSaved` / `useSavedListings` new hooks in `queries.ts` (add `apiClient.toggleSaved` / `listSavedListings`).
- `savedSearchStore` → `saved_searches` table via new hooks.
- `safetyStore` → `blocks` table + `submit_report` RPC.
- `draftStore` → stays local (it's a pre-publish scratchpad; keep as-is, it's fine).
- `AdminScreen` `useSyncExternalStore(safetyStore…)` → `useReports()` query + `useResolveReport()` mutation.

Add the corresponding methods to `ApiClient`, `MockApiClient`, `SupabaseApiClient`, and `queries.ts` hooks. Update the mock stores only as needed to keep tests compiling.

- [ ] **Step 3: Walk each screen group; fix on sight**

For each route: run it against a demo login, exercise the happy path and one failure (e.g. kill wifi for offline, open a stranger's private conversation URL for no-access). Fix wiring, wrong query keys, missing invalidations, hardcoded seed references, `CURRENT_USER_ID` leftovers. Commit per group with message `Wire <group> to the real backend`.

- [ ] **Step 4: Full regression**

Run: `npm run typecheck && npm test` → PASS (update any mock-based test whose store was removed).
Run: `npx expo export --platform ios` → success.

- [ ] **Step 5: Final audit commit**

```bash
git add -A
git -c core.autocrlf=false -c user.email=kontaktwebiser@gmail.com -c user.name="Bibi" commit -m "$(cat <<'EOF'
Wire every screen to the real backend; remove runtime mock stores

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Backend integration tests + green build

**Files:**
- Create: `scripts/test-backend.ts`
- Create: `tests/domain/proposalMachineParity.test.ts`
- Modify: `package.json` (`test:backend` already added)

**Interfaces:**
- Consumes: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (two demo logins).
- Produces: exit 0 on all assertions passing.

- [ ] **Step 1: Write `scripts/test-backend.ts`**

Node script (no Jest). Two anon clients signed in as `emma@minnabo.test` and `martin@minnabo.test` (password `minnabo-demo`). Assertions (each `console.assert` + a failure counter; `process.exit(fails ? 1 : 0)`):
1. Emma creates a `TASK_REQUEST` listing; Martin reads it; a third party (`sara`) cannot `update` it (`error` present).
2. Martin `rpc('start_conversation_for_listing')` → `rpc('send_proposal', { client_token: 'tok-1' })`; calling again with `tok-1` returns the same proposal id (idempotent).
3. Sara (non-participant) `from('messages').select().eq('conversation_id', convId)` → `data` is empty / `error`.
4. Emma `rpc('respond_to_proposal', { event:'ACCEPT', actor:'RECIPIENT' })` → `agreement_snapshots` row exists; `listings.status = 'AGREED'`.
5. `rpc('respond_to_proposal', { event:'ACCEPT', actor:'PROPOSER' })` on a fresh proposal → `error` (wrong actor).
6. `rpc('submit_review', ...)` before both completions → `error` "ikke fullført".
7. Both `rpc('confirm_completion')` → then `submit_review` succeeds; second `submit_review` by same user updates, doesn't duplicate.

Cleanup: delete created rows at the end (service-role client), or namespace titles with a run id and delete by prefix.

- [ ] **Step 2: Run it**

```bash
set -a; source .env; set +a
npm run test:backend
```
Expected: `All backend checks passed.` exit 0.

- [ ] **Step 3: Parity test**

`tests/domain/proposalMachineParity.test.ts`: import the `TABLE` from `src/domain/proposalMachine.ts`; assert each transition it allows is also produced by a small TS re-implementation of `proposal_next` (copied constant), and vice-versa. This guards the SQL/TS drift.
Run: `npx jest proposalMachineParity` → PASS.

- [ ] **Step 4: Full green + export**

Run: `npm run typecheck && npm test && npx expo export --platform ios`
Expected: all PASS / success.

- [ ] **Step 5: Commit**

```bash
git add scripts/test-backend.ts tests/domain/proposalMachineParity.test.ts package.json
git -c core.autocrlf=false -c user.email=kontaktwebiser@gmail.com -c user.name="Bibi" commit -m "$(cat <<'EOF'
Backend integration test script + proposal state-machine parity test

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: BACKEND.md runbook

**Files:**
- Create: `BACKEND.md`
- Modify: `README.md` (link to it)

- [ ] **Step 1: Write `BACKEND.md`**

Sections: (1) env setup — copy `.env.example`, where each key comes from; (2) linking — `supabase login` / `link`; (3) migrations — `npm run db:push`, `npm run db:types`, how to add a new migration (`supabase migration new <name>`); (4) seeding — `psql … seed_static.sql`, `npm run seed:demo`, demo credentials table (6 emails / `minnabo-demo`); (5) Storage buckets list; (6) edge functions — `supabase functions deploy delete-account`; (7) realtime — which tables are in the publication; (8) two-account QA checklist for the full E2E (find → propose → chat → accept → complete → review), and the second E2E (publish a service offer → receive a request → agree); (9) `npm run test:backend`; (10) deferred phase-2 list.

- [ ] **Step 2: Link from README, commit**

```bash
git add BACKEND.md README.md
git -c core.autocrlf=false -c user.email=kontaktwebiser@gmail.com -c user.name="Bibi" commit -m "$(cat <<'EOF'
BACKEND.md: env, migrations, seeding, edge functions, QA runbook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- §1 decisions → Tasks 1–12 ✓
- §2 repo layout → Task 1 (client), 2–5 (supabase/), 6 (api/) ✓
- §3 schema → Task 2 ✓
- §4 RLS + RPC → Tasks 3, 4 ✓
- §5 auth/session/onboarding → Task 7 ✓
- §6 realtime/presence/offline → Task 8 ✓
- §7 image uploads → Task 9 ✓
- §8 ApiClient + mappers → Task 6 ✓
- §9 testing → Tasks 6 (mapper), 11 (integration + parity); existing Jest kept green every task ✓
- §10 rollout order → Task order matches ✓
- §11 deferred → documented in Task 12 runbook, not implemented ✓

**Placeholder scan:** Task 5 Step 4 and Task 10 Step 3 intentionally describe iterative work (seed inserts mirroring existing seed files; per-screen walk) rather than one code block — these are genuinely enumerable at execution time from `src/data/seed*.ts` and the route list, and each has a concrete done-condition (`categories count = 11`; the audit checklist doc; green tests + export). Acceptable. All schema/RLS/RPC SQL is written in full.

**Type consistency:** `ApiClient` method names come verbatim from the current `MockApiClient`. RPC names match between Task 4 (definition), Task 6 (`supabase.rpc('…')` calls), and Task 11 (assertions): `start_conversation_for_listing`, `send_proposal`, `respond_to_proposal`, `revise_proposal`, `mark_conversation_read`, `confirm_completion`, `submit_review`, `submit_report`, `resolve_report`, `request_verification`, `submit_business_profile`. Mapper names (`toListing`/`toProfile`/`toConversation`/`toMessage`/`toProposal`/`toAgreement`/`toReview`/`toNotification`) consistent between Tasks 6 and used in 10.
