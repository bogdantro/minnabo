/**
 * Utlån (0101, 0104): categories, dates and the days a thing is taken. Pure, so it can be tested.
 * Dates are 'YYYY-MM-DD' in the phone's own time zone, like the database's `date` columns.
 */
import type { CategoryId } from '@/theme/theme';
import type { LendBusy, LendCategory } from './types';

export const LEND_CATEGORIES: LendCategory[] = ['VERKTOY', 'HAGE', 'FRITID', 'KJOKKEN', 'TRANSPORT', 'ANNET'];

/** Each kind of thing wears the colours and icon of the matching oppdrag category (CategoryArt). */
export const LEND_ART: Record<LendCategory, CategoryId> = {
  VERKTOY: 'montering',
  HAGE: 'hage',
  FRITID: 'sykkel',
  KJOKKEN: 'matlaging',
  TRANSPORT: 'transport',
  ANNET: 'annet',
};

/** A loan can be asked for up to this many days ahead and this long (request_lend in 0101 says the same). */
export const LEND_MAX_DAYS = 30;
const DAY = 86_400_000;

export function dayOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** '2026-11-14' -> a Date at noon that day (noon, so a summer-time change never moves it a day). */
export function dateOf(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(day: string, n: number): string {
  return dayOf(new Date(dateOf(day).getTime() + n * DAY));
}

/** Both ends counted: 14th to 16th = 3 days. */
export function loanDays(from: string, to: string): number {
  return Math.round((dateOf(to).getTime() - dateOf(from).getTime()) / DAY) + 1;
}

/** The first busy stretch that overlaps from–to, or null when the days are free. */
export function clash(busy: LendBusy[], from: string, to: string): LendBusy | null {
  return busy.find((b) => !(to < b.fromDate || from > b.toDate)) ?? null;
}

export function isBusy(busy: LendBusy[], day: string): boolean {
  return busy.some((b) => day >= b.fromDate && day <= b.toDate);
}

export type QuickPick = 'today' | 'tomorrow' | 'weekend';

/** «I dag», «I morgen» or «Helgen» (Saturday–Sunday; on a Sunday, just today). */
export function quickRange(pick: QuickPick, today: Date): { from: string; to: string } {
  const t = dayOf(today);
  if (pick === 'today') return { from: t, to: t };
  if (pick === 'tomorrow') return { from: addDays(t, 1), to: addDays(t, 1) };
  const dow = today.getDay(); // 0 = Sunday
  if (dow === 0) return { from: t, to: t };
  const sat = addDays(t, 6 - dow);
  return { from: sat, to: addDays(sat, 1) };
}

/** The next `n` days from today, each marked free or taken – the strip on a thing's page. */
export function dayStrip(busy: LendBusy[], today: Date, n = 14): { day: string; busy: boolean }[] {
  const t = dayOf(today);
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(t, i);
    return { day, busy: isBusy(busy, day) };
  });
}

/** Lent out right now? */
export function busyToday(busy: LendBusy[], today: Date): LendBusy | null {
  const t = dayOf(today);
  return busy.find((b) => t >= b.fromDate && t <= b.toDate) ?? null;
}
