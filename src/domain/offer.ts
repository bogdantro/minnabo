import type { Listing } from './types';

/**
 * «Tilbyr hjelp» posts (SERVICE_OFFER, 0076): how their days and price read on cards and pages.
 * Weekday indices follow JavaScript: 0 = søndag … 6 = lørdag.
 */
export const WEEKDAYS: { i: number; short: string; long: string }[] = [
  { i: 1, short: 'Man', long: 'mandag' },
  { i: 2, short: 'Tir', long: 'tirsdag' },
  { i: 3, short: 'Ons', long: 'onsdag' },
  { i: 4, short: 'Tor', long: 'torsdag' },
  { i: 5, short: 'Fre', long: 'fredag' },
  { i: 6, short: 'Lør', long: 'lørdag' },
  { i: 0, short: 'Søn', long: 'søndag' },
];

const WORK = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

/** [1,2,3,4,5] -> 'Hverdager', [0,6] -> 'Helg', all -> 'Alle dager', [1,3] -> 'Man, ons'. */
export function weekdaysLabel(days: number[] | undefined): string | null {
  const d = [...new Set(days ?? [])];
  if (!d.length) return null;
  if (d.length === 7) return 'Alle dager';
  if (same(d, WORK)) return 'Hverdager';
  if (same(d, WEEKEND)) return 'Helg';
  const names = WEEKDAYS.filter((w) => d.includes(w.i)).map((w, k) => (k === 0 ? w.short : w.short.toLowerCase()));
  return names.join(', ');
}

/** "Ledig hverdager" / "Ledig lør, søn" / the helper's own text – the line under an offer card. */
export function offerAvailability(l: Pick<Listing, 'offer'>): string | undefined {
  const days = weekdaysLabel(l.offer?.availableWeekdays);
  const own = l.offer?.availabilityText?.trim();
  if (days && own) return `Ledig ${days.toLowerCase()} · ${own}`;
  if (days) return `Ledig ${days.toLowerCase()}`;
  return own || undefined;
}

/** Is the helper usually free on this date? (the owner sees "Ledig lørdag") */
export const freeOn = (l: Pick<Listing, 'offer'>, d: Date) => !!l.offer?.availableWeekdays?.includes(d.getDay());

export const isOffer = (l: Pick<Listing, 'type'>) => l.type === 'SERVICE_OFFER';

/** Total months → how it reads: 0 → null, 8 → '8 mnd', 12 → '1 år', 18 → '1 år og 6 mnd'. */
export function experienceText(totalMonths: number | undefined): string | null {
  const m = Math.max(0, Math.round(totalMonths ?? 0));
  if (!m) return null;
  const y = Math.floor(m / 12);
  const rest = m % 12;
  if (!y) return `${rest} mnd`;
  return rest ? `${y} år og ${rest} mnd` : `${y} år`;
}
