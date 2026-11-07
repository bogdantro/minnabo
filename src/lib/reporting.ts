import { toast } from './toast';
import nb from '@/i18n/nb';

type Sentry = typeof import('@sentry/react-native');
let sentry: Sentry | null = null;

/**
 * Crash reports go to Sentry when EXPO_PUBLIC_SENTRY_DSN is set; without it nothing is sent and the
 * app works as before. No names, no messages and no location: only the error and which app version.
 */
export async function startCrashReporting(): Promise<void> {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || __DEV__ || sentry) return;
  try {
    const S = await import('@sentry/react-native');
    S.init({
      dsn,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      // the text of an error can quote what someone typed
      beforeBreadcrumb: (b) => (b.category === 'console' || b.category === 'ui.input' ? null : b),
    });
    sentry = S;
  } catch {
    /* a build without the module simply reports nothing */
  }
}

/**
 * Central error + analytics sink: the one place the whole app reports through. It logs in dev,
 * goes to Sentry in a release, and shows a confirmation toast on a manual report.
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (__DEV__) {
    console.error('[reportError]', error, context);
  }
  if (context.manual) {
    toast.success(nb.errorBoundary.reported);
  }
  sentry?.captureException(error, { extra: context });
}

/** Lightweight analytics event. Point this at PostHog / Amplitude / Supabase. */
export function track(event: string, props: Record<string, unknown> = {}) {
  if (__DEV__) {
    console.log('[track]', event, props);
  }
  // TODO(backend): analytics.capture(event, props);
}
