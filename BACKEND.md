# MinNabo Backend (Supabase)

The app runs against a hosted Supabase project. Design:
`docs/superpowers/specs/2026-08-29-minnabo-supabase-backend-design.md`.
Plan: `docs/superpowers/plans/2026-08-29-minnabo-supabase-backend.md`.

Project ref: **`hvxuzvhzsaocsnwznsai`** — `https://hvxuzvhzsaocsnwznsai.supabase.co`

---

## 1. Environment

Copy `.env.example` → `.env` (gitignored) and fill in:

| Var | Where to get it | Used by |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | the app (bundled) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → publishable key (`sb_publishable_…`) | the app (bundled) |
| `SUPABASE_DB_PASSWORD` | Project Settings → Database → password | `supabase link` / `db push` |
| `SUPABASE_DB_URL` | Project Settings → Database → Connection string (Direct), with the password inlined | `psql` seed step |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role / secret key (`sb_secret_…`) | `scripts/seed-demo.ts`, `scripts/test-backend.ts` |
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens | the CLI (or run `npx supabase login` instead) |

`EXPO_PUBLIC_*` are the only vars that reach the app bundle. The rest are used
only by the CLI and the `scripts/`; nothing under `src/` or `app/` imports them.

---

## 2. Link the project

```bash
set -a; source .env; set +a
npx supabase login            # once, if SUPABASE_ACCESS_TOKEN is not set
npx supabase link --project-ref hvxuzvhzsaocsnwznsai --password "$SUPABASE_DB_PASSWORD"
```

---

## 3. Migrations

Migration files live in `supabase/migrations/` and are the source of truth:

| File | Contents |
|---|---|
| `0001_schema.sql` | all tables, enums, indexes, `handle_new_user` / `bump_conversation` / search triggers, `profile_ratings` view |
| `0002_rls.sql` | RLS on every table + `is_participant()` / `is_admin()` / `owns_listing()` |
| `0003_rpc_realtime.sql` | RPC functions (proposal state machine, agreements, completion, reviews, reports, verification, business profile), message rate-limit trigger, realtime publication |
| `0004_storage.sql` | Storage buckets (`avatars`, `listing-images`, `chat-attachments`) + object policies |
| `0005_dev_otp.sql` | **dev/test only** — `dev_otp_codes` table + `get_dev_otp` / `set_dev_otp` so the login screen can show the email code (see §5a) |

Apply everything and regenerate the TS types:

```bash
set -a; source .env; set +a
npm run db:push
npm run db:types      # writes src/lib/database.types.ts
```

After `db:types` runs against the live DB, re-add the generic in
`src/lib/supabase.ts` (`createClient<Database>(…)`) for full column typing.

Add a new migration:

```bash
npx supabase migration new <name>
# edit supabase/migrations/<timestamp>_<name>.sql
npm run db:push
```

---

## 4. Seeding

**Static catalogue** (categories, partners, donations) — idempotent:

```bash
set -a; source .env; set +a
psql "$SUPABASE_DB_URL" -f supabase/seed_static.sql
```

**Demo data** (6 users + listings + one live proposal/conversation) — idempotent:

```bash
npm run seed:demo
```

Demo logins — every account uses password **`minnabo-demo`**:

| Email | Name |
|---|---|
| `me@minnabo.test` | Marius B. |
| `emma@minnabo.test` | Emma Larsen |
| `martin@minnabo.test` | Martin Ruud |
| `sara@minnabo.test` | Sara Ahmed |
| `andreas@minnabo.test` | Andreas Berg |
| `fjellbygg@minnabo.test` | Fjellbygg AS |

In a dev build, **Innstillinger → Bytt testbruker** signs in as any of these
without a password prompt (the screen is stripped from production builds).

To make someone an admin: `update profiles set role = 'admin' where id = '<uuid>';`

---

## 5. Edge functions

```bash
npx supabase functions deploy delete-account
```

`delete-account` verifies the caller's JWT and hard-deletes their `auth.users`
row (FK cascade removes the profile and everything it owns). Called from
**Innstillinger → Slett konto**.

### 5a. Dev OTP — show the login code on screen (TEST ONLY)

Supabase's free tier only sends a handful of auth emails per hour, and it
hashes the OTP so the client can never read it. For testing, register the
`auth-email` **Send Email Hook**: it intercepts the code, stores it in
`dev_otp_codes`, and sends no email. The login screen then polls `get_dev_otp`
and shows the code (only in `__DEV__` builds, only when a code turns up).

```bash
npx supabase functions deploy auth-email --no-verify-jwt
```

Then Dashboard → **Authentication → Hooks → Send Email Hook** → enable →
point at the deployed `auth-email` function.

> ⚠️ **Never register the `auth-email` hook on a production project.** With it
> off, `dev_otp_codes` stays empty and `get_dev_otp` returns null, so the
> on-screen code never appears in production. To turn testing off again: disable
> the hook in the dashboard.

---

## 6. Realtime

Publication `supabase_realtime` includes `messages`, `conversations`,
`proposals`, `notifications`. The client subscribes via `src/api/realtime.ts`:
`useConversationChannel` (open chat), `useInboxRealtime` (root), `usePresence`
(the "Aktiv nå" dot).

---

## 7. Tests

- **Unit / component:** `npm test` — runs against the in-memory `MockApiClient`,
  never the network. 106 tests.
- **State-machine parity:** `tests/domain/proposalMachineParity.test.ts` asserts
  the plpgsql `proposal_next()` matches `src/domain/proposalMachine.ts`. Update
  both when the rules change.
- **Backend integration:** `npm run test:backend` — signs in as two demo users
  and checks RLS boundaries + the proposal RPC lifecycle against the live
  project. Needs a populated `.env` and `npm run seed:demo` first.

---

## 8. Manual QA — the two end-to-end flows

Use two accounts (two simulators, or a device + simulator).

**Flow 1 — task → offer → agree → complete → review**
1. Account A: Legg ut → "Trenger jobb" → publish a `TASK_REQUEST`.
2. Account B: open it → "Kontakt" → in chat send an offer (Send tilbud).
3. Account A: Mottatte tilbud → open the offer → Godta → lands on Avtale.
4. Both: Avtale → "Marker som fullført".
5. Both: Vurder → submit a rating. Check it shows on the other's profile.

**Flow 2 — service offer → request → agree**
1. Account A: Legg ut → "Tilby jobb" → publish a `SERVICE_OFFER`.
2. Account B: open it → "Be om tilbud" → chat opens.
3. Account A: send an offer from chat → Account B accepts → Avtale.

Check along the way: new messages/offers appear live without refresh;
notifications arrive; a non-participant opening `/chat/<id>` gets "no access".

---

## 9. Deferred to phase 2

Analytics dashboards, `AuditLog`, feature flags, partner CMS, BankID
(`ExternalAgreementStatus`), background jobs, push notifications. See the design
doc §11.
