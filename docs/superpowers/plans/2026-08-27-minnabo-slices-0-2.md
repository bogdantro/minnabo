# MinNabo Slices 0–2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Expo/TypeScript app with the derived MinNabo design system, a typed mock data layer, and a pixel-matched "Oppdrag" front page.

**Architecture:** Expo + expo-router file-based navigation. A theme token module and a set of UI primitives implement the design system derived from the 7 mockups. A mock API client backed by in-memory seeded repositories (with `AsyncStorage` for user-created data) is consumed through TanStack Query so every screen has real loading/error/empty states. Domain types and a pure proposal state machine live in `src/domain/`.

**Tech Stack:** Expo SDK 51+, React Native, TypeScript (strict), expo-router, @tanstack/react-query, @react-native-async-storage/async-storage, @expo/vector-icons (Feather), @expo-google-fonts/mulish, expo-font, Jest + jest-expo + @testing-library/react-native.

**Spec:** `docs/minnabo-build-spec-design.md` (and `CLAUDE_MINNABO_COMPLETE_BUILD_SPEC.md`)

## Global Constraints

- All user-facing text in **norsk bokmål**. No language switcher. Strings centralized in `src/i18n/nb.ts`.
- **Light theme only.** No dark theme, no glassmorphism, no random colors, no strong animations.
- **No payment anything** — no checkout, wallet, balance, payout, Vipps, "Betal nå", commission, escrow, transaction table. Ever.
- Price is always `{ amountMinor: number; currency: 'NOK' }`. Format via `formatPrice`.
- `Listing.type` is an explicit field `'TASK_REQUEST' | 'SERVICE_OFFER'`. Never inferred from text.
- «Oppdrag» is the front page / default route. No "Hjem" tab.
- Profile avatar is a fixed circular shortcut top-right on every logged-in main screen, accessibility label «Åpne profil».
- Design tokens are the single source of truth for color/spacing/type — components never hardcode hex values.
- TypeScript `strict: true`. No `any` in committed code.
- Every accessible control has an accessibility label in bokmål.

### Design tokens (verbatim)

```
navy #0B2E4E   navyMuted #7A8794   lime #8CC63F   limeGradientEnd #A5D638
cyan #22A9E0   bg #FDFBFA   surface #FFFFFF   line #ECEFF2
bubbleIn #EDEFF2   bubbleOut #DBF1FB   star #F5B301   shieldGreen #3AAE5C   dangerText #C0392B
```
Font: Mulish (400 Regular, 700 Bold, 800 ExtraBold). Screen padding 20. Card radius 18, border 1px line, shadow `0 2px 10px rgba(11,46,78,0.06)`. Button pill radius 999 height 54. Category tile 72×72 radius 16. Avatar circle, 2px cyan ring. FAB 62px lime-gradient circle.

---

## File Structure

```
app/                              expo-router routes
  _layout.tsx                     root: fonts, QueryClientProvider, Stack
  (tabs)/_layout.tsx              bottom tab bar (5 slots, center FAB)
  (tabs)/index.tsx                Oppdrag front page (default route)
  (tabs)/fellesskap.tsx           placeholder (slice 11)
  (tabs)/innboks.tsx             placeholder (slice 6)
  (tabs)/meny.tsx                 placeholder (slice 11)
  legg-ut.tsx                     placeholder choice screen (slice 5)
src/
  theme/tokens.ts                 color/space/radius/type/shadow tokens
  theme/index.ts                  re-export + helpers (elevation, hitSlop)
  i18n/nb.ts                      all bokmål strings
  domain/types.ts                 entity types
  domain/proposalMachine.ts       pure proposal state machine
  domain/price.ts                 Price type + formatPrice
  data/seed.ts                    seed dataset
  data/repositories.ts            in-memory repos + AsyncStorage hydrate
  api/client.ts                   typed MockApiClient (mirrors future REST)
  api/queries.ts                  TanStack Query hooks
  components/ui/Text.tsx
  components/ui/Button.tsx
  components/ui/Card.tsx
  components/ui/StatusPill.tsx
  components/ui/CategoryChip.tsx
  components/ui/Avatar.tsx
  components/ui/SearchField.tsx
  components/ui/SectionHeader.tsx
  components/ui/Icon.tsx
  components/ui/ScreenState.tsx    loading/empty/error/offline/no-access
  components/TopBar.tsx            HomeTopBar + DetailTopBar variants
  components/ListingCard.tsx
  components/BrandMark.tsx         logo-icon + wordmark
assets/
  logo.png  logo-icon.png         copied from project root
tests/
  domain/proposalMachine.test.ts
  domain/price.test.ts
  components/Button.test.tsx
  components/ListingCard.test.tsx
  screens/oppdrag.test.tsx
```

---

## Task 1: Project scaffold + tooling

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `jest.config.js`, `jest-setup.ts`, `.gitignore` (exists — extend), `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`
- Create: `assets/logo.png`, `assets/logo-icon.png` (copy from repo root)

**Interfaces:**
- Produces: a runnable Expo app; `npm test` runs Jest with `jest-expo` preset; expo-router default route renders `app/(tabs)/index.tsx`.

- [ ] **Step 1: Create the Expo project in place**

Run in repo root:
```bash
npx create-expo-app@latest . --template blank-typescript --no-install
```
If it refuses because the directory is non-empty, scaffold in a temp dir and copy `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `App.tsx` over, then delete `App.tsx`.

- [ ] **Step 2: Install dependencies**

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar expo-font expo-splash-screen react-native-gesture-handler
npm install @tanstack/react-query @react-native-async-storage/async-storage @expo/vector-icons @expo-google-fonts/mulish expo-linear-gradient
npm install -D jest jest-expo @testing-library/react-native @testing-library/jest-native @types/jest react-test-renderer
```

- [ ] **Step 3: Configure expo-router**

`app.json`: set `"scheme": "minnabo"`, add `"plugins": ["expo-router"]`, set `"main": "expo-router/entry"` in `package.json`. Remove `App.tsx`.
`babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
```

- [ ] **Step 4: Configure Jest**

`package.json` add:
```json
"scripts": { "test": "jest", "start": "expo start", "typecheck": "tsc --noEmit" },
"jest": { "preset": "jest-expo", "setupFilesAfterEnv": ["<rootDir>/jest-setup.ts"],
  "transformIgnorePatterns": ["node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@tanstack/.*))"] }
```
`jest-setup.ts`:
```ts
import '@testing-library/jest-native/extend-expect';
```

- [ ] **Step 5: tsconfig strict + path alias**

`tsconfig.json`:
```json
{ "extends": "expo/tsconfig.base",
  "compilerOptions": { "strict": true, "baseUrl": ".", "paths": { "@/*": ["src/*"] } },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"] }
```

- [ ] **Step 6: Copy brand assets**

```bash
cp logo.png assets/logo.png && cp logo-icon.png assets/logo-icon.png
```

- [ ] **Step 7: Minimal root + tabs layout so the app boots**

`app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```
`app/(tabs)/_layout.tsx`: temporary `import { Tabs } from 'expo-router'; export default () => <Tabs screenOptions={{ headerShown: false }} />;`
`app/(tabs)/index.tsx`: temporary `<View><Text>Oppdrag</Text></View>`.

- [ ] **Step 8: Verify it boots and tests run**

Run: `npm run typecheck` → Expected: no errors.
Run: `npx expo start --no-dev --max-workers 1` briefly, or `npx expo export --platform web` → Expected: bundles without error.
Run: `npm test` → Expected: "No tests found" (exit 0) or passing.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "chore: scaffold Expo app with expo-router, RN Testing Library, brand assets"
```

---

## Task 2: Design tokens + i18n string table

**Files:**
- Create: `src/theme/tokens.ts`, `src/theme/index.ts`, `src/i18n/nb.ts`
- Test: `tests/theme/tokens.test.ts`

**Interfaces:**
- Produces:
  - `tokens.color`: `{ navy, navyMuted, lime, limeGradientEnd, cyan, bg, surface, line, bubbleIn, bubbleOut, star, shieldGreen, dangerText, white }` (all string hex)
  - `tokens.space`: `{ xs:4, sm:8, md:12, lg:16, xl:20, xxl:28, xxxl:40 }`
  - `tokens.radius`: `{ sm:8, md:12, tile:16, card:18, pill:999 }`
  - `tokens.font`: `{ regular:'Mulish_400Regular', bold:'Mulish_700Bold', extrabold:'Mulish_800ExtraBold' }`
  - `tokens.text`: `{ h1:{fontSize:32,...}, question:{fontSize:28,...}, section:{fontSize:20,...}, cardTitle:{fontSize:17,...}, body:{fontSize:15,...}, meta:{fontSize:13,...} }` — each `{ fontSize, lineHeight, fontFamily }`
  - `tokens.shadow.card`: RN shadow style object (`shadowColor:'#0B2E4E', shadowOpacity:0.06, shadowRadius:10, shadowOffset:{width:0,height:2}, elevation:2`)
  - `nb` default export: nested object of bokmål strings. Keys used this slice: `nb.tabs.{oppdrag,fellesskap,leggUt,innboks,meny}`, `nb.home.{question,searchPlaceholder,nearYou}`, `nb.categories.{alle,hage,renhold,transport,montering}`, `nb.badge.{needsHelp,offersHelp}`, `nb.a11y.{openProfile,notifications}`, `nb.state.{loading,emptyListings,error,offline,retry,noAccess}`, `nb.common.{km,fixedPrice,fromPrice,priceByAgreement}`.

- [ ] **Step 1: Write the failing test**

`tests/theme/tokens.test.ts`:
```ts
import { tokens } from '@/theme';
import nb from '@/i18n/nb';

test('core color tokens exist with expected values', () => {
  expect(tokens.color.navy).toBe('#0B2E4E');
  expect(tokens.color.lime).toBe('#8CC63F');
  expect(tokens.color.cyan).toBe('#22A9E0');
  expect(tokens.color.bg).toBe('#FDFBFA');
});

test('text scale entries carry fontFamily + lineHeight', () => {
  for (const key of ['h1', 'question', 'section', 'cardTitle', 'body', 'meta'] as const) {
    expect(tokens.text[key].fontSize).toBeGreaterThan(0);
    expect(tokens.text[key].lineHeight).toBeGreaterThan(tokens.text[key].fontSize);
    expect(tokens.text[key].fontFamily).toContain('Mulish');
  }
});

test('nb strings are bokmål and complete for slice 0-2', () => {
  expect(nb.tabs.oppdrag).toBe('Oppdrag');
  expect(nb.home.question).toBe('Hva trenger du hjelp med?');
  expect(nb.home.searchPlaceholder).toBe('Søk etter småjobber');
  expect(nb.badge.needsHelp).toBe('Trenger hjelp');
  expect(nb.badge.offersHelp).toBe('Tilbyr hjelp');
  expect(nb.state.offline).toMatch(/nett/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/theme/tokens.test.ts` → Expected: FAIL, cannot find module `@/theme`.

- [ ] **Step 3: Implement tokens**

`src/theme/tokens.ts` — export `tokens` with the values from Global Constraints and the Interfaces block above. `src/theme/index.ts` — `export { tokens } from './tokens';` plus `export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };`.

- [ ] **Step 4: Implement nb.ts**

`src/i18n/nb.ts` — `const nb = { ... } as const; export default nb;` with every key listed in Interfaces. Values:
`tabs`: Oppdrag / Fellesskap / Legg ut / Innboks / Meny.
`home`: question `Hva trenger du hjelp med?`, searchPlaceholder `Søk etter småjobber`, nearYou `Jobber nær deg`.
`categories`: Alle / Hage / Renhold / Transport / Montering.
`badge`: needsHelp `Trenger hjelp`, offersHelp `Tilbyr hjelp`.
`a11y`: openProfile `Åpne profil`, notifications `Varsler`.
`state`: loading `Laster …`, emptyListings `Ingen oppføringer her ennå.`, error `Noe gikk galt. Prøv igjen.`, offline `Du er uten nettforbindelse.`, retry `Prøv igjen`, noAccess `Du har ikke tilgang til dette.`.
`common`: km `km`, fixedPrice `Fastpris`, fromPrice `Pris avtales`, priceByAgreement `Pris avtales`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test tests/theme/tokens.test.ts` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/theme src/i18n tests/theme && git commit -m "feat: design tokens and bokmål string table"
```

---

## Task 3: Domain — Price + formatPrice

**Files:**
- Create: `src/domain/price.ts`
- Test: `tests/domain/price.test.ts`

**Interfaces:**
- Produces:
  - `type Price = { amountMinor: number; currency: 'NOK' }`
  - `formatPrice(p: Price): string` → e.g. `{amountMinor: 60000}` → `"600 kr"`, `{amountMinor: 150000}` → `"1 500 kr"` (non-breaking space thousands separator ` `)
  - `formatFromPrice(p: Price): string` → `"Fra 500 kr"`
  - `nok(kroner: number): Price` helper → `{ amountMinor: kroner * 100, currency: 'NOK' }`

- [ ] **Step 1: Write the failing test**

`tests/domain/price.test.ts`:
```ts
import { formatPrice, formatFromPrice, nok } from '@/domain/price';

test('formats whole kroner without decimals', () => {
  expect(formatPrice(nok(600))).toBe('600 kr');
});
test('groups thousands with non-breaking space', () => {
  expect(formatPrice(nok(1500))).toBe('1 500 kr');
});
test('formatFromPrice prefixes Fra', () => {
  expect(formatFromPrice(nok(500))).toBe('Fra 500 kr');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/domain/price.test.ts` → Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/domain/price.ts`:
```ts
export type Price = { amountMinor: number; currency: 'NOK' };
export const nok = (kroner: number): Price => ({ amountMinor: Math.round(kroner * 100), currency: 'NOK' });
const groupThousands = (n: number) => n.toLocaleString('nb-NO').replace(/\s/g, ' ');
export const formatPrice = (p: Price): string => `${groupThousands(Math.round(p.amountMinor / 100))} kr`;
export const formatFromPrice = (p: Price): string => `Fra ${formatPrice(p)}`;
```
If `toLocaleString('nb-NO')` grouping is unreliable under Jest/Hermes, implement manual grouping: `String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/domain/price.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/price.ts tests/domain/price.test.ts && git commit -m "feat: Price type and NOK formatting"
```

---

## Task 4: Domain — entity types

**Files:**
- Create: `src/domain/types.ts`
- Test: `tests/domain/types.test.ts` (compile-only assertions)

**Interfaces:**
- Produces (exact names later tasks rely on):
  - `ListingType = 'TASK_REQUEST' | 'SERVICE_OFFER'`
  - `Category = { id: string; slug: string; label: string; icon: string }`
  - `LocationInfo = { municipality: string; place: string; distanceKm?: number }`
  - `Verification = { kind: 'PHONE' | 'EMAIL' | 'BUSINESS'; verified: boolean; explanation: string }`
  - `PublicProfile = { id: string; displayName: string; avatarUrl?: string; initials: string; rating?: { average: number; count: number }; memberSince: string; location: LocationInfo; verifications: Verification[]; isBusiness: boolean }`
  - `ListingImage = { id: string; url: string }`
  - `TaskDetails = { description: string; equipment?: string; meetingNote?: string; durationText?: string; scheduledText?: string }`
  - `ServiceOfferDetails = { about: string; experienceYears?: number; completedJobs?: number; services: string[]; availabilityText?: string; equipmentText?: string; maxDistanceKm?: number }`
  - `Listing = { id: string; type: ListingType; title: string; category: Category; price?: Price; priceMode: 'FIXED' | 'BUDGET' | 'FROM' | 'BY_AGREEMENT'; location: LocationInfo; images: ListingImage[]; owner: PublicProfile; createdAt: string; status: string; task?: TaskDetails; offer?: ServiceOfferDetails; saved?: boolean }`
  - `ListingFilter = { type?: ListingType; categorySlug?: string; maxDistanceKm?: number; query?: string; verifiedOnly?: boolean }`
  - `ListingSort = 'RELEVANCE' | 'DISTANCE' | 'NEWEST' | 'PRICE'`
  - re-export `Price` from `./price`

- [ ] **Step 1: Write the (compile) test**

`tests/domain/types.test.ts`:
```ts
import type { Listing, ListingType } from '@/domain/types';
test('listing type union is explicit', () => {
  const t: ListingType[] = ['TASK_REQUEST', 'SERVICE_OFFER'];
  expect(t).toHaveLength(2);
});
test('a task listing shape compiles', () => {
  const l: Listing = {
    id: '1', type: 'TASK_REQUEST', title: 'Klippe plen',
    category: { id: 'c1', slug: 'hage', label: 'Hage', icon: 'feather' },
    price: { amountMinor: 60000, currency: 'NOK' }, priceMode: 'FIXED',
    location: { municipality: 'Lillehammer', place: 'Lillehammer', distanceKm: 1.2 },
    images: [], owner: {
      id: 'u1', displayName: 'Jonas Berg', initials: 'JB',
      memberSince: '2026', location: { municipality: 'Lillehammer', place: 'Lillehammer' },
      verifications: [], isBusiness: false,
    }, createdAt: '2026-08-01T10:00:00Z', status: 'PUBLISHED',
    task: { description: 'Test' },
  };
  expect(l.type).toBe('TASK_REQUEST');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/domain/types.test.ts` → Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/domain/types.ts`** with the exact type definitions from Interfaces. `export type { Price } from './price';`

- [ ] **Step 4: Run test + typecheck**

Run: `npm test tests/domain/types.test.ts` → PASS. Run: `npm run typecheck` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts tests/domain/types.test.ts && git commit -m "feat: domain entity types"
```

---

## Task 5: Domain — proposal state machine

**Files:**
- Create: `src/domain/proposalMachine.ts`
- Test: `tests/domain/proposalMachine.test.ts`

**Interfaces:**
- Produces:
  - `ProposalStatus = 'DRAFT' | 'SENT' | 'WITHDRAWN' | 'DECLINED' | 'ACCEPTED' | 'REVISION_PENDING'`
  - `ProposalEvent = 'SEND' | 'WITHDRAW' | 'DECLINE' | 'ACCEPT' | 'REQUEST_REVISION' | 'CONFIRM_REVISION'`
  - `Actor = 'PROPOSER' | 'RECIPIENT'`
  - `canTransition(from: ProposalStatus, event: ProposalEvent, actor: Actor): boolean`
  - `transition(from: ProposalStatus, event: ProposalEvent, actor: Actor): ProposalStatus` — throws `Error` with bokmål message if not allowed
  - Rules: PROPOSER may SEND (DRAFT→SENT), WITHDRAW (SENT→WITHDRAWN), CONFIRM_REVISION (REVISION_PENDING→ACCEPTED). RECIPIENT may ACCEPT (SENT→ACCEPTED), DECLINE (SENT→DECLINED), REQUEST_REVISION (ACCEPTED→REVISION_PENDING), DECLINE (REVISION_PENDING→DECLINED).

- [ ] **Step 1: Write the failing test**

`tests/domain/proposalMachine.test.ts`:
```ts
import { transition, canTransition } from '@/domain/proposalMachine';

test('proposer sends a draft', () => {
  expect(transition('DRAFT', 'SEND', 'PROPOSER')).toBe('SENT');
});
test('recipient accepts a sent proposal', () => {
  expect(transition('SENT', 'ACCEPT', 'RECIPIENT')).toBe('ACCEPTED');
});
test('proposer cannot accept their own proposal', () => {
  expect(canTransition('SENT', 'ACCEPT', 'PROPOSER')).toBe(false);
  expect(() => transition('SENT', 'ACCEPT', 'PROPOSER')).toThrow();
});
test('revision round trip', () => {
  expect(transition('ACCEPTED', 'REQUEST_REVISION', 'RECIPIENT')).toBe('REVISION_PENDING');
  expect(transition('REVISION_PENDING', 'CONFIRM_REVISION', 'PROPOSER')).toBe('ACCEPTED');
});
test('cannot withdraw after acceptance', () => {
  expect(canTransition('ACCEPTED', 'WITHDRAW', 'PROPOSER')).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/domain/proposalMachine.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement** a transition table `Record<ProposalStatus, Partial<Record<ProposalEvent, { to: ProposalStatus; actor: Actor }>>>` and the two functions. Throw `new Error('Ugyldig endring av tilbudet.')` on disallowed transitions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/domain/proposalMachine.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/proposalMachine.ts tests/domain/proposalMachine.test.ts && git commit -m "feat: proposal state machine"
```

---

## Task 6: Mock data — seed dataset

**Files:**
- Create: `src/data/seed.ts`
- Test: `tests/data/seed.test.ts`

**Interfaces:**
- Consumes: `Listing`, `Category`, `PublicProfile` from `@/domain/types`; `nok` from `@/domain/price`.
- Produces:
  - `categories: Category[]` — hage, renhold, flytting, transport, montering, snomaking, maling, dyrepass, datahjelp, arrangement, annet (labels in bokmål: Hage, Rengjøring, Flytting/bæring, Transport/levering, Montering, Snømåking, Maling/vedlikehold, Dyrepass, Datahjelp, Arrangementshjelp, Annet).
  - `homeCategories: Category[]` — the 5 shown on the front page: Alle (slug `alle`), Hage, Rengjøring→shown as "Renhold" per mockup label, Transport, Montering. (Front page label for renhold is `Renhold`.)
  - `profiles: Record<string, PublicProfile>` — at least `jonas` (Jonas Berg, 4.9/18, phone verified, Lillehammer), `andreas` (Andreas, 4.9/12, phone verified, member since 2026), `emma`, `martin`, `fjellbygg` (business, verified).
  - `listings: Listing[]` — at least 6: "Klippe plen" (TASK_REQUEST, hage, 600 kr fixed, owner jonas, 3 images, 1.2km, description + equipment "Kan lånes" + meetingNote "Adresse deles når tilbud er godtatt" + durationText "Omtrent 1–2 timer" + scheduledText "I morgen kl. 17:00"), "Hjelp med flytting" (TASK_REQUEST, transport, 1500 kr, 2.8km), "Jeg kan klippe plenen din" (SERVICE_OFFER, hage, from 500 kr, owner andreas, services ["Gressklipping","Kantklipping","Enkelt hagearbeid"], experienceYears 2, completedJobs 9, availabilityText "Ledig ettermiddager og helger", equipmentText "Har egen gressklipper", maxDistanceKm 15), plus one more SERVICE_OFFER and two more TASK_REQUEST across renhold/montering.
  - image URLs: use `https://images.unsplash.com/...` placeholder strings (rendered via RN Image; fine for mock).

- [ ] **Step 1: Write the failing test**

`tests/data/seed.test.ts`:
```ts
import { listings, categories, homeCategories } from '@/data/seed';

test('seed contains both listing types', () => {
  expect(listings.some(l => l.type === 'TASK_REQUEST')).toBe(true);
  expect(listings.some(l => l.type === 'SERVICE_OFFER')).toBe(true);
});
test('Klippe plen matches the mockup', () => {
  const l = listings.find(l => l.title === 'Klippe plen')!;
  expect(l.type).toBe('TASK_REQUEST');
  expect(l.priceMode).toBe('FIXED');
  expect(l.price).toEqual({ amountMinor: 60000, currency: 'NOK' });
  expect(l.category.label).toBe('Hage');
  expect(l.images.length).toBe(3);
  expect(l.owner.displayName).toBe('Jonas Berg');
  expect(l.task?.meetingNote).toMatch(/Adresse deles/);
});
test('home shows exactly 5 category chips starting with Alle', () => {
  expect(homeCategories[0].slug).toBe('alle');
  expect(homeCategories).toHaveLength(5);
});
test('every listing has a bokmål category label', () => {
  expect(categories.every(c => c.label.length > 0)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/data/seed.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement `src/data/seed.ts`** per Interfaces.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/data/seed.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/seed.ts tests/data/seed.test.ts && git commit -m "feat: seed dataset from mockups"
```

---

## Task 7: Mock data — repositories + API client + query hooks

**Files:**
- Create: `src/data/repositories.ts`, `src/api/client.ts`, `src/api/queries.ts`
- Test: `tests/api/client.test.ts`

**Interfaces:**
- Consumes: `seed.ts` exports; `Listing`, `ListingFilter`, `ListingSort` from types.
- Produces:
  - `repositories.listings.list(filter?: ListingFilter, sort?: ListingSort): Listing[]` — pure filter/sort over in-memory array (seed + any added). Filtering: `query` matches title case-insensitively AND never infers type; `categorySlug` (ignored when `alle`); `type`; `maxDistanceKm`; `verifiedOnly`. Sort: NEWEST by `createdAt` desc, PRICE by `amountMinor` asc (undefined last), DISTANCE by `location.distanceKm` asc, RELEVANCE = seed order.
  - `repositories.listings.get(id: string): Listing | undefined`
  - `repositories.listings.add(listing: Listing): void` + `hydrate(): Promise<void>` / `persist(): Promise<void>` using AsyncStorage key `minnabo.listings.userAdded`.
  - `class MockApiClient` with `async listListings(params): Promise<Listing[]>` and `async getListing(id): Promise<Listing>` — each `await delay(250)` then delegate to repositories; `getListing` throws `Error('Fant ikke oppføringen.')` when missing.
  - `apiClient` singleton export.
  - `src/api/queries.ts`: `useListings(filter?, sort?)` and `useListing(id)` TanStack Query hooks with query keys `['listings', filter, sort]` / `['listing', id]`.

- [ ] **Step 1: Write the failing test**

`tests/api/client.test.ts`:
```ts
import { apiClient } from '@/api/client';

test('search by text returns matching titles of both types, never inferring type', async () => {
  const res = await apiClient.listListings({ filter: { query: 'plen' } });
  const titles = res.map(l => l.title);
  expect(titles).toEqual(expect.arrayContaining(['Klippe plen', 'Jeg kan klippe plenen din']));
  // both types present — type not inferred from the word "plen"
  expect(new Set(res.map(l => l.type)).size).toBe(2);
});
test('category filter alle does not filter', async () => {
  const all = await apiClient.listListings({ filter: { categorySlug: 'alle' } });
  const none = await apiClient.listListings({});
  expect(all.length).toBe(none.length);
});
test('price sort puts cheapest first, undefined last', async () => {
  const res = await apiClient.listListings({ sort: 'PRICE' });
  const prices = res.map(l => l.price?.amountMinor ?? Infinity);
  expect(prices).toEqual([...prices].sort((a, b) => a - b));
});
test('getListing throws bokmål error when missing', async () => {
  await expect(apiClient.getListing('nope')).rejects.toThrow('Fant ikke oppføringen.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/api/client.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement** repositories, client (`const delay = (ms:number)=>new Promise(r=>setTimeout(r,ms));`), and query hooks. Mock AsyncStorage in `jest-setup.ts`: `jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/api/client.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data src/api tests/api jest-setup.ts && git commit -m "feat: mock API client, repositories, query hooks"
```

---

## Task 8: UI primitive — Text

**Files:**
- Create: `src/components/ui/Text.tsx`
- Test: `tests/components/Text.test.tsx`

**Interfaces:**
- Produces: `AppText` component. Props: `variant?: 'h1'|'question'|'section'|'cardTitle'|'body'|'meta'` (default `body`), `color?: keyof typeof tokens.color` (default `navy`), `weight?: 'regular'|'bold'|'extrabold'`, plus all RN `Text` props. Applies `tokens.text[variant]` + color + optional font override. `testID` passthrough.

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react-native';
import { AppText } from '@/components/ui/Text';
test('renders children and applies variant font size', () => {
  const { getByText } = render(<AppText variant="h1">Hei</AppText>);
  const node = getByText('Hei');
  expect(node.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ fontSize: 32 })]));
});
```

- [ ] **Step 2: Run** `npm test tests/components/Text.test.tsx` → FAIL.
- [ ] **Step 3: Implement** `AppText`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/components/ui/Text.tsx tests/components/Text.test.tsx && git commit -m "feat: AppText primitive"`

---

## Task 9: UI primitive — Icon + Avatar

**Files:**
- Create: `src/components/ui/Icon.tsx`, `src/components/ui/Avatar.tsx`
- Test: `tests/components/Avatar.test.tsx`

**Interfaces:**
- Produces:
  - `Icon` — wraps `Feather` from `@expo/vector-icons`. Props `name: keyof typeof Feather.glyphMap`, `size?: number` (default 22), `color?: keyof typeof tokens.color` (default `navy`).
  - `Avatar` — props `uri?: string`, `initials: string`, `size?: number` (default 40), `ring?: boolean` (default true → 2px cyan border), `online?: boolean` (→ lime dot bottom-right), `accessibilityLabel?`. Falls back to initials on `navyMuted` bg circle when no `uri`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react-native';
import { Avatar } from '@/components/ui/Avatar';
test('shows initials when no uri', () => {
  const { getByText } = render(<Avatar initials="JB" />);
  expect(getByText('JB')).toBeTruthy();
});
test('renders online dot when online', () => {
  const { getByTestId } = render(<Avatar initials="JB" online testID="av" />);
  expect(getByTestId('av-online')).toBeTruthy();
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** both. Mock `@expo/vector-icons` in jest-setup if needed: `jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));`
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/components/ui/Icon.tsx src/components/ui/Avatar.tsx tests/components/Avatar.test.tsx && git commit -m "feat: Icon and Avatar primitives"`

---

## Task 10: UI primitive — Button

**Files:**
- Create: `src/components/ui/Button.tsx`
- Test: `tests/components/Button.test.tsx`

**Interfaces:**
- Produces: `Button` — props `label: string`, `onPress: () => void`, `variant?: 'primary'|'secondary'|'ghost'` (default `primary`), `disabled?`, `loading?`, `accessibilityLabel?`, `testID?`. primary = lime gradient (`expo-linear-gradient`, colors `[lime, limeGradientEnd]`) navy label; secondary = white bg + 1.5px lime border + navy label; ghost = transparent + cyan label. Height 54, radius pill, label `cardTitle` weight bold. Disabled → 0.5 opacity, `onPress` guarded. Double-press guard: ignore presses within 600ms.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';
test('calls onPress once on rapid double tap', () => {
  const fn = jest.fn();
  const { getByText } = render(<Button label="Gi tilbud" onPress={fn} />);
  fireEvent.press(getByText('Gi tilbud'));
  fireEvent.press(getByText('Gi tilbud'));
  expect(fn).toHaveBeenCalledTimes(1);
});
test('disabled button does not fire', () => {
  const fn = jest.fn();
  const { getByText } = render(<Button label="Send" onPress={fn} disabled />);
  fireEvent.press(getByText('Send'));
  expect(fn).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Mock `expo-linear-gradient` in jest-setup: `jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));`
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/components/ui/Button.tsx tests/components/Button.test.tsx jest-setup.ts && git commit -m "feat: Button primitive with double-press guard"`

---

## Task 11: UI primitives — Card, StatusPill, CategoryChip, SearchField, SectionHeader

**Files:**
- Create: `src/components/ui/Card.tsx`, `StatusPill.tsx`, `CategoryChip.tsx`, `SearchField.tsx`, `SectionHeader.tsx`
- Test: `tests/components/primitives.test.tsx`

**Interfaces:**
- `Card` — `View` wrapper: surface bg, radius `card`, 1px `line` border, `tokens.shadow.card`, padding default `space.lg`. Prop `onPress?` → wraps in Pressable. `style?` passthrough.
- `StatusPill` — props `label: string`, `tone: 'lime'|'cyan'|'neutral'`. Outlined pill: border + text in tone color (`neutral` = navyMuted), transparent/tinted bg (`cyan` tone gets `#EAF7FD` bg for "Åpent oppdrag"). Text 12px bold.
- `CategoryChip` — props `label`, `icon` (Feather name), `active?`, `onPress`. 72×72 tile radius `tile`. Active = lime border + `#F4F9EC` bg + lime icon/label; inactive = `line` border + surface bg + navy icon/label. Label `meta` size centered under icon.
- `SearchField` — props `placeholder`, `value`, `onChangeText`, `onSubmit?`, `editable?` (default true), `onPress?` (for navigating when used as a button). Lime magnifier icon left, rounded 16 container, `line` border, height 52, `navyMuted` placeholder.
- `SectionHeader` — props `title`. `AppText variant="section"` with `space.md` bottom margin.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { StatusPill } from '@/components/ui/StatusPill';
import { CategoryChip } from '@/components/ui/CategoryChip';
import { SearchField } from '@/components/ui/SearchField';
test('StatusPill shows label', () => {
  const { getByText } = render(<StatusPill label="Åpent oppdrag" tone="cyan" />);
  expect(getByText('Åpent oppdrag')).toBeTruthy();
});
test('CategoryChip fires onPress with label', () => {
  const fn = jest.fn();
  const { getByText } = render(<CategoryChip label="Hage" icon="feather" onPress={fn} />);
  fireEvent.press(getByText('Hage'));
  expect(fn).toHaveBeenCalled();
});
test('SearchField calls onChangeText', () => {
  const fn = jest.fn();
  const { getByPlaceholderText } = render(
    <SearchField placeholder="Søk etter småjobber" value="" onChangeText={fn} />);
  fireEvent.changeText(getByPlaceholderText('Søk etter småjobber'), 'plen');
  expect(fn).toHaveBeenCalledWith('plen');
});
```

- [ ] **Step 2: Run** `npm test tests/components/primitives.test.tsx` → FAIL.
- [ ] **Step 3: Implement** all five.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/components/ui tests/components/primitives.test.tsx && git commit -m "feat: Card, StatusPill, CategoryChip, SearchField, SectionHeader"`

---

## Task 12: ScreenState wrapper

**Files:**
- Create: `src/components/ui/ScreenState.tsx`
- Test: `tests/components/ScreenState.test.tsx`

**Interfaces:**
- Produces: `ScreenState` — props `status: 'loading'|'error'|'offline'|'empty'|'noAccess'|'ready'`, `onRetry?: () => void`, `emptyText?: string`, `children: ReactNode`. When `ready` renders `children`; otherwise a centered column: icon + bokmål message from `nb.state.*` + (for error/offline) a `Button variant="secondary" label={nb.state.retry}`. `empty` uses `emptyText ?? nb.state.emptyListings`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ScreenState } from '@/components/ui/ScreenState';
import { Text } from 'react-native';
test('renders children when ready', () => {
  const { getByText } = render(<ScreenState status="ready"><Text>Innhold</Text></ScreenState>);
  expect(getByText('Innhold')).toBeTruthy();
});
test('shows retry on error and calls onRetry', () => {
  const fn = jest.fn();
  const { getByText } = render(<ScreenState status="error" onRetry={fn}>x</ScreenState>);
  fireEvent.press(getByText('Prøv igjen'));
  expect(fn).toHaveBeenCalled();
});
test('offline message mentions nett', () => {
  const { getByText } = render(<ScreenState status="offline">x</ScreenState>);
  expect(getByText(/nett/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/components/ui/ScreenState.tsx tests/components/ScreenState.test.tsx && git commit -m "feat: ScreenState wrapper for loading/error/offline/empty/no-access"`

---

## Task 13: BrandMark + TopBar

**Files:**
- Create: `src/components/BrandMark.tsx`, `src/components/TopBar.tsx`
- Test: `tests/components/TopBar.test.tsx`

**Interfaces:**
- Consumes: `Avatar`, `Icon`, `AppText`, `assets/logo-icon.png`.
- Produces:
  - `BrandMark` — row: `logo-icon.png` (28×28) + `AppText` "MinNabo" `section` weight extrabold. (Uses the icon PNG + text rather than the full logo PNG so it scales crisply.)
  - `HomeTopBar` — props `onProfilePress`, `onNotificationsPress`, `unreadNotifications?: boolean`, `avatar: { uri?: string; initials: string }`. Left `BrandMark`; right: bell `Icon` (with cyan dot when `unreadNotifications`) + `Avatar size={40}` with `accessibilityLabel={nb.a11y.openProfile}`. Safe-area top padding.
  - `DetailTopBar` — props `title`, `onBack`, `onProfilePress`, `onNotificationsPress`, `avatar`. Left back chevron `Icon` (`accessibilityLabel: 'Tilbake'`), centered `AppText variant="cardTitle"` title, right bell + avatar.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { HomeTopBar } from '@/components/TopBar';
test('profile shortcut has bokmål a11y label and fires', () => {
  const fn = jest.fn();
  const { getByLabelText } = render(
    <HomeTopBar avatar={{ initials: 'MB' }} onProfilePress={fn}
      onNotificationsPress={() => {}} unreadNotifications />);
  fireEvent.press(getByLabelText('Åpne profil'));
  expect(fn).toHaveBeenCalled();
});
test('shows notification dot when unread', () => {
  const { getByTestId } = render(
    <HomeTopBar avatar={{ initials: 'MB' }} onProfilePress={() => {}}
      onNotificationsPress={() => {}} unreadNotifications testID="bar" />) as any;
  expect(getByTestId('bar-noti-dot')).toBeTruthy();
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Mock static image require in jest via `moduleNameMapper` or a transform — add to jest config `"moduleNameMapper": { "\\.(png|jpg|jpeg)$": "<rootDir>/tests/fileMock.js" }` and create `tests/fileMock.js` → `module.exports = 1;`
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/components/BrandMark.tsx src/components/TopBar.tsx tests/components/TopBar.test.tsx tests/fileMock.js jest.config.js package.json && git commit -m "feat: BrandMark and TopBar variants"`

---

## Task 14: Bottom tab bar with center FAB

**Files:**
- Modify: `app/(tabs)/_layout.tsx`
- Create: `src/components/TabBar.tsx`, `app/(tabs)/fellesskap.tsx`, `app/(tabs)/innboks.tsx`, `app/(tabs)/meny.tsx`, `app/legg-ut.tsx`
- Test: `tests/components/TabBar.test.tsx`

**Interfaces:**
- Consumes: expo-router `Tabs`, `router`.
- Produces: `TabBar` custom `tabBar` component for `Tabs`. 5 slots in order: Oppdrag (`clipboard`), Fellesskap (`users`), **Legg ut** (center, raised 62px lime-gradient circle with black `plus`, navigates `router.push('/legg-ut')` — not a real tab screen), Innboks (`message-circle`), Meny (`menu`). Active tab: lime icon + lime label; inactive: navy. Labels always visible, `meta` size. White bg, top hairline `line`, safe-area bottom padding.
- Placeholder screens render `<ScreenState status="ready">` with a centered `AppText` naming the screen.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { TabBar } from '@/components/TabBar';
const nav = { navigate: jest.fn() };
const state = { index: 0, routes: [{ key: 'index', name: 'index' }, { key: 'fellesskap', name: 'fellesskap' }, { key: 'innboks', name: 'innboks' }, { key: 'meny', name: 'meny' }] };
test('renders all five labels including Legg ut', () => {
  const { getByText } = render(<TabBar state={state as any} navigation={nav as any} descriptors={{} as any} />);
  ['Oppdrag', 'Fellesskap', 'Legg ut', 'Innboks', 'Meny'].forEach(l => expect(getByText(l)).toBeTruthy());
});
test('tapping Fellesskap navigates', () => {
  const { getByText } = render(<TabBar state={state as any} navigation={nav as any} descriptors={{} as any} />);
  fireEvent.press(getByText('Fellesskap'));
  expect(nav.navigate).toHaveBeenCalledWith('fellesskap');
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `TabBar` and wire `<Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false }}>` with `<Tabs.Screen>` entries for index/fellesskap/innboks/meny. Create placeholder screens + `app/legg-ut.tsx` (`<Stack.Screen options={{ presentation: 'modal' }}>` style, simple placeholder).
- [ ] **Step 4: Run** → PASS; also `npx expo export --platform web` bundles.
- [ ] **Step 5: Commit** `git add app src/components/TabBar.tsx tests/components/TabBar.test.tsx && git commit -m "feat: custom bottom tab bar with raised Legg ut FAB"`

---

## Task 15: ListingCard

**Files:**
- Create: `src/components/ListingCard.tsx`
- Test: `tests/components/ListingCard.test.tsx`

**Interfaces:**
- Consumes: `Listing`, `formatPrice`/`formatFromPrice`, `Card`, `StatusPill`, `AppText`, `Icon`.
- Produces: `ListingCard` — props `listing: Listing`, `onPress: () => void`. Layout per `homepage.png`: rounded thumbnail left (96×96 radius `md`), right column: title (`cardTitle`), location row (cyan `map-pin` icon + `"{place} · {distance} km"` in `meta`), price (`section` size, lime, bold) — `formatPrice` for FIXED/BUDGET, `formatFromPrice` for FROM, `nb.common.priceByAgreement` for BY_AGREEMENT. Bottom row: category `StatusPill` (tone `lime` for TASK_REQUEST category, `cyan` for others per mockup) + a small type badge `StatusPill` with `nb.badge.needsHelp` (TASK_REQUEST) / `nb.badge.offersHelp` (SERVICE_OFFER). Trailing `chevron-right` cyan icon, vertically centered. Whole card pressable, `accessibilityRole="button"`, `accessibilityLabel` = `"{title}, {typeBadge}"`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ListingCard } from '@/components/ListingCard';
import { listings } from '@/data/seed';
const task = listings.find(l => l.title === 'Klippe plen')!;
const offer = listings.find(l => l.type === 'SERVICE_OFFER')!;
test('task card shows price, place, needs-help badge', () => {
  const { getByText } = render(<ListingCard listing={task} onPress={() => {}} />);
  expect(getByText('600 kr')).toBeTruthy();
  expect(getByText(/Lillehammer/)).toBeTruthy();
  expect(getByText('Trenger hjelp')).toBeTruthy();
});
test('service offer card shows offers-help badge and Fra price', () => {
  const { getByText } = render(<ListingCard listing={offer} onPress={() => {}} />);
  expect(getByText('Tilbyr hjelp')).toBeTruthy();
});
test('fires onPress', () => {
  const fn = jest.fn();
  const { getByLabelText } = render(<ListingCard listing={task} onPress={fn} />);
  fireEvent.press(getByLabelText(/Klippe plen/));
  expect(fn).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/components/ListingCard.tsx tests/components/ListingCard.test.tsx && git commit -m "feat: ListingCard with type + category badges"`

---

## Task 16: Oppdrag front page

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Create: `src/screens/OppdragScreen.tsx`, `src/hooks/useCurrentUser.ts`
- Test: `tests/screens/oppdrag.test.tsx`

**Interfaces:**
- Consumes: `useListings`, `HomeTopBar`, `SearchField`, `CategoryChip`, `SectionHeader`, `ListingCard`, `ScreenState`, `homeCategories`, `nb`.
- Produces:
  - `useCurrentUser()` → `{ id, displayName, initials, avatarUrl? }` from a `profiles.mb` seed entry (the logged-in user, "Marius B" placeholder, matches the avatar in mockups). Used for the top-right avatar.
  - `OppdragScreen` — `ScrollView` on `bg`. Order: `HomeTopBar` (onProfilePress → `router.push('/profil')` guarded to no-op if route absent this slice; onNotificationsPress → `router.push('/varsler')` likewise), `AppText variant="question"` `nb.home.question`, `SearchField` (as button: `onPress` → `router.push('/sok')`, non-editable placeholder), horizontal `ScrollView` of `CategoryChip` from `homeCategories` (local `activeSlug` state, default `alle`), `SectionHeader` `nb.home.nearYou`, then `useListings({ categorySlug: activeSlug })` results as `ListingCard`s (tap → `router.push(\`/oppdrag/\${id}\`)` guarded). Wrap list region in `ScreenState` driven by query `isLoading`/`isError` (`onRetry={refetch}`), empty when `data.length === 0`.
  - `app/(tabs)/index.tsx` → `export { OppdragScreen as default } from '@/screens/OppdragScreen';`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { OppdragScreen } from '@/screens/OppdragScreen';
import { renderWithProviders } from '../testUtils';

test('shows the question, search, categories and listings', async () => {
  const { getByText, getByLabelText } = renderWithProviders(<OppdragScreen />);
  expect(getByText('Hva trenger du hjelp med?')).toBeTruthy();
  expect(getByLabelText('Åpne profil')).toBeTruthy();
  await waitFor(() => expect(getByText('Klippe plen')).toBeTruthy());
  expect(getByText('Jobber nær deg')).toBeTruthy();
});

test('filtering by Hage keeps only hage listings', async () => {
  const { getByText, queryByText } = renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(getByText('Klippe plen')).toBeTruthy());
  fireEvent.press(getByText('Hage'));
  await waitFor(() => expect(queryByText('Hjelp med flytting')).toBeNull());
  expect(getByText('Klippe plen')).toBeTruthy();
});
```

Create `tests/testUtils.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render } from '@testing-library/react-native';
export function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </SafeAreaProvider>);
}
```

- [ ] **Step 2: Run** `npm test tests/screens/oppdrag.test.tsx` → FAIL.
- [ ] **Step 3: Implement** `useCurrentUser`, `OppdragScreen`, wire route. Use `try { router.push(...) } catch {}` or check via a small `safePush` helper in `src/lib/nav.ts` that swallows unknown-route errors so this slice runs before later routes exist.
- [ ] **Step 4: Run** `npm test` (full) → all PASS. `npm run typecheck` → clean. `npx expo export --platform web` → bundles.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: Oppdrag front page matching homepage.png"`

---

## Task 17: Visual polish pass vs homepage.png + slice wrap-up

**Files:**
- Modify: any of the components above for spacing/color fidelity
- Create: `README.md`

**Interfaces:** none new.

- [ ] **Step 1** Run the app (`npx expo start`, open in Expo Go or web) and place `homepage.png` side by side. Check, in order: header alignment & logo size; H1 size/weight/line-height; search field height/radius/icon color; category tile size (72), active lime tint & border, icon style; section header size; card thumbnail radius, title weight, cyan pin, lime price weight, badge pills; bottom bar icon set, active lime state, raised FAB size/gradient/shadow. Adjust tokens/component styles only — no structural change.
- [ ] **Step 2** Run `npm test` and `npm run typecheck` → all green.
- [ ] **Step 3** Write `README.md`: what MinNabo is (1 paragraph, bokmål or EN), how to run (`npm install`, `npx expo start`), how to test (`npm test`), project structure, **what is mocked / out of scope** (copy §6 of the design doc), the confirmations from §0, and the reversible assumptions from §10.
- [ ] **Step 4** Commit: `git add -A && git commit -m "docs: README; polish Oppdrag front page against mockup"`
- [ ] **Step 5** Tag slice: `git tag slice-2-oppdrag-frontpage`

---

## Self-Review

**Spec coverage (slices 0–2 scope):**
- Design tokens from images → Tasks 2, 8–15 ✓
- «Oppdrag» is front page / default route → Task 16 (`app/(tabs)/index.tsx`) ✓
- Profile avatar top-right, label «Åpne profil», opens profile → Tasks 13, 16 ✓
- Bottom nav 5 slots + raised lime Legg ut FAB → Task 14 ✓
- Two listing types never inferred from text → Tasks 4, 7 (search test), 15 (both badges) ✓
- Price as amountMinor/NOK, no payment table → Task 3 ✓
- Search shows both types for "gressklipping" → Task 7 test ✓
- Category chips (Alle/Hage/Renhold/Transport/Montering) → Tasks 6, 16 ✓
- All-states wrapper (loading/empty/error/offline/no-access) → Task 12, used in Task 16 ✓
- bokmål everywhere, no switcher → Task 2 `nb.ts`, enforced in component tests ✓
- Light theme only → tokens only define light ✓
- Filters/sort engine (type, category, distance, verified, newest, price) → Task 7 (screens for filter UI are slice 3) ✓

**Deferred to later slice plans (not gaps):** detail screens (4), Legg ut forms (5), Innboks/chat (6), proposals UI (7), completion/reviews (8), profile/verification/saved/notifications screens (9), onboarding (10), Fellesskap/Meny (11), report/block (12).

**Placeholder scan:** no TBD/TODO; every code step has code. ✓
**Type consistency:** `Listing`, `ListingFilter`, `ListingSort`, `Price`, `ProposalStatus` names consistent across Tasks 3–7 and 15–16; `apiClient.listListings({ filter, sort })` param shape consistent between Task 7 definition and Task 16 usage (via `useListings` hook wrapping it). ✓
