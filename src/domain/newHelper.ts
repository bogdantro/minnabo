import type { Listing, PublicProfile } from './types';

/** «Ny på MinNabo» for this long after joining, as long as there is no job or review yet. */
const NEW_FOR_MS = 60 * 24 * 60 * 60 * 1000;

/** No reviews says nothing bad about someone: this tells neighbours they are simply new. */
export function isNewHelper(p: Pick<PublicProfile, 'completedTasks' | 'rating' | 'memberSinceDate'>, now: Date): boolean {
  if ((p.completedTasks ?? 0) > 0 || (p.rating?.count ?? 0) > 0 || !p.memberSinceDate) return false;
  return now.getTime() - Date.parse(p.memberSinceDate) < NEW_FOR_MS;
}

/** Rate × length of the job in kroner, or null when it isn't an hourly price with a known length. */
export function hourlyEstimateKr(l: Pick<Listing, 'priceMode' | 'price' | 'estimatedMinutes'>): number | null {
  if (l.priceMode !== 'HOURLY' || !l.price || !l.estimatedMinutes) return null;
  return Math.round(((l.price.amountMinor / 100) * l.estimatedMinutes) / 60);
}

/** What a tilbud is compared with: the budget, or the hourly price over the whole job. */
export function budgetKr(l: Pick<Listing, 'priceMode' | 'price' | 'estimatedMinutes'>): number | null {
  if (!l.price || l.priceMode === 'BY_AGREEMENT') return null;
  return hourlyEstimateKr(l) ?? Math.round(l.price.amountMinor / 100);
}
