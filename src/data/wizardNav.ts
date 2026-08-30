/**
 * One-shot channel for "jump the Legg ut wizard to step N". The preview screen
 * sets a target, then pops back to the (still-mounted) wizard, which consumes it
 * on focus. Keeps the entered form state because the wizard never remounts.
 */
let pending: number | null = null;

export const wizardNav = {
  requestStep(index: number) {
    pending = index;
  },
  consume(): number | null {
    const n = pending;
    pending = null;
    return n;
  },
  _reset() {
    pending = null;
  },
};
