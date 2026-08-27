import { router } from 'expo-router';

/**
 * Push a route, swallowing "route does not exist yet" errors so screens
 * built in an earlier slice can link to routes that arrive in a later one.
 */
export function safePush(path: string): void {
  try {
    // expo-router's typed routes are strict; this helper is intentionally loose.
    router.push(path as never);
  } catch {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(`[nav] route not available yet: ${path}`);
    }
  }
}
