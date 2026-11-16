import type { AgreementSnapshot } from './types';

/** «Fast avtale» (0101): every 1, 2 or 4 weeks from the first time. */
export const REPEAT_CHOICES = [7, 14, 28] as const;
export type RepeatEvery = (typeof REPEAT_CHOICES)[number];

const DAY = 86_400_000;
// a visit can be marked as done from 12 hours before it (same as mark_agreement_visit)
const MARK_EARLY = 12 * 60 * 60 * 1000;

type Repeatable = Pick<AgreementSnapshot, 'scheduledAt' | 'repeatEveryDays' | 'repeatUntil' | 'repeatEndedAt' | 'cancelledAt'>;

/** On, not ended and not cancelled. */
export function isRepeating(a: Repeatable | null | undefined): boolean {
  return !!a?.repeatEveryDays && !!a.scheduledAt && !a.repeatEndedAt && !a.cancelledAt;
}

/** '2026-11-30' for a date in the phone's own time zone. */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The next visit at or after `now`; null when it isn't repeating or the season is over.
 * Same rule as next_agreement_visit() in 0101.
 */
export function nextVisit(a: Repeatable | null | undefined, now = Date.now()): Date | null {
  if (!isRepeating(a) || !a?.scheduledAt || !a.repeatEveryDays) return null;
  const first = Date.parse(a.scheduledAt);
  const step = a.repeatEveryDays * DAY;
  const v = new Date(first + step * Math.max(0, Math.ceil((now - first) / step)));
  if (a.repeatUntil && localDay(v) > a.repeatUntil) return null;
  return v;
}

/** The latest visit that can be marked as done now (it has been, or starts within 12 hours). */
export function currentVisit(a: Repeatable | null | undefined, now = Date.now()): Date | null {
  if (!a?.repeatEveryDays || !a.scheduledAt || a.cancelledAt) return null;
  const first = Date.parse(a.scheduledAt);
  const step = a.repeatEveryDays * DAY;
  const n = Math.floor((now + MARK_EARLY - first) / step);
  if (n < 0) return null;
  const v = new Date(first + n * step);
  if (a.repeatUntil && localDay(v) > a.repeatUntil) return null;
  return v;
}

/** The last day of this month and the next ones, for «Til og med» choices: ['2026-11-30', '2026-12-31', …]. */
export function monthEnds(count: number, now = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => localDay(new Date(now.getFullYear(), now.getMonth() + i + 1, 0)));
}
