# Automatic location + kommune-scoped content — design

**Date:** 2026-09-05
**Status:** approved for planning
**Related:** [[minnabo-supabase-backend]], `2026-08-29-minnabo-supabase-backend-design.md`

## Goal

MinNabo should learn the user's **kommune** automatically from device GPS, and
every neighbour-facing surface (oppdrag, tilbud, partners/sponsors, oppslagstavle,
nabolag groups) should show only content from that kommune — optionally widened to
neighbouring kommuner via a reach control.

Decisions taken during brainstorming:

| Question | Decision |
| --- | --- |
| Data layer | Both — build mock-first, then mirror in Supabase |
| Match granularity | **Kommune match** (no coordinates on content) |
| Scoped surfaces | Oppdrag & tilbud, partners/sponsors, oppslagstavle, nabolag groups |
| Stored precision | **Approximate only** — GPS fix used transiently on-device, never stored or transmitted; only the resolved kommune name is persisted |
| Filter behaviour | **Hard scope** — lists always show the user's kommune (widen-only via reach control, no arbitrary "show everywhere") |
| Auto-detect timing | First launch (onboarding permission prompt) + on-demand button afterwards |
| Posting | Auto-fill kommune + place from the poster's profile, editable |
| Distance slider | Repurposed as a **kommune-reach** control (own kommune → + neighbours → + wider region), backed by an adjacency table |

## Non-goals

- No lat/lng storage, PostGIS, or radius-in-km filtering.
- No background location, no "always" permission.
- No partner CMS (still seeded — phase 2).
- No reverse-geocoding provider integration beyond what `expo-location` gives for
  free from the OS.
- Kommuner outside Innlandet are resolved best-effort; the adjacency graph only
  covers the kommuner MinNabo currently seeds/serves.

## Architecture

### 1. Native location — `expo-location`

- Add `expo-location` (SDK 57 compatible) and its config plugin to `app.json`:
  ```jsonc
  ["expo-location", {
    "locationWhenInUsePermission":
      "MinNabo bruker posisjonen din én gang for å finne kommunen din, slik at du ser oppdrag og naboer i nærheten.",
    "isAndroidBackgroundLocationEnabled": false,
    "isAndroidForegroundServiceEnabled": false
  }]
  ```
- Request **foreground, coarse** accuracy only. Kommune-level resolution needs
  nothing finer and it is faster + less alarming in the permission dialog.
- This is a new native module: the current mock APK has no GPS. A fresh
  `eas build` is required once this lands. The feature still runs in mock mode
  (fake detect) with no native dependency exercised.

#### `src/lib/geo.ts`

```ts
type DetectResult =
  | { municipality: string; place?: string }
  | { error: 'denied' | 'unavailable' };

async function detectKommune(): Promise<DetectResult>;
```

- Mock mode (`ENV.useMocks`): resolves `{ municipality: 'Lillehammer', place: 'Lillehammer' }`
  after ~700 ms (keeps the current mock feel; no `expo-location` import on this path).
- Real path:
  1. `Location.getForegroundPermissionsAsync()`; if not granted,
     `requestForegroundPermissionsAsync()`. Denied → `{ error: 'denied' }`.
  2. `Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low })`.
     Throw / timeout / location services off → `{ error: 'unavailable' }`.
  3. `Location.reverseGeocodeAsync({ latitude, longitude })`. Take the first
     result; candidate kommune name = `subregion || city || region`; candidate
     place = `city || district || subregion`.
  4. `resolveKommune(candidate)` (see §2). Unresolvable → `{ error: 'unavailable' }`.
- The coordinate object never leaves this function.

> **Implementation check:** confirm which `reverseGeocodeAsync` field carries the
> kommune for Norwegian addresses on both iOS and Android (expected `subregion`,
> with `city` as fallback). Verify against a device during Task for §1.

### 2. Kommune reference data — `src/data/kommuner.ts`

New module, sits alongside the existing `postalCodes.ts` (which keeps its
poststed lookup):

```ts
export const INNLANDET_KOMMUNER: string[];              // canonical names
export const PLACE_TO_KOMMUNE: Record<string, string>;  // "Brumunddal" -> "Ringsaker"
export const POSTAL_TO_KOMMUNE: Record<string, string>; // "2380" -> "Ringsaker"
export const KOMMUNE_NEIGHBOURS: Record<string, string[]>;

export function resolveKommune(input: string): string | undefined;
export function expandKommuner(base: string, reach: 0 | 1 | 2): string[];
```

- `resolveKommune`: exact canonical match → `PLACE_TO_KOMMUNE` → `POSTAL_TO_KOMMUNE`
  (via `isPostalCode`) → case/whitespace-insensitive canonical match → `undefined`.
- `expandKommuner(base, 0)` → `[base]`.
  `reach 1` → `base` + direct neighbours.
  `reach 2` → adds neighbours-of-neighbours; when `base` is absent from
  `KOMMUNE_NEIGHBOURS`, `reach 1` → `[base]` and `reach 2` → all
  `INNLANDET_KOMMUNER` (region-wide).
- `POSTAL_TO_KOMMUNE` is derived by composing the existing `postalCodes.ts` map
  with `PLACE_TO_KOMMUNE` at module load, plus explicit entries where they differ.
- `KOMMUNE_NEIGHBOURS` is hand-authored for the ~15 kommuner MinNabo seeds/serves
  (Lillehammer, Øyer, Gausdal, Ringsaker, Hamar, Stange, Gjøvik, Østre Toten,
  Vestre Toten, Elverum, Åmot, Kongsvinger, Sel, Nord-Fron, Sør-Fron, …). Kommuner
  absent from the map degrade gracefully (reach only ever widens the set).

### 3. Data model changes

#### Types (`src/domain/types.ts`)

- `ListingFilter` gains `municipalities?: string[]` — an explicit allow-list the
  caller resolves; keeps the repositories/Supabase client free of geo logic.
- No change to `LocationInfo` (already has `municipality`).

#### `ApiClient` / patches (`src/api/ApiClient.ts`)

- `UpdateProfilePatch` gains `municipality?: string`.
- `createNoticeboardPost` input gains `municipality: string`.

#### Mock layer

- `profileRepository.updateProfile`: set `place` and `municipality`
  **independently** (stop the `municipality: patch.place` copy). Add `municipality`
  to the accepted patch shape.
- `repositories.matchesFilter`: when `filter.municipalities?.length`, require
  `filter.municipalities.includes(listing.location.municipality)`.
- `noticeboardStore`: `NoticeboardPost` + `create()` gain `municipality`; seed
  posts get kommune values.
- `seedCommunity.partners`: `Partner` gains `municipality: string` (keep `town`
  for display); fill all six rows.
- Seed listings (`src/data/seed.ts`): spread across a few kommuner
  (most Lillehammer; a couple Øyer / Gausdal / Ringsaker / Gjøvik) so hard scope
  and the reach control are visibly exercised. Demo user stays Lillehammer.
- Suggested nabolag groups (wherever `NeighbourhoodScreen` sources them) filtered
  by the kommune set.

#### Supabase layer

- Migration `supabase/migrations/0021_location_scoping.sql`:
  ```sql
  alter table partners           add column if not exists municipality text;
  alter table neighbourhoods     add column if not exists municipality text;
  alter table noticeboard_posts  add column if not exists municipality text;
  create index if not exists listings_municipality_idx on listings (municipality);
  ```
  No RLS change — kommune is a filter, not a security boundary; all rows stay
  readable.
- `seed_static.sql`: add `municipality` to the seeded `partners` insert.
- `SupabaseApiClient.listListings`: `if (filter?.municipalities?.length) q = q.in('municipality', filter.municipalities)`.
- `SupabaseApiClient.updateProfile`: `if (patch.municipality !== undefined) row.municipality = patch.municipality`.
- `SupabaseApiClient.createListing`: store the resolved kommune in `municipality`
  (currently `listing.location.municipality`, which `buildListing` will now fill
  correctly — see §6).
- `SupabaseApiClient.createNoticeboardPost`: write `municipality`.
- `mappers.ts`: map the new `municipality` columns for notices / partners /
  neighbourhoods where those rows are read.

### 4. Location scope hook — `src/lib/locationScope.ts` + hook

- Persists the **reach** preference (0/1/2) in AsyncStorage, following the exact
  store pattern of `src/lib/neighbourhood.ts` (module singleton + listener set +
  `useLocationScope()` hook).
- `useLocationScope()` returns:
  ```ts
  {
    municipality: string | undefined;   // from profile
    municipalities: string[];           // expandKommuner(municipality, reach); [] when unknown
    label: string;                      // "Lillehammer kommune", "+ nabokommuner", …
    reach: 0 | 1 | 2;
    setReach: (r: 0 | 1 | 2) => void;
    ready: boolean;                     // profile loaded
  }
  ```
- When `municipality` is undefined (never onboarded / detect failed and no manual
  pick), `municipalities` is `[]` and callers pass `undefined` → no filtering
  (fail open, don't show an empty app).

### 5. Screen wiring

| Screen | Change |
| --- | --- |
| `OppdragScreen` | pass `municipalities` into both `useListings` calls |
| `ListingListScreen` (see-all) | same |
| `LeadBoardScreen` | same |
| `TilbydereScreen` | same |
| `SearchScreen` | scope applied as a base filter; reach control available in the filter sheet |
| Saved-search execution | intersect stored filter with current scope |
| `FellesskapScreen` | `localPartners` filtered by `municipalities`; MAIN partners always shown; empty-state note when no local partner |
| `NoticeboardScreen` | list filtered by `municipalities` |
| `NeighbourhoodScreen` | `local` / `localNotices` use the kommune set instead of the current `me.place` substring match |

Empty states: each scoped list shows a short "Ingen … i {kommune} akkurat nå —
prøv å utvide rekkevidden" message that points at the reach control.

### 6. LocationBar + onboarding + posting

#### `src/components/LocationBar.tsx`

- Bar shows `{municipality} kommune` (falls back to a "Velg kommune" prompt when
  unknown) + a second line describing reach ("Bare din kommune" / "+ nabokommuner"
  / "+ hele regionen").
- Sheet:
  - **"Bruk posisjonen min"** → `detectKommune()`:
    - success → `useUpdateProfile().mutate({ municipality, place })`, close.
    - `denied` → inline text: open Settings / pick manually.
    - `unavailable` → inline text: pick manually.
  - **Kommune picker** — searchable list of `INNLANDET_KOMMUNER` (replaces the
    free-text place field). Postal-code entry still accepted → `resolveKommune`.
  - **Reach control** — 3-stop segmented control (0/1/2) writing through
    `setReach`. Replaces the km `DistanceSlider` on this screen.
- `detectLocation()` mock helper is removed; `geo.detectKommune` replaces it.

#### `src/screens/Onboarding/SetupScreen.tsx`

- Add a "Bruk posisjonen min" button above the kommune field that fills
  `municipality` (+ `place`) via `detectKommune()`. This is the **first-launch
  permission prompt**.
- Keep the manual `municipality` / `place` fields as the fallback (already
  present).
- Drop the `DISTANCES` km chips; onboarding defaults `reach = 0` (the reach
  control lives only in `LocationBar`).

#### Posting — `TaskRequestForm`, `ServiceOfferForm`, `buildListing.ts`

- Form state seeds `place` **and** a new `municipality` from the current user's
  profile (`useCurrentUser` extended to expose `municipality`, or read the profile
  directly). Both editable; `municipality` via the same kommune picker component.
- `buildTaskListing` / `buildOfferListing`: `location.municipality = form.municipality`
  (resolved), `location.place = form.place`. Stop `municipality: form.place.trim()`.
- Supabase `createListing` already reads `listing.location.municipality`.

### 7. i18n (`src/i18n/nb.ts`)

- Revise `home.locationSuffix` / `home.changeLocation` / `home.locating`.
- Add: reach-level labels, permission-denied + unavailable copy, kommune-picker
  title/search placeholder, per-surface empty-state strings, onboarding
  "use my location" button + hint.

### 8. Tests

- `tests/data/kommuner.test.ts` — `resolveKommune` (canonical, place alias,
  postal, unknown), `expandKommuner` (reach 0/1/2, unknown base).
- `tests/lib/geo.test.ts` — `expo-location` mocked: denied → `{error:'denied'}`;
  no fix → `{error:'unavailable'}`; happy path → kommune via `subregion`, and via
  `city` fallback; mock-mode short-circuit.
- `tests/lib/locationScope.test.ts` — reach persists + emits; unknown kommune →
  `[]`.
- `tests/data/repositories.test.ts` — `municipalities` filter includes/excludes.
- `tests/components/LocationBar.test.tsx` — detect→save; denied→fallback message;
  reach control persists; kommune picker updates profile.
- Screen tests: `OppdragScreen` scoped to the demo user's kommune;
  `FellesskapScreen` local partners filtered, MAIN always shown;
  `NoticeboardScreen` scoped.
- Update existing tests that assume `municipality === place` or that every seed
  listing is visible (seed spread changes counts) — `leggUt.test.tsx`,
  `community-safety.test.tsx`, `types.test.ts`, any Oppdrag/Search screen test.
- `jest-setup.ts` — add an `expo-location` mock.

### 9. Migration / rollout

1. Land code + migration on `main` (mock path fully working, Jest green,
   typecheck clean).
2. Human applies `0021` via `npm run db:push`, re-runs `npm run db:types`,
   re-seeds static partners.
3. Fresh `eas build --profile preview` (both platforms) — first build carrying
   `expo-location`.
4. Existing profiles with `municipality = place` (from the old copy behaviour)
   keep working; they can re-set via "Bruk posisjonen min".

## Risks / open items

- **`reverseGeocodeAsync` field names** for Norwegian kommuner — verify on device
  (§1 check).
- **Adjacency completeness** — a missing edge just means reach 1 shows fewer
  kommuner than ideal; never wrong content. Acceptable.
- **Small-kommune sparsity** — mitigated by the reach control + empty-state copy
  pointing at it.
- **`expo-location` + SDK 57** — confirm the exact compatible version during §1.
- Users who deny permission and never pick a kommune see an unscoped app (fail
  open) — acceptable and intentional.
