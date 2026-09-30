# MinNabo – instructions for Claude

<!-- Merge this into the repo's existing CLAUDE.md (keep anything already there about build, tests, backend). -->

## What we are doing
Re-skinning the existing MinNabo app (React Native / Expo) to match a finished design **1:1**.
Keep the existing data layer, API calls, auth plumbing and navigation structure unless a task says otherwise.
This is a visual + interaction redesign, plus two product changes (see "Product rules").

## Source of truth (read before touching any screen)
- `design/screens/<Screen>.dc.html` – one file per screen. It is HTML/CSS + a small JS class.
  - Layout, copy and exact values are in the markup (`style="…"`) and in `design/screens/mn.css`.
  - Behaviour is in the `<script type="text/x-dc">` block: `state`, handlers and `renderVals()`
    show every interaction, validation rule, animation trigger and state the screen has.
  - `{{name}}` holes are values computed in `renderVals()`. `<sc-if>` = conditional, `<sc-for>` = list.
  - `setTimeout` "loading" in prototypes = a real async call in the app.
- `design/screenshots/` – PNG of each screen (if present). Compare side by side.
- `src/theme/theme.ts` – all tokens. **Never hard-code a colour, size, radius, font or shadow in a screen.**
- `docs/COMPONENTS.md` – CSS class → RN component spec. Build/modify components in `src/components/ui/`.
- `docs/SCREENS.md` – per-screen checklist of what must work. Tick items as they are done.

When the design and these docs disagree, the `.dc.html` file wins. When unsure, ask instead of guessing.

## Product rules (never break)
1. **Only one listing type: oppdrag** ("Trenger hjelp"). There are no service offers / "Folk som tilbyr hjelp". Remove any such UI you find.
2. **Legg ut** (raised centre tab button) opens the post-oppdrag wizard directly – no type-choice screen.
3. **Login is Vipps only.** No phone/e-mail/OTP/BankID login. Vipps is never used for payment.
4. **No payment UI ever.** Show the payment note near every price/offer:
   "Pris og betaling avtales direkte mellom dere. MinNabo håndterer ikke betaling."
5. **Under-18 = youth account.** Can only: browse oppdrag, give/withdraw tilbud, chat inside conversations created by their tilbud, view profile, safety/privacy. Everything else is locked. Enforce on the **backend** (roles/permissions), the UI only reflects it. See `OppdragUng.dc.html`, `Ungdomskonto.dc.html`.
6. **Approximate location only** in public views – never an exact address or precise pin.
7. **No gradients anywhere.** Flat colours only.
8. **Norsk bokmål only**, copy exactly as in the design files.
9. Oppdrag is the home/default route. Avatar top-right on every main screen → profile.
10. Accessibility: 44px touch targets, `accessibilityLabel` on icon-only buttons, contrast as designed.

## Tech choices
- Fonts: `@expo-google-fonts/bricolage-grotesque`, `@expo-google-fonts/figtree`
- Icons: `lucide-react-native` (name map in `theme.icons`)
- Animation: `react-native-reanimated` (entering/layout animations, springs); `react-native-svg` for drawn checks/rings
- Sheets: `@gorhom/bottom-sheet`; blur: `expo-blur`; gestures: `react-native-gesture-handler`
- Web CSS → RN: no CSS grid (use flex rows with gap), shadows via `theme.shadow` (Android = elevation),
  `backdrop-filter` → `expo-blur`, CSS keyframes → reanimated, `.i-*` mask icons → Lucide components.
- Don't add other UI libraries without asking.

## How to work
- One screen (or one component group) per task. Small, reviewable diffs.
- For each screen:
  1. Read its `.dc.html` fully and its section in `docs/SCREENS.md`.
  2. List the components it needs; build/extend missing ones in `src/components/ui/` first.
  3. Implement the screen on top of the existing data hooks/API. Keep existing tests passing.
  4. Implement every state: loading (skeleton), empty, error, offline, success.
  5. Run typecheck + lint + tests. Then describe what to compare visually, and tick the checklist.
- Never delete business logic to make the UI match; ask if the design needs data the API lacks.
- Mock data in the design (names like Mari Haugen, Kari Holm) is sample content – use real data.
