Implement the MinNabo screen `$ARGUMENTS` so it matches the design 1:1.

1. Read `CLAUDE.md`, then read `design/screens/$ARGUMENTS.dc.html` completely (markup AND the script block),
   its screenshot in `design/screenshots/` if it exists, and its row in `docs/SCREENS.md`.
2. Find the existing screen/route in this repo that corresponds to it and read it, including the hooks and API calls it uses.
3. Write a short plan: components needed (existing vs new, per `docs/COMPONENTS.md`), data needed, every interaction and state from the design. Point out anything the API can't provide yet. Wait for my OK if data or navigation must change.
4. Build missing components in `src/components/ui/` using only `src/theme/theme.ts` tokens.
5. Implement the screen: exact copy, spacing, sizes, colours, animations, loading/empty/error states.
6. Run typecheck, lint and tests; fix failures.
7. Tick the screen's items in `docs/SCREENS.md` and list anything left for me to check visually on device.
