# Automatic location + kommune-scoped content — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Learn the user's kommune from device GPS on first launch, and scope every neighbour-facing list (oppdrag, tilbud, partners, oppslagstavle, nabolag) to that kommune, widen-able to neighbouring kommuner via a reach control.

**Architecture:** A pure `kommuner.ts` reference module (canonical names, place/postal aliases, adjacency graph) underpins everything. `geo.ts` wraps `expo-location` behind `detectKommune()` and short-circuits in mock mode. A `useLocationScope()` hook (AsyncStorage-backed, same pattern as `neighbourhood.ts`) turns the profile's kommune + a persisted reach level into a `municipalities: string[]` allow-list that screens pass into `ListingFilter`. Both `MockApiClient` (Jest) and `SupabaseApiClient` (runtime) apply the allow-list. No coordinates are ever stored or transmitted.

**Tech Stack:** Expo (SDK ~57) / React Native, `expo-location`, `@tanstack/react-query`, Supabase (Postgres + RLS), Jest + `@testing-library/react-native`, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-05-location-kommune-scoping-design.md`

## Global Constraints

- All user-facing strings live in `src/i18n/nb.ts`, norsk bokmål, no i18n framework. Every new string goes there and is referenced as `nb.<section>.<key>`.
- `expo-location` version MUST be resolved by `npx expo install expo-location` (never hand-pinned) so it matches the Expo SDK.
- Request **foreground + coarse/low accuracy only**. No background location, no "always" permission.
- A raw coordinate object never leaves `src/lib/geo.ts`. Only the resolved kommune name (and optional place name) is persisted or sent.
- Mock mode (`ENV.useMocks`, also `NODE_ENV === 'test'`) MUST NOT import `expo-location`; `geo.ts` branches before any native import.
- Kommune is a filter, not a security boundary: no RLS changes, all rows stay readable.
- `ListingFilter.municipalities` semantics: `undefined` or `[]` ⇒ no location filtering (fail open). A non-empty array ⇒ listing matches iff `array.includes(listing.location.municipality)`.
- Follow existing file patterns: singleton store + `Set<() => void>` listeners + `useX()` hook (see `src/lib/neighbourhood.ts`); mock repos in `src/data/*`, mappers in `src/api/mappers.ts`.
- TDD: write the failing test first, watch it fail, minimal implementation, watch it pass, commit. Run `npm test` (all) before each commit; run `npm run typecheck` before commits that change types.

---

## File Structure

**Created:**
- `src/data/kommuner.ts` — canonical Innlandet kommune list, place/postal→kommune alias maps, adjacency graph, `resolveKommune()`, `expandKommuner()`.
- `src/lib/geo.ts` — `detectKommune()`: permission + `getCurrentPositionAsync` + `reverseGeocodeAsync` → kommune; mock-mode short-circuit.
- `src/lib/locationScope.ts` — reach-preference singleton store + `useLocationScope()` hook.
- `src/components/ReachControl.tsx` — 3-stop segmented control (0/1/2) for kommune reach.
- `src/components/KommunePicker.tsx` — searchable kommune list + postal-code entry, used by LocationBar and the setup/posting forms.
- `tests/data/kommuner.test.ts`, `tests/lib/geo.test.ts`, `tests/lib/locationScope.test.ts`, `tests/components/reachControl.test.tsx`, `tests/components/kommunePicker.test.tsx`.

**Modified:**
- `app.json` — add `expo-location` plugin + permission string.
- `jest-setup.ts` — add `expo-location` mock.
- `src/domain/types.ts` — `ListingFilter.municipalities?: string[]`; `Partner`? (no — Partner is in `seedCommunity.ts`).
- `src/api/ApiClient.ts` — `UpdateProfilePatch.municipality?`; `createNoticeboardPost` input `municipality`.
- `src/data/repositories.ts` — `matchesFilter` municipality allow-list.
- `src/data/profileRepository.ts` — independent `municipality` in `updateProfile`.
- `src/data/noticeboardStore.ts` — `municipality` on posts + `create()`.
- `src/data/seedCommunity.ts` — `Partner.municipality` + fill 6 rows.
- `src/data/seed.ts` — spread seed listings across kommuner.
- `src/api/mockClient.ts` — thread `municipality` through `updateProfile` / `createNoticeboardPost`.
- `src/api/mappers.ts` — `NoticeRow.municipality`; `toNoticeboardPost`.
- `src/api/supabaseClient.ts` — `.in('municipality', …)` filter; independent `municipality` in `updateProfile`; `municipality` on `createNoticeboardPost` + `createListing`.
- `supabase/migrations/0021_location_scoping.sql` — new.
- `supabase/seed_static.sql` — partner `municipality`.
- `src/components/LocationBar.tsx` — kommune label, `geo.detectKommune`, `KommunePicker`, `ReachControl`.
- `src/hooks/useCurrentUser.ts` — expose `municipality`.
- `src/screens/OppdragScreen.tsx`, `src/screens/ListingListScreen.tsx`, `src/screens/LeadBoardScreen.tsx`, `src/screens/TilbydereScreen.tsx`, `src/screens/SearchScreen.tsx` — pass `municipalities`.
- `src/screens/SavedScreen.tsx` (saved-search run) — intersect with scope.
- `src/screens/FellesskapScreen.tsx` — local-partner filter.
- `src/screens/NoticeboardScreen.tsx` — scope filter.
- `src/screens/NeighbourhoodScreen.tsx` — kommune set instead of `me.place` substring.
- `src/screens/Onboarding/SetupScreen.tsx` — "Bruk posisjonen min" button.
- `src/screens/LeggUt/TaskRequestForm.tsx`, `src/screens/LeggUt/ServiceOfferForm.tsx`, `src/screens/LeggUt/buildListing.ts` — kommune field + resolved `municipality`.
- `src/i18n/nb.ts` — new strings (folded into each task).
- Existing tests touched: `tests/screens/oppdrag.test.tsx`, `tests/screens/search.test.tsx`, `tests/screens/leadBoard.test.tsx`, `tests/screens/listingList.test.tsx`, `tests/screens/community-safety.test.tsx`, `tests/screens/neighbourhood.test.tsx`, `tests/screens/noticeboard.test.tsx`, `tests/screens/saved-search.test.tsx`, `tests/screens/leggUt.test.tsx`, `tests/screens/onboarding.test.tsx`, `tests/domain/types.test.ts`, `tests/data/seed.test.ts`, `tests/api/mappers.test.ts`.

---

## Task 1: Kommune reference data

**Files:**
- Create: `src/data/kommuner.ts`
- Test: `tests/data/kommuner.test.ts`
- Reference: `src/data/postalCodes.ts` (existing `lookupPostalCode`, `isPostalCode`)

**Interfaces:**
- Consumes: `isPostalCode`, `lookupPostalCode` from `src/data/postalCodes.ts`.
- Produces:
  - `INNLANDET_KOMMUNER: readonly string[]`
  - `KOMMUNE_NEIGHBOURS: Record<string, readonly string[]>`
  - `resolveKommune(input: string): string | undefined`
  - `expandKommuner(base: string | undefined, reach: 0 | 1 | 2): string[]`

- [ ] **Step 1: Write the failing test**

```ts
// tests/data/kommuner.test.ts
import {
  INNLANDET_KOMMUNER,
  resolveKommune,
  expandKommuner,
} from '@/data/kommuner';

describe('resolveKommune', () => {
  it('returns a canonical kommune unchanged', () => {
    expect(resolveKommune('Lillehammer')).toBe('Lillehammer');
  });
  it('is case- and whitespace-insensitive', () => {
    expect(resolveKommune('  lillehammer ')).toBe('Lillehammer');
  });
  it('maps a poststed/by alias to its kommune', () => {
    expect(resolveKommune('Brumunddal')).toBe('Ringsaker');
    expect(resolveKommune('Moelv')).toBe('Ringsaker');
    expect(resolveKommune('Raufoss')).toBe('Vestre Toten');
  });
  it('maps a 4-digit postnummer to its kommune', () => {
    expect(resolveKommune('2380')).toBe('Ringsaker');
    expect(resolveKommune('2615')).toBe('Lillehammer');
  });
  it('returns undefined for something unrecognised', () => {
    expect(resolveKommune('Atlantis')).toBeUndefined();
    expect(resolveKommune('')).toBeUndefined();
  });
});

describe('expandKommuner', () => {
  it('reach 0 is just the base kommune', () => {
    expect(expandKommuner('Lillehammer', 0)).toEqual(['Lillehammer']);
  });
  it('reach 1 adds direct neighbours (deduped, base first)', () => {
    const r = expandKommuner('Lillehammer', 1);
    expect(r[0]).toBe('Lillehammer');
    expect(r).toEqual(expect.arrayContaining(['Øyer', 'Gausdal']));
    expect(new Set(r).size).toBe(r.length);
  });
  it('reach 2 is a superset of reach 1', () => {
    const r1 = expandKommuner('Lillehammer', 1);
    const r2 = expandKommuner('Lillehammer', 2);
    expect(r2).toEqual(expect.arrayContaining(r1));
    expect(r2.length).toBeGreaterThanOrEqual(r1.length);
  });
  it('returns [] when base is undefined', () => {
    expect(expandKommuner(undefined, 2)).toEqual([]);
  });
  it('unknown base: reach 1 is [base], reach 2 is region-wide', () => {
    expect(expandKommuner('Atlantis', 1)).toEqual(['Atlantis']);
    expect(expandKommuner('Atlantis', 2)).toEqual([...INNLANDET_KOMMUNER]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/data/kommuner.test.ts`
Expected: FAIL — "Cannot find module '@/data/kommuner'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/data/kommuner.ts
/**
 * Kommune reference data for Innlandet. Kommune is MinNabo's location unit;
 * distance/coordinates are deliberately not used (spec 2026-09-05).
 * `postalCodes.ts` keeps the poststed lookup — this composes on top of it.
 */
import { isPostalCode, lookupPostalCode } from './postalCodes';

/** Canonical kommune names MinNabo serves. Extend as coverage grows. */
export const INNLANDET_KOMMUNER = [
  'Lillehammer', 'Øyer', 'Gausdal', 'Ringsaker', 'Hamar', 'Stange',
  'Gjøvik', 'Østre Toten', 'Vestre Toten', 'Nordre Land', 'Søndre Land',
  'Elverum', 'Åmot', 'Trysil', 'Kongsvinger', 'Sør-Odal', 'Nord-Odal',
  'Grue', 'Sel', 'Nord-Fron', 'Sør-Fron', 'Ringebu', 'Tynset', 'Tolga',
] as const;

/** poststed / tettsted / by → kommune, where the names differ. */
const PLACE_TO_KOMMUNE: Record<string, string> = {
  'Brumunddal': 'Ringsaker',
  'Moelv': 'Ringsaker',
  'Biri': 'Gjøvik',
  'Lena': 'Østre Toten',
  'Raufoss': 'Vestre Toten',
  'Otta': 'Sel',
  'Vinstra': 'Nord-Fron',
  'Hundorp': 'Sør-Fron',
  'Fagernes': 'Nord-Aurdal',
  'Dokka': 'Nordre Land',
  'Hov': 'Søndre Land',
  'Rena': 'Åmot',
  'Skotterud': 'Eidskog',
  'Flisa': 'Åsnes',
};

/** Direct-neighbour adjacency for the kommuner MinNabo actively serves. */
export const KOMMUNE_NEIGHBOURS: Record<string, readonly string[]> = {
  'Lillehammer': ['Øyer', 'Gausdal', 'Ringsaker', 'Gjøvik'],
  'Øyer': ['Lillehammer', 'Gausdal', 'Ringebu', 'Stor-Elvdal'],
  'Gausdal': ['Lillehammer', 'Øyer', 'Nordre Land', 'Sør-Fron', 'Ringebu'],
  'Ringsaker': ['Lillehammer', 'Hamar', 'Gjøvik', 'Øyer', 'Stange'],
  'Hamar': ['Ringsaker', 'Stange', 'Løten'],
  'Stange': ['Hamar', 'Ringsaker', 'Løten', 'Nord-Odal'],
  'Gjøvik': ['Lillehammer', 'Ringsaker', 'Østre Toten', 'Vestre Toten', 'Nordre Land', 'Søndre Land'],
  'Østre Toten': ['Gjøvik', 'Vestre Toten', 'Stange', 'Hamar'],
  'Vestre Toten': ['Gjøvik', 'Østre Toten', 'Søndre Land', 'Nordre Land'],
  'Elverum': ['Åmot', 'Løten', 'Hamar', 'Våler', 'Trysil'],
  'Åmot': ['Elverum', 'Stor-Elvdal', 'Trysil', 'Ringsaker'],
  'Kongsvinger': ['Sør-Odal', 'Nord-Odal', 'Grue', 'Eidskog'],
  'Sør-Odal': ['Kongsvinger', 'Nord-Odal', 'Nes'],
  'Nord-Odal': ['Sør-Odal', 'Kongsvinger', 'Stange', 'Nes'],
  'Grue': ['Kongsvinger', 'Åsnes', 'Våler'],
  'Sel': ['Nord-Fron', 'Vågå', 'Dovre', 'Rendalen'],
  'Nord-Fron': ['Sel', 'Sør-Fron', 'Ringebu', 'Vågå'],
  'Sør-Fron': ['Nord-Fron', 'Ringebu', 'Gausdal', 'Nordre Land'],
  'Ringebu': ['Sør-Fron', 'Øyer', 'Gausdal', 'Stor-Elvdal', 'Nord-Fron'],
  'Tynset': ['Tolga', 'Alvdal', 'Rendalen', 'Folldal'],
  'Tolga': ['Tynset', 'Os', 'Rendalen'],
};

const norm = (s: string): string => s.trim().toLowerCase();

const CANONICAL_BY_NORM = new Map<string, string>(
  INNLANDET_KOMMUNER.map((k) => [norm(k), k]),
);
const PLACE_BY_NORM = new Map<string, string>(
  Object.entries(PLACE_TO_KOMMUNE).map(([p, k]) => [norm(p), k]),
);

export function resolveKommune(input: string): string | undefined {
  if (!input || !input.trim()) return undefined;
  const n = norm(input);
  if (CANONICAL_BY_NORM.has(n)) return CANONICAL_BY_NORM.get(n);
  if (PLACE_BY_NORM.has(n)) return PLACE_BY_NORM.get(n);
  if (isPostalCode(input)) {
    const poststed = lookupPostalCode(input);
    if (poststed) return resolveKommune(poststed) ?? poststed;
  }
  return undefined;
}

export function expandKommuner(
  base: string | undefined,
  reach: 0 | 1 | 2,
): string[] {
  if (!base) return [];
  if (reach === 0) return [base];
  const known = KOMMUNE_NEIGHBOURS[base];
  if (!known) return reach === 1 ? [base] : [...INNLANDET_KOMMUNER];
  const out = new Set<string>([base, ...known]);
  if (reach === 2) {
    for (const n of known) {
      for (const nn of KOMMUNE_NEIGHBOURS[n] ?? []) out.add(nn);
    }
  }
  return [base, ...[...out].filter((k) => k !== base)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/data/kommuner.test.ts`
Expected: PASS (8+ assertions).

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, no new failures.

- [ ] **Step 6: Commit**

```bash
git add src/data/kommuner.ts tests/data/kommuner.test.ts
git commit -m "Location: kommune reference data (aliases + adjacency)"
```

---

## Task 2: `geo.detectKommune()` + expo-location

**Files:**
- Create: `src/lib/geo.ts`
- Test: `tests/lib/geo.test.ts`
- Modify: `app.json` (plugins), `jest-setup.ts` (mock), `package.json` (dep via expo install)
- Reference: `src/lib/env.ts` (`ENV.useMocks`), `src/data/kommuner.ts` (`resolveKommune`)

**Interfaces:**
- Consumes: `ENV.useMocks` from `@/lib/env`; `resolveKommune` from `@/data/kommuner`.
- Produces:
  - `type DetectResult = { municipality: string; place?: string } | { error: 'denied' | 'unavailable' }`
  - `detectKommune(): Promise<DetectResult>`

- [ ] **Step 1: Install the dependency**

Run: `npx expo install expo-location`
Then confirm it appears under `dependencies` in `package.json`.

- [ ] **Step 2: Add the config plugin to `app.json`**

In `app.json`, append to `expo.plugins`:

```jsonc
[
  "expo-location",
  {
    "locationWhenInUsePermission": "MinNabo bruker posisjonen din én gang for å finne kommunen din, slik at du ser oppdrag og naboer i nærheten.",
    "isAndroidBackgroundLocationEnabled": false,
    "isAndroidForegroundServiceEnabled": false
  }
]
```

- [ ] **Step 3: Add the Jest mock to `jest-setup.ts`**

Add near the other `jest.mock('expo-…')` blocks:

```ts
jest.mock('expo-location', () => ({
  Accuracy: { Low: 1, Lowest: 0, Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 61.115, longitude: 10.466 } }),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([{ subregion: 'Lillehammer', city: 'Lillehammer', region: 'Innlandet' }]),
}));
```

- [ ] **Step 4: Write the failing test**

```ts
// tests/lib/geo.test.ts
import * as Location from 'expo-location';
import { detectKommune } from '@/lib/geo';

const L = Location as jest.Mocked<typeof Location>;

// env mock in jest-setup sets useMocks:false for this suite? Verify: jest-setup
// mocks '@/lib/env' with useMocks based on process.env; force real path here.
jest.mock('@/lib/env', () => ({ ENV: { useMocks: false, supabaseUrl: 'x', supabaseAnonKey: 'y' } }));

beforeEach(() => {
  jest.clearAllMocks();
  L.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true } as never);
  L.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 61.1, longitude: 10.4 } } as never);
  L.reverseGeocodeAsync.mockResolvedValue([{ subregion: 'Lillehammer', city: 'Lillehammer', region: 'Innlandet' }] as never);
});

it('resolves the kommune from subregion', async () => {
  await expect(detectKommune()).resolves.toEqual({ municipality: 'Lillehammer', place: 'Lillehammer' });
});

it('falls back to city when subregion is absent', async () => {
  L.reverseGeocodeAsync.mockResolvedValue([{ city: 'Brumunddal', region: 'Innlandet' }] as never);
  await expect(detectKommune()).resolves.toEqual({ municipality: 'Ringsaker', place: 'Brumunddal' });
});

it('returns {error:denied} when permission is refused', async () => {
  L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true } as never);
  L.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false } as never);
  await expect(detectKommune()).resolves.toEqual({ error: 'denied' });
});

it('returns {error:unavailable} when the fix throws', async () => {
  L.getCurrentPositionAsync.mockRejectedValue(new Error('location services off'));
  await expect(detectKommune()).resolves.toEqual({ error: 'unavailable' });
});

it('returns {error:unavailable} when the kommune cannot be resolved', async () => {
  L.reverseGeocodeAsync.mockResolvedValue([{ subregion: 'Nowhere', city: 'Nowhere' }] as never);
  await expect(detectKommune()).resolves.toEqual({ error: 'unavailable' });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx jest tests/lib/geo.test.ts`
Expected: FAIL — "Cannot find module '@/lib/geo'".

- [ ] **Step 6: Write minimal implementation**

```ts
// src/lib/geo.ts
/**
 * Device location → kommune. Coarse, one-shot, foreground only. The raw
 * coordinate never leaves this module — callers get a kommune name.
 */
import { ENV } from '@/lib/env';
import { resolveKommune } from '@/data/kommuner';

export type DetectResult =
  | { municipality: string; place?: string }
  | { error: 'denied' | 'unavailable' };

export async function detectKommune(): Promise<DetectResult> {
  if (ENV.useMocks) {
    await new Promise((r) => setTimeout(r, 400));
    return { municipality: 'Lillehammer', place: 'Lillehammer' };
  }

  const Location = await import('expo-location');

  let granted = (await Location.getForegroundPermissionsAsync()).granted;
  if (!granted) {
    granted = (await Location.requestForegroundPermissionsAsync()).granted;
  }
  if (!granted) return { error: 'denied' };

  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });
    const hits = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const hit = hits[0];
    if (!hit) return { error: 'unavailable' };

    const kommuneName = hit.subregion || hit.city || hit.region || '';
    const municipality = resolveKommune(kommuneName);
    if (!municipality) return { error: 'unavailable' };

    const place = hit.city || hit.district || hit.subregion || undefined;
    return { municipality, place: place ?? undefined };
  } catch {
    return { error: 'unavailable' };
  }
}
```

> **Implementation check:** on a real device build (Task-independent, before the first `eas` release), verify `reverseGeocodeAsync` populates `subregion` with the kommune for a Norwegian address on both iOS and Android. If iOS uses `city` for kommune, widen the fallback order accordingly and note it here.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx jest tests/lib/geo.test.ts`
Expected: PASS (5 assertions).

- [ ] **Step 8: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/geo.ts tests/lib/geo.test.ts jest-setup.ts app.json package.json package-lock.json
git commit -m "Location: detectKommune() over expo-location + mock-mode short-circuit"
```

---

## Task 3: Filter/patch type surface + mock municipality filter

**Files:**
- Modify: `src/domain/types.ts` (`ListingFilter`), `src/api/ApiClient.ts` (`UpdateProfilePatch`, `createNoticeboardPost` input), `src/data/repositories.ts` (`matchesFilter`), `src/data/profileRepository.ts` (`updateProfile`), `src/api/mockClient.ts` (thread `municipality`)
- Test: `tests/data/repositories.test.ts` (create), `tests/screens/…` unaffected yet
- Reference: `src/data/repositories.ts:13-41` (`matchesFilter`), `src/data/profileRepository.ts:63-83`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `ListingFilter.municipalities?: string[]`
  - `UpdateProfilePatch.municipality?: string`
  - `createNoticeboardPost` input gains `municipality: string` (both clients)
  - `profileRepository.updateProfile` accepts `{ municipality?: string }` and sets `location.municipality` independently of `place`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/data/repositories.test.ts
import { repositories } from '@/data/repositories';

beforeEach(() => repositories.listings._reset());

describe('municipalities filter', () => {
  it('with no municipalities set, all seed listings are returned', () => {
    const all = repositories.listings.list();
    expect(all.length).toBeGreaterThan(0);
  });

  it('restricts results to the given kommuner', () => {
    const scoped = repositories.listings.list({ municipalities: ['Gjøvik'] });
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((l) => l.location.municipality === 'Gjøvik')).toBe(true);
  });

  it('an empty array means no filtering', () => {
    const a = repositories.listings.list({ municipalities: [] });
    const b = repositories.listings.list();
    expect(a.length).toBe(b.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/data/repositories.test.ts`
Expected: FAIL — `municipalities` not a known property / results not filtered.

- [ ] **Step 3: Implement**

`src/domain/types.ts` — extend `ListingFilter`:

```ts
export type ListingFilter = {
  type?: ListingType;
  categorySlug?: string;
  maxDistanceKm?: number;
  /** kommune allow-list; undefined/empty = no location filtering */
  municipalities?: string[];
  query?: string;
  verifiedOnly?: boolean;
};
```

`src/data/repositories.ts` — inside `matchesFilter`, after the `maxDistanceKm` block:

```ts
  if (filter.municipalities && filter.municipalities.length > 0) {
    if (!filter.municipalities.includes(listing.location.municipality)) return false;
  }
```

`src/api/ApiClient.ts` — `UpdateProfilePatch`:

```ts
export type UpdateProfilePatch = {
  displayName?: string;
  presentation?: string;
  place?: string;
  municipality?: string;
  avatarPath?: string;
  maxDistanceKm?: number;
  paused?: boolean;
  homeNotes?: string;
  portfolio?: string[];
};
```

`src/api/ApiClient.ts` — `createNoticeboardPost` signature:

```ts
  createNoticeboardPost(input: {
    kind: NoticeKind;
    title: string;
    body: string;
    place: string;
    municipality: string;
  }): Promise<NoticeboardPost>;
```

`src/data/profileRepository.ts` — `updateProfile` patch type + body:

```ts
  updateProfile(patch: Partial<Pick<PublicProfile, 'displayName' | 'presentation' | 'paused' | 'homeNotes' | 'portfolio'>> & {
    place?: string;
    municipality?: string;
    avatarPath?: string;
    maxDistanceKm?: number;
  }): PublicProfile {
    // …existing assignments…
    if (patch.place !== undefined) {
      editableProfile.location = { ...editableProfile.location, place: patch.place };
    }
    if (patch.municipality !== undefined) {
      editableProfile.location = { ...editableProfile.location, municipality: patch.municipality };
    }
    return clone(editableProfile);
  }
```

(Remove the old line that set `municipality: patch.place` inside the `place` branch.)

`src/api/mockClient.ts` — `createNoticeboardPost` input type gains `municipality: string` and passes it to `noticeboardStore.create` (store change is Task 4; for now pass it through — TypeScript will flag until Task 4, so do Task 4's store signature change here too if the compiler blocks: acceptable to fold. Keep `noticeboardStore.create(input)` call unchanged, just widen the param type.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/data/repositories.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (If `mockClient.createNoticeboardPost` / `noticeboardStore` mismatch, apply Task 4 Step 3's `noticeboardStore` signature now.)

- [ ] **Step 6: Full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/api/ApiClient.ts src/data/repositories.ts src/data/profileRepository.ts src/api/mockClient.ts tests/data/repositories.test.ts
git commit -m "Location: ListingFilter.municipalities + independent profile municipality"
```

---

## Task 4: Seed spread + noticeboard/partner municipality (mock)

**Files:**
- Modify: `src/data/seed.ts` (listing kommuner), `src/data/noticeboardStore.ts` (`municipality`), `src/data/seedCommunity.ts` (`Partner.municipality`), `src/api/mockClient.ts` (pass `municipality` to store)
- Test: `tests/data/seed.test.ts` (extend), `tests/data/kommuner.test.ts` unaffected
- Reference: `src/data/seed.ts:36` (`lillehammer` const), `:110` `:316` (Gjøvik listings)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - Seed listings span ≥3 kommuner (`Lillehammer`, `Øyer`, `Gausdal`, `Ringsaker`, `Gjøvik`).
  - `Partner.municipality: string` on all 6 rows.
  - `NoticeboardPost.municipality` on seed + `noticeboardStore.create` input.

- [ ] **Step 1: Write the failing test**

```ts
// tests/data/seed.test.ts  (add to existing file)
import { listings } from '@/data/seed';

it('seed listings span multiple kommuner', () => {
  const kommuner = new Set(listings.map((l) => l.location.municipality));
  expect(kommuner.size).toBeGreaterThanOrEqual(3);
  expect(kommuner.has('Lillehammer')).toBe(true);
});
```

```ts
// tests/data/seed.test.ts  (partners + notices)
import { partners } from '@/data/seedCommunity';
it('every partner has a kommune', () => {
  expect(partners.every((p) => typeof p.municipality === 'string' && p.municipality.length > 0)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/data/seed.test.ts`
Expected: FAIL — one kommune only / `municipality` undefined on partners.

- [ ] **Step 3: Implement**

`src/data/seed.ts` — change ~4 of the listing `location` values away from `lillehammer`:

```ts
// add near the lillehammer const:
const oyer = { municipality: 'Øyer', place: 'Øyer' };
const gausdal = { municipality: 'Gausdal', place: 'Follebu' };
const ringsaker = { municipality: 'Ringsaker', place: 'Brumunddal' };
```

Then set, e.g. line ~185 → `location: { ...oyer, distanceKm: 2.8 }`, line ~206 → `{ ...gausdal, distanceKm: 3.4 }`, line ~293 → `{ ...ringsaker, distanceKm: 4.1 }`. Keep the demo user's own listing (`distanceKm: 0`, line ~248) in Lillehammer. Keep the existing Gjøvik one (line ~316).

`src/data/seedCommunity.ts`:

```ts
export type Partner = {
  id: string;
  name: string;
  tagline: string;
  tier: 'MAIN' | 'LOCAL';
  town: string;
  municipality: string;
};

export const partners: Partner[] = [
  { id: 'p-main-1', name: 'Innlandet Sparebank', tagline: 'Støtter lokalt initiativ', tier: 'MAIN', town: 'Hamar', municipality: 'Hamar' },
  { id: 'p-main-2', name: 'Fjellbygg AS', tagline: 'Bygg og vedlikehold i hele Innlandet', tier: 'MAIN', town: 'Lillehammer', municipality: 'Lillehammer' },
  { id: 'p-local-1', name: 'Mjøsa Elektro', tagline: 'Autorisert elektriker', tier: 'LOCAL', town: 'Gjøvik', municipality: 'Gjøvik' },
  { id: 'p-local-2', name: 'Gudbrandsdal Hage', tagline: 'Planteskole og hagehjelp', tier: 'LOCAL', town: 'Otta', municipality: 'Sel' },
  { id: 'p-local-3', name: 'Toten Transport', tagline: 'Frakt og flytting', tier: 'LOCAL', town: 'Raufoss', municipality: 'Vestre Toten' },
  { id: 'p-local-4', name: 'Hedmark Rør', tagline: 'Rørlegger med lang erfaring', tier: 'LOCAL', town: 'Elverum', municipality: 'Elverum' },
];
```

`src/data/noticeboardStore.ts`:
- `NoticeboardPost` gains `municipality` (edit `src/domain/types.ts` `NoticeboardPost` type: add `municipality: string;` after `place`).
- Seed rows: `n-seed-1` → `municipality: 'Lillehammer'`, `n-seed-2` → `municipality: 'Gjøvik'`, `n-seed-3` → `municipality: 'Lillehammer'`.
- `create` input `{ …; place: string; municipality: string }`; set `municipality: input.municipality.trim()` on the post.

`src/api/mockClient.ts` — `createNoticeboardPost` passes the full input (now typed with `municipality`) to `noticeboardStore.create(input)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/data/seed.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. Fix any seed-count assumptions in `tests/screens/oppdrag.test.tsx` / `listingList.test.tsx` that now see fewer Lillehammer listings — update expected counts to match the new spread.

- [ ] **Step 6: Commit**

```bash
git add src/data/seed.ts src/data/seedCommunity.ts src/data/noticeboardStore.ts src/domain/types.ts src/api/mockClient.ts tests/data/seed.test.ts tests/screens/oppdrag.test.tsx tests/screens/listingList.test.tsx
git commit -m "Location: spread seed across kommuner + municipality on partners/notices"
```

---

## Task 5: `useLocationScope()` hook

**Files:**
- Create: `src/lib/locationScope.ts`
- Test: `tests/lib/locationScope.test.ts`
- Reference: `src/lib/neighbourhood.ts` (copy the singleton+listener+hook pattern exactly), `src/hooks/useCurrentUser.ts`

**Interfaces:**
- Consumes: `AsyncStorage`; `expandKommuner` from `@/data/kommuner`; `useProfile` from `@/api/queries` + `useSession` from `@/auth/session` (read `profile.location.municipality`).
- Produces:
  - `locationScope.getReach(): 0|1|2`, `locationScope.setReach(r)`, `locationScope._reset()`
  - `useLocationScope(): { municipality?: string; municipalities: string[]; reach: 0|1|2; setReach: (r: 0|1|2) => void; ready: boolean }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/locationScope.test.ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { locationScope, useLocationScope } from '@/lib/locationScope';
import { wrapper } from '../testUtils'; // QueryClientProvider wrapper — see tests/testUtils.tsx

beforeEach(async () => {
  await AsyncStorage.clear();
  locationScope._reset();
});

it('defaults reach to 0 and derives municipalities from the profile kommune', async () => {
  const { result } = renderHook(() => useLocationScope(), { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.reach).toBe(0);
  // demo profile (seed) is Lillehammer
  expect(result.current.municipalities).toEqual(['Lillehammer']);
});

it('setReach widens the set and persists', async () => {
  const { result } = renderHook(() => useLocationScope(), { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  act(() => result.current.setReach(1));
  await waitFor(() => expect(result.current.municipalities.length).toBeGreaterThan(1));
  expect(await AsyncStorage.getItem('minnabo.locationScope.reach')).toBe('1');
});
```

> Check `tests/testUtils.tsx` for the actual exported wrapper/provider name and use that; the mock session resolves to the demo user (`u-mb`, Lillehammer).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/lib/locationScope.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/lib/locationScope.ts
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@/auth/session';
import { useProfile } from '@/api/queries';
import { expandKommuner } from '@/data/kommuner';

const KEY = 'minnabo.locationScope.reach';
type Reach = 0 | 1 | 2;

let reach: Reach = 0;
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const n = Number(raw);
    reach = n === 1 || n === 2 ? (n as Reach) : 0;
  } catch {
    reach = 0;
  }
  emit();
}

export const locationScope = {
  getReach: () => reach,
  setReach(r: Reach) {
    reach = r;
    AsyncStorage.setItem(KEY, String(r)).catch(() => undefined);
    emit();
  },
  _reset() {
    reach = 0;
    hydrated = false;
    emit();
  },
};

export function useLocationScope(): {
  municipality?: string;
  municipalities: string[];
  reach: Reach;
  setReach: (r: Reach) => void;
  ready: boolean;
} {
  const { userId } = useSession();
  const { data: profile, isLoading } = useProfile(userId ?? '');
  const [r, setR] = useState<Reach>(reach);

  useEffect(() => {
    void hydrate();
    const sync = () => setR(reach);
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const municipality = profile?.location.municipality || undefined;
  return {
    municipality,
    municipalities: expandKommuner(municipality, r),
    reach: r,
    setReach: locationScope.setReach,
    ready: !!userId && !isLoading,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/lib/locationScope.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/locationScope.ts tests/lib/locationScope.test.ts
git commit -m "Location: useLocationScope() hook (reach pref + derived kommune set)"
```

---

## Task 6: `ReachControl` + `KommunePicker` components

**Files:**
- Create: `src/components/ReachControl.tsx`, `src/components/KommunePicker.tsx`
- Test: `tests/components/reachControl.test.tsx`, `tests/components/kommunePicker.test.tsx`
- Reference: `src/components/ui/ChipSelect.tsx` (segmented pattern), `src/components/ui/TextField.tsx`, `src/components/ui/SearchField.tsx`, `src/data/kommuner.ts`, `src/theme` tokens

**Interfaces:**
- Consumes: `INNLANDET_KOMMUNER`, `resolveKommune` from `@/data/kommuner`; `nb` strings.
- Produces:
  - `<ReachControl value={0|1|2} onChange={(r) => void} />`
  - `<KommunePicker value={string} onChange={(kommune: string) => void} />` — renders a search field + a selectable list; accepts a postal code and resolves it.

- [ ] **Step 1: Add i18n strings**

`src/i18n/nb.ts` — add a `location` section:

```ts
  location: {
    kommuneSuffix: 'kommune',
    pickKommune: 'Velg kommune',
    searchKommune: 'Søk etter kommune eller postnummer',
    reachLabel: 'Hvor langt unna?',
    reachOwn: 'Bare min kommune',
    reachNeighbours: '+ nabokommuner',
    reachRegion: '+ hele regionen',
    permissionDenied: 'MinNabo har ikke tilgang til posisjonen din. Gi tilgang i innstillingene, eller velg kommune manuelt.',
    locationUnavailable: 'Fant ikke posisjonen din. Velg kommune manuelt.',
    detected: 'Fant kommunen din:',
    emptyListings: (k: string) => `Ingen oppdrag i ${k} akkurat nå. Prøv å utvide rekkevidden.`,
    emptyPartners: (k: string) => `Ingen lokale samarbeidspartnere i ${k} enda.`,
    emptyNotices: (k: string) => `Ingen oppslag i ${k} akkurat nå.`,
  },
```

- [ ] **Step 2: Write the failing tests**

```tsx
// tests/components/reachControl.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ReachControl } from '@/components/ReachControl';
import nb from '@/i18n/nb';

it('renders three options and reports the picked reach', () => {
  const onChange = jest.fn();
  const { getByText } = render(<ReachControl value={0} onChange={onChange} />);
  fireEvent.press(getByText(nb.location.reachNeighbours));
  expect(onChange).toHaveBeenCalledWith(1);
});
```

```tsx
// tests/components/kommunePicker.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { KommunePicker } from '@/components/KommunePicker';

it('filters the list and emits the chosen kommune', () => {
  const onChange = jest.fn();
  const { getByPlaceholderText, getByText } = render(
    <KommunePicker value="" onChange={onChange} />,
  );
  fireEvent.changeText(getByPlaceholderText(/Søk etter kommune/i), 'gjøv');
  fireEvent.press(getByText('Gjøvik'));
  expect(onChange).toHaveBeenCalledWith('Gjøvik');
});

it('resolves a postal code to a kommune', () => {
  const onChange = jest.fn();
  const { getByPlaceholderText, getByText } = render(
    <KommunePicker value="" onChange={onChange} />,
  );
  fireEvent.changeText(getByPlaceholderText(/Søk etter kommune/i), '2380');
  // a hint row appears offering "Ringsaker"
  fireEvent.press(getByText('Ringsaker'));
  expect(onChange).toHaveBeenCalledWith('Ringsaker');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest tests/components/reachControl.test.tsx tests/components/kommunePicker.test.tsx`
Expected: FAIL — modules missing.

- [ ] **Step 4: Implement `ReachControl`**

```tsx
// src/components/ReachControl.tsx
import { View, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';

const OPTIONS: { value: 0 | 1 | 2; label: string }[] = [
  { value: 0, label: nb.location.reachOwn },
  { value: 1, label: nb.location.reachNeighbours },
  { value: 2, label: nb.location.reachRegion },
];

export function ReachControl({
  value,
  onChange,
}: {
  value: 0 | 1 | 2;
  onChange: (r: 0 | 1 | 2) => void;
}) {
  return (
    <View style={styles.wrap}>
      <AppText variant="meta" weight="bold">
        {nb.location.reachLabel}
      </AppText>
      <View style={styles.row}>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: value === o.value }}
            onPress={() => onChange(o.value)}
            style={[styles.pill, value === o.value && styles.pillActive]}
          >
            <AppText variant="meta" weight="bold" color={value === o.value ? 'white' : 'navy'}>
              {o.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  pill: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  pillActive: { backgroundColor: tokens.color.cyan, borderColor: tokens.color.cyan },
});
```

- [ ] **Step 5: Implement `KommunePicker`**

```tsx
// src/components/KommunePicker.tsx
import { useMemo, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { INNLANDET_KOMMUNER, resolveKommune } from '@/data/kommuner';
import { isPostalCode } from '@/data/postalCodes';
import { AppText } from './ui/Text';
import { TextField } from './ui/TextField';

export function KommunePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (kommune: string) => void;
}) {
  const [q, setQ] = useState('');
  const resolved = isPostalCode(q) ? resolveKommune(q) : undefined;
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n || isPostalCode(q)) return INNLANDET_KOMMUNER;
    return INNLANDET_KOMMUNER.filter((k) => k.toLowerCase().includes(n));
  }, [q]);

  return (
    <View style={styles.wrap}>
      <TextField
        label={nb.location.pickKommune}
        hideLabel
        value={q}
        onChangeText={setQ}
        placeholder={nb.location.searchKommune}
      />
      {resolved ? (
        <Pressable style={styles.hint} onPress={() => onChange(resolved)} accessibilityRole="button">
          <AppText variant="meta" weight="bold" color="cyan">
            {nb.home.postalResolved} {resolved}
          </AppText>
        </Pressable>
      ) : null}
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {list.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: value === k }}
            onPress={() => onChange(k)}
            style={[styles.row, value === k && styles.rowActive]}
          >
            <AppText variant="body" weight={value === k ? 'bold' : 'regular'}>
              {k}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.sm },
  hint: { paddingVertical: tokens.space.xs },
  list: { maxHeight: 240 },
  row: {
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.tile,
  },
  rowActive: { backgroundColor: tokens.color.limeTint },
});
```

> Verify `AppText`'s `weight` accepts `'regular'` / prop names against `src/components/ui/Text.tsx`; adjust to the real API (`weight="bold"` is used widely, a non-bold default may just be omitting the prop).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest tests/components/reachControl.test.tsx tests/components/kommunePicker.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/ReachControl.tsx src/components/KommunePicker.tsx src/i18n/nb.ts tests/components/reachControl.test.tsx tests/components/kommunePicker.test.tsx
git commit -m "Location: ReachControl + KommunePicker components + nb strings"
```

---

## Task 7: LocationBar redesign

**Files:**
- Modify: `src/components/LocationBar.tsx` (full rework), `src/hooks/useCurrentUser.ts` (expose `municipality`)
- Test: `tests/components/locationBar.test.tsx` (create)
- Reference: current `LocationBar.tsx`, `src/components/ui/BottomSheet.tsx`, `src/api/queries.ts` (`useUpdateProfile`), Task 2 (`detectKommune`), Task 5 (`useLocationScope`), Task 6 components

**Interfaces:**
- Consumes: `detectKommune` (`@/lib/geo`), `useLocationScope` (`@/lib/locationScope`), `ReachControl`, `KommunePicker`, `useUpdateProfile`, `useProfile`, `useSession`.
- Produces: `<LocationBar />` unchanged export; new behaviour.
- `useCurrentUser()` return type gains `municipality?: string`.

- [ ] **Step 1: Extend `useCurrentUser`**

`src/hooks/useCurrentUser.ts` — add `municipality?: string` to `CurrentUser`, populate from `data?.location.municipality`, add to the memo dep array.

- [ ] **Step 2: Write the failing test**

```tsx
// tests/components/locationBar.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LocationBar } from '@/components/LocationBar';
import { wrapper } from '../testUtils';
import nb from '@/i18n/nb';

it('shows the profile kommune with the "kommune" suffix', async () => {
  const { findByText } = render(<LocationBar />, { wrapper });
  expect(await findByText(/Lillehammer kommune/i)).toBeTruthy();
});

it('"Bruk posisjonen min" detects and saves the kommune', async () => {
  const { getByText, findByText } = render(<LocationBar />, { wrapper });
  fireEvent.press(await findByText(nb.home.changeLocation));
  fireEvent.press(getByText(nb.home.useMyLocation));
  // mock detectKommune (ENV.useMocks true in test) resolves to Lillehammer
  await waitFor(() => expect(getByText(new RegExp(nb.location.detected))).toBeTruthy());
});

it('changing reach updates the label', async () => {
  const { getByText, findByText } = render(<LocationBar />, { wrapper });
  fireEvent.press(await findByText(nb.home.changeLocation));
  fireEvent.press(getByText(nb.location.reachNeighbours));
  await waitFor(() => expect(getByText(nb.location.reachNeighbours)).toBeTruthy());
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/components/locationBar.test.tsx`
Expected: FAIL — old LocationBar shows place, not "X kommune"; no reach control.

- [ ] **Step 4: Rework `LocationBar.tsx`**

Replace the file body. Key points:
- Delete the local `detectLocation` mock and `TOWNS` const and `DistanceSlider` import.
- Bar: `<Icon name="map-pin" /> {municipality} {nb.location.kommuneSuffix}` (or `nb.location.pickKommune` when `municipality` undefined) + secondary line = the reach label (`reachOwn`/`reachNeighbours`/`reachRegion`).
- Sheet content:
  - "Bruk posisjonen min" button → `setBusy(true)`; `const res = await detectKommune();` → on `municipality` in result: `update.mutate({ municipality: res.municipality, place: res.place ?? res.municipality })`, show `nb.location.detected + res.municipality`; on `error === 'denied'` show `nb.location.permissionDenied`; on `error === 'unavailable'` show `nb.location.locationUnavailable`.
  - `<KommunePicker value={municipality ?? ''} onChange={(k) => update.mutate({ municipality: k, place: k })} />`
  - `<ReachControl value={reach} onChange={setReach} />`
- Uses `useLocationScope()` for `{ municipality, reach, setReach }` and `useUpdateProfile()` for `update`.

```tsx
// src/components/LocationBar.tsx  (shape)
import { useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { useUpdateProfile } from '@/api/queries';
import { useLocationScope } from '@/lib/locationScope';
import { detectKommune } from '@/lib/geo';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { KommunePicker } from './KommunePicker';
import { ReachControl } from './ReachControl';

const REACH_LABEL = [nb.location.reachOwn, nb.location.reachNeighbours, nb.location.reachRegion];

export function LocationBar() {
  const { municipality, reach, setReach } = useLocationScope();
  const update = useUpdateProfile();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const useMyLocation = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await detectKommune();
      if ('municipality' in res) {
        update.mutate({ municipality: res.municipality, place: res.place ?? res.municipality });
        setNote(`${nb.location.detected} ${res.municipality}`);
      } else {
        setNote(res.error === 'denied' ? nb.location.permissionDenied : nb.location.locationUnavailable);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={nb.home.changeLocation} hitSlop={hitSlop} onPress={() => setOpen(true)} style={styles.bar}>
        <Icon name="map-pin" size={16} color="cyan" />
        <AppText variant="body" weight="bold">
          {municipality ? `${municipality} ${nb.location.kommuneSuffix}` : nb.location.pickKommune}
        </AppText>
        <AppText variant="body" color="navyMuted">· {REACH_LABEL[reach]}</AppText>
        <Icon name="chevron-right" size={16} color="cyan" />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={nb.home.changeLocation} heightRatio={0.8}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheet}>
          <Pressable accessibilityRole="button" accessibilityLabel={nb.home.useMyLocation} onPress={useMyLocation} style={styles.detect}>
            <Icon name={busy ? 'loader' : 'navigation'} size={16} color="cyan" />
            <AppText variant="meta" weight="bold" color="cyan">
              {busy ? nb.home.locating : nb.home.useMyLocation}
            </AppText>
          </Pressable>
          {note ? <AppText variant="meta" color="navyMuted">{note}</AppText> : null}
          <KommunePicker value={municipality ?? ''} onChange={(k) => update.mutate({ municipality: k, place: k })} />
          <ReachControl value={reach} onChange={setReach} />
        </ScrollView>
        <Button label={nb.search.apply} onPress={() => setOpen(false)} />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  sheet: { gap: tokens.space.lg, paddingBottom: tokens.space.lg },
  detect: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderWidth: 1.5, borderColor: tokens.color.cyan, borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm,
  },
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/components/locationBar.test.tsx`
Expected: PASS.

- [ ] **Step 6: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. Fix any existing test referencing the removed "innen 15 km" text or the old place-based bar (search `tests/` for `locationSuffix`, `changeLocation`, `useMyLocation`).

- [ ] **Step 7: Commit**

```bash
git add src/components/LocationBar.tsx src/hooks/useCurrentUser.ts tests/components/locationBar.test.tsx
git commit -m "Location: LocationBar shows kommune + reach, wired to detectKommune"
```

---

## Task 8: Scope the listing screens

**Files:**
- Modify: `src/screens/OppdragScreen.tsx`, `src/screens/ListingListScreen.tsx`, `src/screens/LeadBoardScreen.tsx`, `src/screens/TilbydereScreen.tsx`, `src/screens/SearchScreen.tsx`, `src/screens/SavedScreen.tsx`
- Test: extend `tests/screens/oppdrag.test.tsx`; add cases to `tests/screens/search.test.tsx`, `tests/screens/leadBoard.test.tsx`
- Reference: Task 5 (`useLocationScope`), `src/api/queries.ts` (`useListings`)

**Interfaces:**
- Consumes: `useLocationScope().municipalities`.
- Produces: every listing query on these screens carries `municipalities` in its `ListingFilter`; empty-state copy uses `nb.location.emptyListings`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/screens/oppdrag.test.tsx  (add)
import { render, waitFor } from '@testing-library/react-native';
import { OppdragScreen } from '@/screens/OppdragScreen';
import { wrapper } from '../testUtils';

it('only shows listings from the user kommune (Lillehammer)', async () => {
  const { queryByText, findAllByText } = render(<OppdragScreen />, { wrapper });
  await findAllByText(/./); // let queries settle
  await waitFor(() => {
    // a Gjøvik-only seed listing title must not appear
    expect(queryByText(/GJØVIK_ONLY_LISTING_TITLE/i)).toBeNull();
  });
});
```

> Replace `GJØVIK_ONLY_LISTING_TITLE` with the real title of the Gjøvik seed listing (`src/data/seed.ts` line ~316 area). Pick one whose title is distinctive.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/screens/oppdrag.test.tsx`
Expected: FAIL — Gjøvik listing currently shows (no scope applied).

- [ ] **Step 3: Implement**

`OppdragScreen.tsx`:

```tsx
import { useLocationScope } from '@/lib/locationScope';
// …
const { municipalities } = useLocationScope();
const offers = useListings({ categorySlug: activeSlug, type: 'SERVICE_OFFER', municipalities });
const tasks = useListings({ categorySlug: activeSlug, type: 'TASK_REQUEST', municipalities });
```

Repeat the pattern in `ListingListScreen.tsx`, `LeadBoardScreen.tsx`, `TilbydereScreen.tsx`: read `useLocationScope()`, merge `municipalities` into the `ListingFilter` passed to `useListings`.

`SearchScreen.tsx`: add `municipalities` from `useLocationScope()` into the `filter` object built at `:56-61` (base scope always applied). Optionally surface `<ReachControl>` in the filter sheet — add it next to the distance control block near `:336`.

`SavedScreen.tsx` (saved-search execution): where a stored `search.filter` is passed to `useListings`, spread `municipalities` over it: `{ ...search.filter, municipalities }`.

Empty states: in `OppdragScreen`'s `Section` empty branch and `ListingListScreen`'s empty state, when `municipalities.length > 0` show `nb.location.emptyListings(municipality ?? '')` with a button/hint that opens the LocationBar sheet (or just the text — a deep link is optional).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/screens/oppdrag.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. Update `tests/screens/search.test.tsx`, `leadBoard.test.tsx`, `listingList.test.tsx`, `saved-search.test.tsx` expectations for the now-scoped result sets.

- [ ] **Step 6: Commit**

```bash
git add src/screens/OppdragScreen.tsx src/screens/ListingListScreen.tsx src/screens/LeadBoardScreen.tsx src/screens/TilbydereScreen.tsx src/screens/SearchScreen.tsx src/screens/SavedScreen.tsx tests/screens/
git commit -m "Location: scope oppdrag/tilbud/search/lead-board to the user kommune"
```

---

## Task 9: Scope Fellesskap, Oppslagstavle, Nabolag

**Files:**
- Modify: `src/screens/FellesskapScreen.tsx`, `src/screens/NoticeboardScreen.tsx`, `src/screens/NeighbourhoodScreen.tsx`
- Test: extend `tests/screens/community-safety.test.tsx`, `tests/screens/noticeboard.test.tsx`, `tests/screens/neighbourhood.test.tsx`
- Reference: Task 5 (`useLocationScope`), `src/data/seedCommunity.ts` (`partners`, now with `municipality`)

**Interfaces:**
- Consumes: `useLocationScope().municipalities` + `.municipality`.
- Produces: local partners / notices / nabolag lists filtered to the kommune set; MAIN partners always shown; empty-state copy from `nb.location`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/screens/community-safety.test.tsx  (add)
import { render, findByText, queryByText } from '@testing-library/react-native';
import { FellesskapScreen } from '@/screens/FellesskapScreen';
import { wrapper } from '../testUtils';

it('shows MAIN partners always but hides out-of-kommune LOCAL partners', async () => {
  const screen = render(<FellesskapScreen />, { wrapper });
  expect(await screen.findByText('Fjellbygg AS')).toBeTruthy();     // MAIN
  expect(screen.queryByText('Mjøsa Elektro')).toBeNull();           // LOCAL, Gjøvik
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/screens/community-safety.test.tsx`
Expected: FAIL — all local partners currently render.

- [ ] **Step 3: Implement**

`FellesskapScreen.tsx`:

```tsx
import { useLocationScope } from '@/lib/locationScope';
// …
const { municipalities, municipality } = useLocationScope();
const mainPartners = partners.filter((p) => p.tier === 'MAIN').slice(0, 2);
const localPartners = partners.filter(
  (p) => p.tier === 'LOCAL' && (municipalities.length === 0 || municipalities.includes(p.municipality)),
);
```

When `localPartners.length === 0 && municipality`, render `nb.location.emptyPartners(municipality)` in place of the carousel.

`NoticeboardScreen.tsx`: read `useLocationScope()`, filter `notices.data` to `municipalities.includes(n.municipality)` (skip filter when `municipalities.length === 0`). Empty → `nb.location.emptyNotices(municipality)`.

`NeighbourhoodScreen.tsx`: replace the `me.place` substring filters (`local`, `localNotices` at `:28-40`) with kommune-set membership:

```tsx
const { municipalities } = useLocationScope();
const local = useMemo(
  () => (listings.data ?? [])
    .filter((l) => municipalities.length === 0 || municipalities.includes(l.location.municipality))
    .slice(0, 5),
  [listings.data, municipalities],
);
const localNotices = useMemo(
  () => (notices.data ?? [])
    .filter((n) => municipalities.length === 0 || municipalities.includes(n.municipality))
    .slice(0, 3),
  [notices.data, municipalities],
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/screens/community-safety.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. Update `noticeboard.test.tsx` / `neighbourhood.test.tsx` expectations (Gjøvik seed notice no longer shows for the Lillehammer demo user).

- [ ] **Step 6: Commit**

```bash
git add src/screens/FellesskapScreen.tsx src/screens/NoticeboardScreen.tsx src/screens/NeighbourhoodScreen.tsx tests/screens/
git commit -m "Location: scope partners, oppslagstavle and nabolag to the user kommune"
```

---

## Task 10: Onboarding — "Bruk posisjonen min"

**Files:**
- Modify: `src/screens/Onboarding/SetupScreen.tsx`
- Test: extend `tests/screens/onboarding.test.tsx`
- Reference: current `SetupScreen.tsx`, Task 2 (`detectKommune`)

**Interfaces:**
- Consumes: `detectKommune` from `@/lib/geo`.
- Produces: a button that fills the `municipality` (+ `place`) fields; the `DISTANCES` km chips are removed.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/screens/onboarding.test.tsx  (add)
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SetupScreen } from '@/screens/Onboarding/SetupScreen';
import { wrapper } from '../testUtils';
import nb from '@/i18n/nb';

it('"Bruk posisjonen min" fills the kommune field', async () => {
  const { getByText, getByLabelText } = render(<SetupScreen />, { wrapper });
  fireEvent.press(getByText(nb.home.useMyLocation));
  await waitFor(() => {
    // mock detectKommune resolves to Lillehammer
    expect(getByLabelText(nb.onboarding.municipalityLabel).props.value).toBe('Lillehammer');
  });
});
```

> Confirm how `TextField` exposes its value for assertions in this codebase (check an existing onboarding test); adapt the assertion to the real pattern (may be `getByDisplayValue('Lillehammer')`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/screens/onboarding.test.tsx`
Expected: FAIL — no such button.

- [ ] **Step 3: Implement**

In `SetupScreen.tsx`:
- Import `detectKommune`.
- Add a `locating` state + a `<Button variant="secondary" label={nb.home.useMyLocation} loading={locating} onPress={useMyLoc} />` above the `municipality` `TextField`.

```tsx
const [locating, setLocating] = useState(false);
const useMyLoc = async () => {
  setLocating(true);
  try {
    const res = await detectKommune();
    if ('municipality' in res) {
      setMunicipality(res.municipality);
      setPlace(res.place ?? res.municipality);
    } else {
      setError(res.error === 'denied' ? nb.location.permissionDenied : nb.location.locationUnavailable);
    }
  } finally {
    setLocating(false);
  }
};
```

- Remove the `DISTANCES` const and the distance `ChipSelect` block (`:112-117`) and the `distance` state; drop `max_distance_km: distance` from the update payload (or keep sending the DB default — leave the column alone).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/screens/onboarding.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Onboarding/SetupScreen.tsx tests/screens/onboarding.test.tsx
git commit -m "Location: onboarding gets 'Bruk posisjonen min', drops km chips"
```

---

## Task 11: Posting — kommune from profile

**Files:**
- Modify: `src/screens/LeggUt/TaskRequestForm.tsx`, `src/screens/LeggUt/ServiceOfferForm.tsx`, `src/screens/LeggUt/buildListing.ts`
- Test: extend `tests/screens/leggUt.test.tsx`
- Reference: `buildListing.ts:104-108` and `:148-152` (the `municipality: form.place.trim()` bug), `src/data/kommuner.ts` (`resolveKommune`)

**Interfaces:**
- Consumes: `useCurrentUser().municipality` (Task 7), `resolveKommune`.
- Produces: `TaskForm` / `OfferForm` gain `municipality: string`; `buildTaskListing` / `buildOfferListing` write `location.municipality = form.municipality` (falling back to `resolveKommune(form.place) ?? form.place`).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/screens/leggUt.test.tsx  (add — unit-level on buildListing)
import { buildTaskListing } from '@/screens/LeggUt/buildListing';

it('stores the kommune, not the poststed, as municipality', () => {
  const listing = buildTaskListing({
    // …minimal valid TaskForm with:
    place: 'Brumunddal',
    municipality: 'Ringsaker',
    // …rest of required fields (copy an existing fixture in this test file)
  } as never);
  expect(listing.location.municipality).toBe('Ringsaker');
  expect(listing.location.place).toBe('Brumunddal');
});

it('falls back to resolveKommune when municipality is blank', () => {
  const listing = buildTaskListing({ place: 'Moelv', municipality: '' } as never);
  expect(listing.location.municipality).toBe('Ringsaker');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/screens/leggUt.test.tsx`
Expected: FAIL — `municipality` unknown on form / equals `'Brumunddal'`.

- [ ] **Step 3: Implement**

`buildListing.ts`:

```ts
import { resolveKommune } from '@/data/kommuner';

const kommuneFor = (form: { municipality?: string; place: string }) =>
  (form.municipality && form.municipality.trim())
  || resolveKommune(form.place)
  || form.place.trim();
```

`TaskForm` type gains `municipality: string`; in `buildTaskListing`:

```ts
    location: {
      municipality: kommuneFor(form),
      place: form.place.trim(),
      distanceKm: 0,
    },
```

Same for `OfferForm` / `buildOfferListing`.

`TaskRequestForm.tsx` / `ServiceOfferForm.tsx`:
- Add `municipality` to the initial form state, seeded from `useCurrentUser().municipality ?? ''`.
- In the place `FieldGroup` (`TaskRequestForm.tsx:185`), add a `<KommunePicker value={form.municipality} onChange={(k) => set('municipality', k)} />` above/below the free-text place field. Keep `place` free-text (address-ish detail).
- If `municipality` empty on submit, `validate` resolves it from `place` (don't hard-block — `kommuneFor` handles it).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/screens/leggUt.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. Fix any `leggUt.test.tsx` fixtures missing the new `municipality` field.

- [ ] **Step 6: Commit**

```bash
git add src/screens/LeggUt/ tests/screens/leggUt.test.tsx
git commit -m "Location: posting fills kommune from profile, stops copying poststed"
```

---

## Task 12: Supabase parity (migration + client)

**Files:**
- Create: `supabase/migrations/0021_location_scoping.sql`
- Modify: `supabase/seed_static.sql`, `src/api/supabaseClient.ts`, `src/api/mappers.ts`
- Test: extend `tests/api/mappers.test.ts`
- Reference: `supabase/migrations/0001_schema.sql:85-124` (listings), `:289-297` (partners), `0014_noticeboard.sql`, `0020_neighbourhoods.sql`, `src/api/supabaseClient.ts:86-107` (`listListings`), `:505-527` (`updateProfile`), `:676-696` (`createNoticeboardPost`), `:119-155` (`createListing`)

**Interfaces:**
- Consumes: `ListingFilter.municipalities` (Task 3).
- Produces: `SupabaseApiClient` applies the kommune allow-list and writes `municipality` on notices; `mappers.toNoticeboardPost` maps `municipality`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/mappers.test.ts  (add)
import { toNoticeboardPost } from '@/api/mappers';

it('maps municipality onto a noticeboard post', () => {
  const post = toNoticeboardPost({
    id: 'n1', kind: 'GENERAL', title: 't', body: 'b',
    author_id: 'a', place: 'Brumunddal', municipality: 'Ringsaker',
    created_at: '2026-09-05T00:00:00Z',
  });
  expect(post.municipality).toBe('Ringsaker');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/api/mappers.test.ts`
Expected: FAIL — `municipality` not on `NoticeRow` / not mapped.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/0021_location_scoping.sql
-- Location scoping: kommune is the filter unit (spec 2026-09-05). No RLS change.

alter table partners          add column if not exists municipality text;
alter table neighbourhoods    add column if not exists municipality text;
alter table noticeboard_posts add column if not exists municipality text not null default '';

create index if not exists listings_municipality_idx on listings (municipality);

-- Backfill notices where poststed already equals the kommune name.
update noticeboard_posts set municipality = place where municipality = '' and place <> '';
```

- [ ] **Step 4: Update `seed_static.sql`**

Add `municipality` to the seeded `partners` insert (mirror `src/data/seedCommunity.ts` values from Task 4).

- [ ] **Step 5: Implement client + mapper**

`src/api/mappers.ts` — `NoticeRow` gains `municipality: string`; `toNoticeboardPost` maps `municipality: row.municipality ?? ''`.

`src/api/supabaseClient.ts`:
- `listListings`: after the `query` filter block —
  ```ts
  if (filter?.municipalities && filter.municipalities.length > 0) {
    q = q.in('municipality', filter.municipalities);
  }
  ```
- `updateProfile`: replace the `place`/`municipality` copy —
  ```ts
  if (patch.place !== undefined) row.place = patch.place;
  if (patch.municipality !== undefined) row.municipality = patch.municipality;
  ```
- `createNoticeboardPost`: input type gains `municipality: string`; add `municipality: input.municipality` to the `.insert({...})`.
- `createListing`: the insert already sets `municipality: listing.location.municipality` — no change needed (Task 11 makes that value correct). Verify it's there; if it currently sets `place` twice, fix to use `listing.location.municipality`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest tests/api/mappers.test.ts`
Expected: PASS.

- [ ] **Step 7: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0021_location_scoping.sql supabase/seed_static.sql src/api/supabaseClient.ts src/api/mappers.ts tests/api/mappers.test.ts
git commit -m "Location: Supabase parity — 0021 migration + kommune filter in client"
```

---

## Task 13: Full verification + iOS bundle export

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all green. Record the count (was 107+; will be higher).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Bundle export sanity (catches native/plugin issues)**

Run: `npx expo export --platform ios` (and `--platform android`)
Expected: completes without resolution errors for `expo-location`.

- [ ] **Step 4: Manual runbook note**

Append to `BACKEND.md` (or a new `docs/location-rollout.md`): after merge, the human runs
`npm run db:push` (applies `0021`), `npm run db:types`, re-runs the static seed for `partners.municipality`, then a fresh `eas build --profile preview` for both platforms (first build carrying `expo-location`). On device, verify `reverseGeocodeAsync` populates the kommune (Task 2 implementation check) and adjust the fallback order in `src/lib/geo.ts` if needed.

- [ ] **Step 5: Commit**

```bash
git add BACKEND.md docs/location-rollout.md
git commit -m "Location: rollout runbook + verification notes"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
| --- | --- |
| §1 Native location / `geo.ts` | 2 |
| §2 `kommuner.ts` (aliases, adjacency, resolve/expand) | 1 |
| §3 Types + `ListingFilter.municipalities` | 3 |
| §3 Mock layer (filter, independent municipality, notices, partners, seed) | 3, 4 |
| §3 Supabase layer (migration, client, mappers, seed_static) | 12 |
| §4 `useLocationScope()` | 5 |
| §5 Screen wiring — listings | 8 |
| §5 Screen wiring — Fellesskap / Oppslagstavle / Nabolag | 9 |
| §6 LocationBar | 7 |
| §6 Onboarding | 10 |
| §6 Posting | 11 |
| §7 i18n | 6 (+ folded into 7–11) |
| §8 Tests | every task (TDD) |
| §9 Rollout | 13 |

No gaps.

**2. Placeholder scan** — the two "verify against real API" notes (Task 2 `reverseGeocodeAsync` fields, Task 6 `AppText.weight`, Task 10 `TextField` value assertion) are explicit implementation checks with a concrete default already coded, not deferred work. Task 8's `GJØVIK_ONLY_LISTING_TITLE` is called out to be substituted with the real seed title. No "TODO / handle edge cases / add validation" placeholders.

**3. Type consistency**

- `detectKommune(): Promise<DetectResult>` where `DetectResult = { municipality: string; place?: string } | { error: 'denied' | 'unavailable' }` — consumed identically in Tasks 7, 10.
- `expandKommuner(base: string | undefined, reach: 0|1|2): string[]` — consumed in Task 5.
- `useLocationScope()` returns `{ municipality?: string; municipalities: string[]; reach: 0|1|2; setReach; ready: boolean }` — consumed in Tasks 7, 8, 9.
- `ListingFilter.municipalities?: string[]` — set in Tasks 8, applied in Tasks 3 (mock) + 12 (Supabase).
- `UpdateProfilePatch.municipality?: string` — set in Tasks 7, 10, 11; applied in Tasks 3 (mock) + 12 (Supabase).
- `NoticeboardPost.municipality: string` + `createNoticeboardPost` input `municipality: string` — Tasks 3, 4 (mock/store), 12 (Supabase/mapper).
- `Partner.municipality: string` — Task 4, consumed Task 9.
- `resolveKommune` / `INNLANDET_KOMMUNER` / `KOMMUNE_NEIGHBOURS` — Task 1, consumed Tasks 2, 6, 11.

Consistent.
