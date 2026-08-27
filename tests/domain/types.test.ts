import type { Listing, ListingType } from '@/domain/types';

test('listing type union is explicit', () => {
  const t: ListingType[] = ['TASK_REQUEST', 'SERVICE_OFFER'];
  expect(t).toHaveLength(2);
});

test('a task listing shape compiles', () => {
  const l: Listing = {
    id: '1',
    type: 'TASK_REQUEST',
    title: 'Klippe plen',
    category: { id: 'c1', slug: 'hage', label: 'Hage', icon: 'feather' },
    price: { amountMinor: 60000, currency: 'NOK' },
    priceMode: 'FIXED',
    location: { municipality: 'Lillehammer', place: 'Lillehammer', distanceKm: 1.2 },
    images: [],
    owner: {
      id: 'u1',
      displayName: 'Jonas Berg',
      initials: 'JB',
      memberSince: '2026',
      location: { municipality: 'Lillehammer', place: 'Lillehammer' },
      verifications: [],
      isBusiness: false,
    },
    createdAt: '2026-08-01T10:00:00Z',
    status: 'PUBLISHED',
    task: { description: 'Test' },
  };
  expect(l.type).toBe('TASK_REQUEST');
});
