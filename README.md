# MinNabo – design handoff pack

Everything Claude (Claude Code) needs to rebuild your existing Expo app so it matches the design 1:1.

```
minnabo-handoff/
├── CLAUDE.md                        → merge into your repo's CLAUDE.md
├── .claude/commands/implement-screen.md  → adds the /implement-screen command
├── src/theme/theme.ts               → all design tokens (colours, type, spacing, radii, shadows, motion, icons)
├── docs/COMPONENTS.md               → every UI component, exact specs and states
├── docs/SCREENS.md                  → checklist per screen: flows, interactions, states, youth rules
└── design/
    ├── screens/*.dc.html + mn.css   → the 47 designed screens (source of truth)
    ├── minnabo-icon.png, minnabo-wordmark.png
    └── screenshots/                 → put exported PNGs here (step 2)
```

## Step 1 – Copy into your repo
1. Create a branch: `git checkout -b redesign`
2. Copy `design/`, `docs/`, `.claude/` and `src/theme/theme.ts` into the repo root
   (adjust `src/` if your code lives elsewhere, e.g. `app/` or `lib/`).
3. Merge `CLAUDE.md` into your existing `CLAUDE.md` (or add it if you don't have one).
   Keep your own build/test/backend notes in it – Claude reads this file on every task.
4. Commit: `git commit -am "Add design handoff"`

## Step 2 – Add screenshots (strongly recommended)
Claude matches visuals much better with a picture next to the code.
On the design canvas, use Share › Export to export each artboard as PNG and save them as
`design/screenshots/<ScreenName>.png` (e.g. `Oppdrag.png`). Also useful: a few screenshots of
interaction states (an open sheet, the offer-accepted chat, a wizard step).

## Step 3 – Let Claude set up the foundation (one session)
Start Claude Code in the repo and paste:

> Read CLAUDE.md, docs/COMPONENTS.md and src/theme/theme.ts. Then look through our current app
> structure and tell me: how navigation is set up, where UI components live, and which screens in
> our repo correspond to each file in design/screens/. Make a mapping table and add it to the top of
> docs/SCREENS.md. Don't change code yet.

Review the mapping. Then:

> Install the fonts, icons and libraries listed under "Tech choices" in CLAUDE.md, load the fonts,
> and wire theme.ts in. Then build every component in docs/COMPONENTS.md in src/components/ui/
> with a simple preview screen that shows all variants (like design/screens/Komponenter.dc.html).
> Stop when the preview screen matches the component sheet.

Then:

> Rebuild the tab bar (with the raised Legg ut button), the main header and the sub header exactly
> as specified, and apply them to the existing navigation.

## Step 4 – Screens, one at a time
Use the command that the pack adds:

```
/implement-screen Oppdrag
```

Recommended order (each one depends on components proven by the one before):
1. Oppdrag → Oppdragsdetaljer → Chat → Innboks
2. LeggUt → Forhandsvisning → Publisert
3. MottatteTilbud → TilbudDetaljer → Sammenlign → Avtale → MineAvtaler
4. Jobbdag → Fullforing → Vurdering
5. Main → LoggInn → Samtykke → Oppsett (Vipps login – see step 5)
6. Profil, RedigerProfil, MineOppforinger, Lagrede, Sok, SeAlle, ForMeg, Varsler, Meny
7. Verifisering, Sikkerhet, Rapporter, TryggeKontakter, Personvern
8. Fellesskap, Nabolag, Oppslagstavle, Innstillinger, Varslinger, Vilkar, SlettKonto, Bedrift, Admin
9. Ungdomskonto + OppdragUng (after step 5)
10. Tilstander: make sure every screen has these states

After each screen: run the app on a phone/simulator, compare with the screenshot, and tell Claude
exactly what differs ("title is 2px too small", "card shadow too strong on Android"). Commit when it matches.

## Step 5 – The two product changes (need backend work)
Do these as separate tasks, planned first:

> Plan (don't code yet) how to replace our current login with Vipps Login only (OpenID Connect via
> expo-auth-session, code exchange on our backend). We need name, phone, e-mail and birth date.
> Check the current Vipps MobilePay Login API docs. List what our backend and app need to change.

> Plan (don't code yet) the youth account: role `youth` when Vipps birth date says under 18,
> automatic upgrade at 18, and server-side permission checks for everything in CLAUDE.md rule 5.
> Then list the UI changes from OppdragUng.dc.html and Ungdomskonto.dc.html.

Also decide with a lawyer: minimum age and whether guardian consent is needed (marked `[minstealder]` in the design).

## Tips for best results
- **One screen per session/task.** Long sessions drift; start fresh (`/clear`) between screens. CLAUDE.md carries the rules.
- **Ask for a plan first** on anything touching data, navigation or auth (the command already does this).
- **Give precise visual feedback** with screenshots from the device next to the design screenshot.
- **Keep business logic.** If the design needs data your API doesn't have, Claude should say so, not fake it.
- **Check Android and iOS** – shadows, blur and fonts differ; fix per platform in the component, not the screen.
- **Use git** – commit after each finished screen so you can always roll back.
- Placeholders like `[Hovedpartner 1]`, `[x] måneder`, `[minstealder]` in the design are for you to fill with real content.
