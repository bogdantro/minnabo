import type { Listing } from './types';

/**
 * Hasteoppdrag: an oppdrag marked «Det haster» is shown first in the feed until its
 * deadline (end of the chosen day). Mirrors the rules in 0071_urgent_oppdrag.sql:
 * the deadline is at most a few days away, and each nabo has one hasteoppdrag at a time,
 * so «først i lista» stays worth something.
 */
export type Urgency = 'today' | 'tomorrow' | 'days3';

/** Days from today to the last day of each choice ("Innen 3 dager" = today + 3). */
export const URGENCY_DAYS: Record<Urgency, number> = { today: 0, tomorrow: 1, days3: 3 };
export const URGENCIES: Urgency[] = ['today', 'tomorrow', 'days3'];

/** End of the chosen day, local time: 'today' on Fri 30 Oct -> Fri 30 Oct 23:59:59.999. */
export function urgentDeadline(urgency: Urgency, from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + URGENCY_DAYS[urgency]);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Still haste: the deadline is in the future. */
export const isUrgent = (l: Pick<Listing, 'urgentUntil'>, now = Date.now()) =>
  !!l.urgentUntil && Date.parse(l.urgentUntil) > now;

/** Haste first (soonest deadline on top), everything else keeps its order. */
export function urgentFirst<T extends Pick<Listing, 'urgentUntil'>>(items: T[], now = Date.now()): T[] {
  const urgent = items.filter((l) => isUrgent(l, now));
  if (!urgent.length) return items;
  urgent.sort((a, b) => Date.parse(a.urgentUntil!) - Date.parse(b.urgentUntil!));
  return [...urgent, ...items.filter((l) => !isUrgent(l, now))];
}

/** "i dag" / "i morgen" / "fre 2. nov" – how the deadline reads after «Haster · innen». */
export function urgentDayLabel(until: string, now = new Date()): string {
  const d = new Date(until);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86400000);
  if (diff <= 0) return 'i dag';
  if (diff === 1) return 'i morgen';
  const wd = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'][d.getDay()];
  const mo = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'][d.getMonth()];
  return `${wd} ${d.getDate()}. ${mo}`;
}
