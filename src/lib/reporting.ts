import { toast } from './toast';
import nb from '@/i18n/nb';

/**
 * Central error + analytics sink. Wire Sentry (or similar) here — this is the
 * one place the whole app reports through. For now it logs in dev and shows a
 * confirmation toast on a manual report.
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.error('[reportError]', error, context);
  }
  if (context.manual) {
    toast.success(nb.errorBoundary.reported);
  }
  // TODO(backend): Sentry.captureException(error, { extra: context });
}

/** Lightweight analytics event. Point this at PostHog / Amplitude / Supabase. */
export function track(event: string, props: Record<string, unknown> = {}) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[track]', event, props);
  }
  // TODO(backend): analytics.capture(event, props);
}
