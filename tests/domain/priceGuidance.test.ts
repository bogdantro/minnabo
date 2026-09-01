import { priceGuidanceForCategory } from '@/domain/priceGuidance';
import { nok } from '@/domain/price';
import type { Listing } from '@/domain/types';

const listing = (slug: string, kr: number): Listing =>
  ({
    id: `l-${slug}-${kr}`,
    type: 'TASK_REQUEST',
    title: 't',
    category: { slug, label: slug, icon: 'home' },
    price: nok(kr),
    priceMode: 'FIXED',
    location: { municipality: 'x', place: 'x' },
    images: [],
    owner: {} as Listing['owner'],
  }) as unknown as Listing;

test('returns null below three comparable listings', () => {
  expect(priceGuidanceForCategory([listing('hage', 500), listing('hage', 700)], 'hage')).toBeNull();
});

test('derives a low/typical/high band from category prices', () => {
  const listings = [300, 500, 800, 1000, 1500].map((kr) => listing('hage', kr));
  const g = priceGuidanceForCategory(listings, 'hage')!;
  expect(g.sampleSize).toBe(5);
  expect(g.low).toBeLessThanOrEqual(g.typical);
  expect(g.typical).toBeLessThanOrEqual(g.high);
});
