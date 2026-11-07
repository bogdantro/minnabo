import type { Listing } from './types';
import { isUrgent } from './urgent';

/** «Når» in Søk. */
export type WhenFilter = 'TODAY' | 'WEEKEND' | 'NEXT_WEEK';
export const WHEN_FILTERS: WhenFilter[] = ['TODAY', 'WEEKEND', 'NEXT_WEEK'];

/** Which kinds of post a search shows. */
export type KindFilter = 'ALL' | 'TASK_REQUEST' | 'SERVICE_OFFER';

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (d: Date, n: number) => {
  const out = new Date(d);
  out.setDate(d.getDate() + n);
  return out;
};

/**
 * The calendar days a filter means, as of `now`.
 * Norwegian weeks start on Monday, so on a Sunday «I helgen» is today and «Neste uke» starts tomorrow.
 */
export function whenDays(when: WhenFilter, now: Date): Date[] {
  const day = now.getDay(); // 0 = søndag
  if (when === 'TODAY') return [now];
  if (when === 'WEEKEND') {
    if (day === 0) return [now];
    const saturday = addDays(now, 6 - day);
    return [saturday, addDays(saturday, 1)];
  }
  const monday = addDays(now, day === 0 ? 1 : 8 - day);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Does a post fit the filter? An oppdrag needs one of its real days in the window: an old oppdrag
 * with only a free-text time has none and doesn't match. A «Tilbyr hjelp» matches on its weekdays;
 * a helper who has named no days hasn't ruled any out.
 */
export function matchesWhen(l: Listing, when: WhenFilter, now: Date): boolean {
  const days = whenDays(when, now);
  if (l.type === 'SERVICE_OFFER') {
    const free = l.offer?.availableWeekdays;
    return !free?.length || days.some((d) => free.includes(d.getDay()));
  }
  const planned = l.task?.scheduledDays;
  if (!planned?.length) return false;
  const wanted = new Set(days.map(isoDay));
  return planned.some((d) => wanted.has(d));
}

/**
 * «Minst X kr». Only a stated price can pass: «Ønsker tilbud» says nothing about what it pays.
 * An hourly price is compared on the whole job when the length is known.
 */
export function meetsBudget(l: Listing, minKr: number): boolean {
  if (minKr <= 0) return true;
  if (!l.price) return false;
  const kr = l.price.amountMinor / 100;
  if (l.priceMode === 'HOURLY' && l.estimatedMinutes) return (kr * l.estimatedMinutes) / 60 >= minKr;
  return kr >= minKr;
}

export type ListingFilters = {
  kind?: KindFilter;
  when?: WhenFilter | null;
  minBudgetKr?: number;
  urgentOnly?: boolean;
};

export function matchesFilters(l: Listing, f: ListingFilters, now: Date): boolean {
  if (f.kind && f.kind !== 'ALL' && l.type !== f.kind) return false;
  if (f.when && !matchesWhen(l, f.when, now)) return false;
  if (f.minBudgetKr && !meetsBudget(l, f.minBudgetKr)) return false;
  if (f.urgentOnly && !isUrgent(l)) return false;
  return true;
}
