/**
 * Towns inside a kommune (asked 2026-11-12): someone in Moelv sees «Moelv · Ringsaker», not «Ringsaker kommune».
 * What is shown stays the same – the kommune (and its group) – but the town is named, and its oppdrag come first.
 */
import { WHOLE_KOMMUNE } from '@/data/kommuner';
import { isUrgent } from '@/domain/urgent';
import type { Listing } from '@/domain/types';

const same = (a: string, b: string) => a.trim().toLocaleLowerCase('nb-NO') === b.trim().toLocaleLowerCase('nb-NO');

/** ('Moelv', 'Ringsaker') -> 'Moelv'; the kommune itself, «Hele kommunen» or nothing -> undefined. */
export function townOf(place: string | null | undefined, kommune: string | null | undefined): string | undefined {
  const p = place?.trim();
  if (!p || p === WHOLE_KOMMUNE || (kommune && same(p, kommune))) return undefined;
  return p;
}

/** 'Moelv · Ringsaker', or 'Ringsaker kommune' when there is no town. */
export function townLabel(place: string | null | undefined, kommune: string): string {
  const town = townOf(place, kommune);
  return town ? `${town} · ${kommune}` : `${kommune} kommune`;
}

/**
 * Hasteoppdrag stay on top whatever their place; then the ones in my town; then the rest.
 * Within each group the order is kept (newest first from the server).
 */
export function nearFirst<T extends Pick<Listing, 'location' | 'urgentUntil'>>(list: T[], town: string | undefined, now = Date.now()): T[] {
  if (!town) return list;
  const rank = (l: T) => (isUrgent(l, now) ? 0 : l.location.place && same(l.location.place, town) ? 1 : 2);
  return list
    .map((l, i) => ({ l, i, r: rank(l) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.l);
}
