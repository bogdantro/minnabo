import { router } from 'expo-router';
import { reportError } from './reporting';

/**
 * Push a route. expo-router's typed routes are compile-time only, so this
 * helper keeps call sites loose. A genuinely bad path surfaces the router's
 * not-found screen; we also log it so it doesn't fail silently.
 */
export function safePush(path: string): void {
  try {
    router.push(path as never);
  } catch (e) {
    reportError(e, { where: 'safePush', path });
  }
}

/**
 * Leave a finished flow (Legg ut, «Tilbyr hjelp», Vurdering …) for `path`. The flow's screens are taken off
 * the history first, so «Tilbake» on the next screen goes to the tabs, never back into the form that was
 * just sent. A plain `replace` only swaps the last screen and leaves the wizard underneath (bug 2026-11-07).
 */
export function leaveFlow(path: string): void {
  try {
    if (router.canDismiss()) router.dismissAll();
    if (path === '/') router.navigate('/' as never);
    else router.push(path as never);
  } catch (e) {
    reportError(e, { where: 'leaveFlow', path });
  }
}

/**
 * Go to a screen that may already be open further back (Jobbdag ⇄ chat): return to it instead of stacking
 * another copy on top, so «Tilbake» never walks through the same two screens again and again.
 */
export function safeNavigate(path: string): void {
  try {
    router.navigate(path as never);
  } catch (e) {
    reportError(e, { where: 'safeNavigate', path });
  }
}
