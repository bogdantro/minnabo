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
