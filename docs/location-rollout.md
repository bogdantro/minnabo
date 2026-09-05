# Location + kommune-scoping — rollout runbook

Post-merge steps for the "automatic location + kommune-scoped content" feature
(branch tasks 1–13, spec `.superpowers/sdd/2026-09-05-location-kommune-scoping`).

This branch adds the `expo-location` native module and kommune-based content
filtering. Nothing here changes RLS.

## 1. Database

Run from the repo root with `.env` loaded (`set -a; source .env; set +a`).

```bash
npm run db:push        # applies supabase/migrations/0021_location_scoping.sql
npm run db:types       # regenerates src/lib/database.types.ts from the live DB
```

`0021` adds `partners.municipality`, `neighbourhoods.municipality`,
`noticeboard_posts.municipality` (not-null default `''`), a
`listings (municipality)` index, and backfills existing notices where
`place` already holds the kommune name.

After `db:types` runs against the live DB, re-add the generic in
`src/lib/supabase.ts` (`createClient<Database>(…)`) — see `BACKEND.md` §3.

## 2. Re-seed the static catalogue

`supabase/seed_static.sql` now sets `partners.municipality` (and is idempotent
via `on conflict … do update`). Re-run it so `partners.municipality` is
populated for the kommune-scoped Fellesskap / Nabolag lists:

```bash
set -a; source .env; set +a
psql "$SUPABASE_DB_URL" -f supabase/seed_static.sql
```

## 3. Fresh EAS builds

This is the **first build carrying `expo-location`** (native module + config
plugin in `app.json`). The current mock APK/IPA has no GPS, so a new build is
required for on-device location to work at all:

```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

## 4. On-device check — reverse-geocode → kommune (Task 2, still OPEN)

`src/lib/geo.ts` maps the device coordinate to a kommune via
`Location.reverseGeocodeAsync()`, reading fields in the order
`subregion || city || region` (then `resolveKommune()` normalises).

On a real device (BOTH iOS and Android), with mocks off, confirm that a
Norwegian address resolves to the correct kommune:

- Expected: `subregion` carries the kommune (e.g. `"Gjøvik"`).
- If **iOS** returns the kommune in `city` instead of `subregion` and the
  current order still works, no change is needed (`city` is already the second
  fallback). Only if iOS puts something *else* in `city` (e.g. a bydel /
  poststed) that shadows the kommune, reorder the chain in `geo.ts` so the
  field that actually holds the kommune wins, and note the platform in a code
  comment.

## 5. Mock flag — testers still see Lillehammer

All three `eas.json` build profiles keep `EXPO_PUBLIC_USE_MOCKS: "true"`, so
`detectKommune()` short-circuits to `Lillehammer` and the app shows mock data.
Flip `EXPO_PUBLIC_USE_MOCKS` to `"false"` in `eas.json` (`preview` +
`production`) when the Supabase backend should drive the app, then rebuild.

## Branch verification (task 13, commit dbfba73)

- `npm test` — 192 passed, 2 failed, 194 total. The 2 failures
  (`tests/screens/chat.test.tsx`: "accepting an offer in chat shows Tilbud
  godtatt", "the pinned job card shows the agreed price once an offer is
  accepted") are the pre-existing known-red baseline, unrelated to this feature.
- `npm run typecheck` — clean.
- `npx expo export --platform android` — success, no `expo-location`
  resolution errors.
- `npx expo export --platform ios` — success, no `expo-location`
  resolution errors.
