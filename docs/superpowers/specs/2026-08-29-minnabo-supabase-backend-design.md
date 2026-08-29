# MinNabo — Real Backend (Supabase) — Design

**Date:** 2026-08-29
**Status:** Approved (design sections A–E), proceeding to implementation
**Scope:** Replace the in-memory mock data layer with a real, persistent Supabase
backend so every app function (auth, profiles, verification, listings, search,
saved items, proposals, agreements, chat, completion, reviews, reports, blocks,
notifications, image uploads) works end-to-end and is stored server-side. Wire
every screen to real data and finish any stub. Deferred items listed in §9.

---

## 1. Decisions (from brainstorming)

| # | Decision |
|---|---|
| Platform | **Supabase** — managed Postgres + Auth + Storage + Realtime + RLS |
| Auth | **Email OTP** (6-digit) now; schema/architecture kept open for phone + BankID later |
| Dev workflow | **Hosted free-tier project** (no local Docker). Migrations authored as files, applied with `supabase db push`. Verified via a Node integration script and the running app. |
| Client architecture | **Adapter swap.** Keep the `apiClient` method surface and `queries.ts` hook signatures. Add `SupabaseApiClient`; keep `MockApiClient` for Jest. Rules-heavy mutations become Postgres `SECURITY DEFINER` RPCs; the rest is RLS-guarded table access. |
| Realtime | Postgres-changes subscriptions → React Query invalidation; presence channel for the "Aktiv nå" dot. In scope. |
| Image uploads | Real device capture (`expo-image-picker` + `expo-image-manipulator`) → Supabase Storage. In scope. |
| Demo / testing | Seed static + demo data. Dev-only "act as demo user" switch (`__DEV__`). Two real accounts for genuine two-sided E2E. |

**Project:** `hvxuzvhzsaocsnwznsai` — `https://hvxuzvhzsaocsnwznsai.supabase.co`

---

## 2. Repo layout (new / changed)

```
supabase/
  config.toml
  migrations/
    0001_schema.sql          all tables, enums, indexes, updated_at + handle_new_user triggers
    0002_rls.sql             RLS enable + policies for every table, is_participant()/is_admin()
    0003_rpc_realtime.sql    RPC functions, business triggers, realtime publication, rate-limit guards
  seed_static.sql            categories, partners, partner_placements, donation_records (idempotent)
scripts/
  seed-demo.ts               demo auth users + listings + conversations + proposals + reviews (service role)
  test-backend.ts            integration checks: RLS boundaries + proposal RPC state machine
src/lib/
  supabase.ts                supabase-js client (AsyncStorage session, autoRefresh, AppState)
  uploads.ts                 pick -> validate -> compress -> upload -> storage path
src/auth/
  session.ts                 useSession(), replaces authStore
src/api/
  ApiClient.ts               interface extracted from today's MockApiClient surface
  supabaseClient.ts          SupabaseApiClient implements ApiClient
  mockClient.ts              today's MockApiClient (moved here), Jest only
  client.ts                  apiClient = IS_TEST ? new MockApiClient() : new SupabaseApiClient()
  realtime.ts                useConversationChannel(), useInboxChannel(), usePresence()
BACKEND.md                   runbook: env, linking, migrations, seeding, deploy, two-account QA
.env.example                 committed template
.env                         gitignored — real keys
```

**Unchanged:** every screen; `queries.ts` hook signatures; `src/domain/*`. `src/data/*`
repositories stay but are reachable only through `mockClient.ts` (tests).
`src/data/authStore.ts` is deleted.

**Env vars:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (bundled,
safe). `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`
(scripts/CLI only, never imported by app code).

---

## 3. Schema (migration 0001)

Price is always `amount_minor bigint` + `currency text default 'NOK'`. **No payment
tables anywhere** (spec §23).

### Identity & profile
- `profiles` — PK `id` = `auth.users.id`; `display_name, avatar_path, initials,
  presentation, member_since, municipality, place, purpose, max_distance_km,
  is_business bool, role text ('user'|'admin') default 'user', onboarded_at,
  deleted_at, created_at`
- `verifications` — `(profile_id, kind)` unique; `kind` ENUM `PHONE|EMAIL|BUSINESS`;
  `verified bool, explanation text, verified_at`
- `business_profiles` — `profile_id PK, org_nr, company_name, contact_person, email,
  phone, status ('PENDING'|'APPROVED'|'REJECTED') default 'PENDING', category_slugs text[]`
- `consent_records` — `id, profile_id, terms, privacy, age, created_at`

### Catalog & listings
- `categories` — `slug PK, label, icon` (static)
- `listings` — `id, type` ENUM `TASK_REQUEST|SERVICE_OFFER`; `owner_id, title,
  category_slug, price_amount_minor bigint, price_currency default 'NOK',
  price_mode` ENUM `FIXED|BUDGET|FROM|BY_AGREEMENT`; `municipality, place, status`
  ENUM (all `ListingStatus` values from `domain/types.ts`); `search tsvector`
  (GIN index); `created_at`
- `task_details` — `listing_id PK, description, equipment, meeting_note,
  duration_text, scheduled_text`
- `service_offer_details` — `listing_id PK, about, experience_years, completed_jobs,
  services text[], availability_text, equipment_text, max_distance_km`
- `listing_images` — `id, listing_id, storage_path, ord`
- `saved_listings` — `(profile_id, listing_id) PK, created_at`
- `saved_searches` — `id, profile_id, name, filter jsonb, sort text, created_at`

### Conversations, proposals, agreements
- `conversations` — `id, listing_id, last_message_at, last_message_preview, created_at`
- `conversation_participants` — `(conversation_id, profile_id) PK`
- `messages` — `id, conversation_id, author_id, kind` ENUM `TEXT|PROPOSAL|SYSTEM|IMAGE`;
  `text, proposal_id, attachment_path, client_token text, created_at`.
  Unique `(conversation_id, author_id, client_token)` for idempotency.
- `message_reads` — `(conversation_id, profile_id) PK, last_read_at` — drives unread
- `proposals` — `id, listing_id, conversation_id, from_profile_id, to_profile_id,
  price_amount_minor, price_currency, message, scheduled_text, caveats, status`
  ENUM `DRAFT|SENT|WITHDRAWN|DECLINED|ACCEPTED|REVISION_PENDING`;
  `client_token text unique, created_at`
- `proposal_revisions` — `id, proposal_id, actor_id, note, price_amount_minor,
  scheduled_text, caveats, created_at`
- `agreement_snapshots` — `proposal_id PK, listing_id, price_amount_minor,
  price_currency, scheduled_text, description, caveats, agreed_at`

### Completion, reviews, safety, notifications
- `completion_confirmations` — `(agreement_proposal_id, by_profile_id) PK, confirmed_at`
- `reviews` — `id, agreement_proposal_id, listing_id, from_profile_id, to_profile_id,
  rating int CHECK 1..5, comment, created_at`; unique `(agreement_proposal_id, from_profile_id)`
- `reports` — `id, target_type` ENUM `USER|LISTING|PROPOSAL|MESSAGE|REVIEW`;
  `target_id, reason, details, by_profile_id, status ('OPEN'|'RESOLVED') default 'OPEN',
  resolved_by, resolved_at, created_at`
- `blocks` — `(by_profile_id, blocked_profile_id) PK, created_at`
- `notifications` — `id, profile_id, kind` ENUM (all `NotificationKind` values);
  `title, body, route, read bool default false, created_at`

### Read-only content (seeded, no CMS this phase)
- `partners` — `id, name, blurb, logo_path, url`
- `partner_placements` — `id, partner_id, surface, headline, active`
- `donation_records` — `id, recipient, amount_kr, period, transferred_at`

### Views / triggers
- `profile_ratings` view — `profile_id, average, count` from `reviews`; feeds
  `PublicProfile.rating`.
- `handle_new_user()` — AFTER INSERT on `auth.users`: create `profiles` row
  (display name from metadata, initials derived) + a `verifications` row
  `kind='EMAIL', verified=true`.
- `touch_updated_at()` on tables with `updated_at`.
- `bump_conversation()` — AFTER INSERT on `messages`: set
  `conversations.last_message_at` + `last_message_preview`.

---

## 4. Authorization (migrations 0002, 0003)

RLS enabled on every table. Helpers: `is_participant(conv uuid) returns bool`,
`is_admin() returns bool`.

### Direct table access (RLS)

| Table(s) | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `profiles` | any authenticated | UPDATE where `id = auth.uid()` |
| `listings`, `task_details`, `service_offer_details`, `listing_images` | any authenticated, `status <> 'REMOVED'` (owner always sees own) | writes where listing `owner_id = auth.uid()` |
| `saved_listings`, `saved_searches`, `notifications`, `message_reads`, `consent_records` | `profile_id = auth.uid()` | `profile_id = auth.uid()` |
| `conversations`, `conversation_participants` | `is_participant(id)` | none (RPC) |
| `messages` | `is_participant(conversation_id)` | INSERT where `is_participant` AND `author_id = auth.uid()` AND `kind IN ('TEXT','IMAGE')` |
| `proposals`, `proposal_revisions`, `agreement_snapshots` | participant of linked conversation | none (RPC) |
| `reviews` | any authenticated | none (RPC) |
| `reports` | `by_profile_id = auth.uid()` OR `is_admin()` | INSERT where `by_profile_id = auth.uid()`; UPDATE `is_admin()` |
| `blocks` | `by_profile_id = auth.uid()` | `by_profile_id = auth.uid()` |
| `business_profiles`, `verifications` | own OR `is_admin()` | none (RPC) |
| `categories`, `partners`, `partner_placements`, `donation_records` | any authenticated | none (seed) |

### RPC functions (SECURITY DEFINER, assert `auth.uid()`)

- `start_conversation_for_listing(p_listing_id uuid)` → find-or-create conversation +
  both participants; returns the conversation row.
- `send_proposal(p_conversation_id, p_listing_id, p_price_minor, p_message,
  p_scheduled_text, p_caveats, p_client_token)` → idempotent on `p_client_token`;
  validates the sender is a participant and holds the correct role for the listing
  type (offer-giver on `TASK_REQUEST`, requester on `SERVICE_OFFER`); inserts
  `proposals` (SENT) + `PROPOSAL` message + recipient notification. Rate-limited.
- `respond_to_proposal(p_proposal_id, p_event, p_actor)` → proposal state machine
  ported to plpgsql (same transition table as `src/domain/proposalMachine.ts`);
  on `ACCEPT` also writes `agreement_snapshots`, a `SYSTEM` message, sets
  `listings.status='AGREED'`, notifies. Rejects transitions the caller's role can't make.
- `revise_proposal(p_proposal_id, p_note, p_price_minor, p_scheduled_text, p_caveats)`
  → `REQUEST_REVISION` / `SUBMIT_REVISION` + `proposal_revisions` row + message.
- `mark_conversation_read(p_conversation_id)` → upsert `message_reads`.
- `confirm_completion(p_agreement_proposal_id)` → upsert confirmation; when both
  parties confirmed → `listings.status='COMPLETED'` + notifications.
- `submit_review(p_agreement_proposal_id, p_rating, p_comment)` → caller must be a
  party to a **completed** agreement; one review per party; notifies recipient.
- `submit_report(p_target_type, p_target_id, p_reason, p_details)` — rate-limited;
  `resolve_report(p_report_id)` — admin only.
- `request_verification(p_kind)` — phase 1: `EMAIL` already verified; `PHONE`/`BUSINESS`
  create a row `verified=false` + "kommer snart" explanation (matches current UI).
- `submit_business_profile(...)` → `business_profiles` row `PENDING`.
- `delete_own_account()` → soft-delete profile-owned rows + sign-out; hard `auth`
  delete via a `delete-account` edge function using the service role.

### Realtime & rate limiting
- Publication `supabase_realtime` includes `messages`, `conversations`, `proposals`,
  `notifications`.
- Presence: `presence:lobby` channel, each client tracks `{ profileId }`.
- Rate limits: per-user rolling-minute counters raised as exceptions inside
  `send_proposal`, a `BEFORE INSERT` trigger on `messages`, and `submit_report`.
  Login throttling is Supabase Auth's built-in.

---

## 5. Client — auth, session, onboarding

- `src/lib/supabase.ts` — client with AsyncStorage storage, `autoRefreshToken:true`,
  `persistSession:true`, `detectSessionInUrl:false`; `AppState` listener toggles
  `auth.startAutoRefresh()`/`stopAutoRefresh()`.
- `src/auth/session.ts` — `useSession()` → `{ session, userId, status:
  'loading'|'authed'|'anon' }` via `onAuthStateChange`. `src/data/authStore.ts`
  deleted. `useCurrentUser()` → query for the caller's `profiles` row (+ ratings view).
- `app/_layout.tsx` gate: `loading` → keep splash; `anon` → `/velkommen`; `authed`
  and `profiles.onboarded_at IS NULL` → resume onboarding at the right step; else app.
- Onboarding:
  - `LoginScreen`: email → `signInWithOtp({ email })` → 6-digit code →
    `verifyOtp({ email, token, type:'email' })`. Demo `0000` bypass removed.
  - `ConsentScreen`: insert `consent_records` on continue.
  - `SetupScreen`: update `profiles` (display name, purpose, municipality, place,
    distance) + set `onboarded_at`.
- **Dev switch** (`__DEV__` only): menu row + screen listing seeded demo users;
  `signInWithPassword` with the seed password. Excluded from production bundles.
- "Logg ut" → `signOut()`. "Slett konto" → `delete_own_account()` RPC +
  `delete-account` edge function.

---

## 6. Client — realtime, presence, offline

- `src/api/realtime.ts`:
  - `useConversationChannel(conversationId)` — subscribes to `messages` + `proposals`
    for that conversation → invalidates `messages`, `conversation`, `agreement`,
    `proposal` keys.
  - `useInboxChannel()` — mounted at app root when `authed`; subscribes to the
    caller's `conversations` + `notifications` → invalidates `conversations` +
    `notifications`; surfaces a toast/badge on a new notification.
  - `usePresence()` — joins `presence:lobby`, tracks `{ profileId }`; `online` on
    profile / active-user components reads the presence set.
- Offline: React Query `networkMode:'offlineFirst'`; query cache persisted to
  AsyncStorage via `@tanstack/query-async-storage-persister`; existing
  `OfflineBanner` + `ScreenState` cover the visible states.

---

## 7. Client — image uploads

- `npx expo install expo-image-picker expo-image-manipulator`.
- Buckets: `avatars` (public read), `listing-images` (public read),
  `chat-attachments` (private; participant-only read policy, signed URLs).
  Storage RLS: authenticated upload only under `"{auth.uid()}/…"`.
- `src/lib/uploads.ts`: `pickImage({ source })` → validate mime (`jpeg|png|webp`) +
  size (≤ 8 MB) → `expo-image-manipulator` downscale (max 1600px) + compress →
  upload → return storage path. Failures surface as Norwegian field errors.
- Wire: `AttachSheet` (camera + library), `ImagePickerField` (listing images, multi),
  `EditProfileScreen` (avatar).

---

## 8. Data model mapping & the `ApiClient` interface

`ApiClient` is the exact current `MockApiClient` method surface (see
`src/api/client.ts`). `SupabaseApiClient` implements each method with
`supabase.from(...).select()/insert()` or `supabase.rpc(...)`, mapping snake_case
rows → the camelCase `domain/types.ts` shapes in one `src/api/mappers.ts` module.
The `listConversations` / `getConversation` queries select the conversation with
its participants, latest message, `message_reads`, and latest proposal in a single
nested `select`; the mapper then derives `Conversation.counterpart` (the
participant that is not `auth.uid()`), `.unread` (`last_message_at >
my message_reads.last_read_at`), and `.statusTag` (from the latest proposal's
status) client-side. No per-viewer database view is needed.

---

## 9. Testing

- All 93 Jest tests keep running against `MockApiClient` (`IS_TEST` selector).
  `MockApiClient` and the `src/data` repositories are updated only where the
  `ApiClient` interface changes shape.
- New `scripts/test-backend.ts` (`npm run test:backend`): signs in as two demo
  users against the real project and asserts —
  - a non-participant cannot read a conversation or its messages;
  - a non-owner cannot update a listing;
  - `send_proposal` is idempotent on `client_token`;
  - the full proposal lifecycle SEND→ACCEPT→agreement snapshot, and an illegal
    transition is rejected;
  - `submit_review` rejects a non-party and rejects before completion.
- A Jest test asserts the plpgsql transition table (exported as a JSON fixture from
  the migration, or duplicated constant) matches `src/domain/proposalMachine.ts`.
- Manual two-account QA checklist in `BACKEND.md` for the full E2E
  (find → propose → chat → accept → complete → review).

---

## 10. Rollout order

1. `supabase init` + `link`; `src/lib/supabase.ts`; `.env` / `.env.example`; add
   `@supabase/supabase-js`, `expo-image-picker`, `expo-image-manipulator`,
   `@tanstack/query-async-storage-persister`.
2. Migration `0001_schema.sql` → `db push` → `supabase gen types` into
   `src/lib/database.types.ts`.
3. Migration `0002_rls.sql` → push.
4. Migration `0003_rpc_realtime.sql` → push.
5. `seed_static.sql` + `scripts/seed-demo.ts` → run.
6. `ApiClient` interface + `mappers.ts` + `SupabaseApiClient` + `client.ts` selector.
7. `session.ts` + onboarding screens to real auth + `_layout` gate + dev switch;
   delete `authStore`.
8. `realtime.ts` + presence + offline persistence.
9. Image uploads (buckets, policies, `uploads.ts`, wire the 3 surfaces).
10. Screen-by-screen audit: wire every screen to real data, remove stubs, verify
    loading / empty / error / offline / success / no-access for each.
11. `scripts/test-backend.ts`; update Jest mocks; `npm test` + `npm run typecheck`
    green; `npx expo export --platform ios`.
12. `BACKEND.md`.

---

## 11. Deferred to phase 2 (explicitly out of scope now)

Analytics/metrics dashboards (§25); `AuditLog` table + admin audit view;
`FeatureFlag` system; Partner CMS / placement management (UI stays read-only from
seed); `ExternalAgreementStatus` / BankID integration (schema kept open only);
background jobs (listing expiry etc.); push notifications (in-app notifications
only for now).
