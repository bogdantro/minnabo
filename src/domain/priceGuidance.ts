import type { Listing } from './types';

export type PriceGuidance = {
  low: number;
  typical: number;
  high: number;
  sampleSize: number;
};

/**
 * A rough price range for a category, derived from the prices already on
 * listings in it. Returns null until there are enough data points to be
 * meaningful. Amounts are in kroner (not minor units).
 */
export function priceGuidanceForCategory(
  listings: Listing[],
  categorySlug: string,
): PriceGuidance | null {
  const kr = listings
    .filter((l) => l.category.slug === categorySlug && l.price && l.price.amountMinor > 0)
    .map((l) => Math.round(l.price!.amountMinor / 100))
    .sort((a, b) => a - b);

  if (kr.length < 3) return null;

  const at = (p: number) => kr[Math.min(kr.length - 1, Math.floor(p * kr.length))];
  return { low: at(0.2), typical: at(0.5), high: at(0.8), sampleSize: kr.length };
}
