/**
 * Meny remembers where it was opened (asked 2026-11-07): open a page from Meny, press «Tilbake», and you are
 * back on the same screen with Meny open again – the way you left it.
 *
 * `arm(path)` is called when Meny opens a page; `take(path)` when the tab bar sees a new screen. It answers
 * true once, on the way back to that same screen. Arriving at any other main screen forgets it, so Meny
 * never pops up somewhere you didn't open it.
 */
const TAB_PATHS = ['/', '/fellesskap', '/innboks'];

let armedAt: string | null = null;

export const menuReturn = {
  arm(path: string) {
    armedAt = TAB_PATHS.includes(path) ? path : null;
  },
  take(path: string): boolean {
    if (!armedAt || !TAB_PATHS.includes(path)) return false;
    const back = armedAt === path;
    armedAt = null;
    return back;
  },
  /** for tests */
  _reset() {
    armedAt = null;
  },
};
