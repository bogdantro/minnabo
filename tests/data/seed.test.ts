import { listings, categories, homeCategories } from '@/data/seed';

test('seed contains both listing types', () => {
  expect(listings.some((l) => l.type === 'TASK_REQUEST')).toBe(true);
  expect(listings.some((l) => l.type === 'SERVICE_OFFER')).toBe(true);
});

test('Klippe plen matches the mockup', () => {
  const l = listings.find((x) => x.title === 'Klippe plen')!;
  expect(l.type).toBe('TASK_REQUEST');
  expect(l.priceMode).toBe('FIXED');
  expect(l.price).toEqual({ amountMinor: 60000, currency: 'NOK' });
  expect(l.category.label).toBe('Hage');
  expect(l.images.length).toBe(3);
  expect(l.owner.displayName).toBe('Jonas Berg');
  expect(l.task?.meetingNote).toMatch(/Adresse deles/);
});

test('home shows exactly 5 category chips starting with Alle', () => {
  expect(homeCategories[0].slug).toBe('alle');
  expect(homeCategories).toHaveLength(5);
});

test('every category has a bokmål label', () => {
  expect(categories.every((c) => c.label.length > 0)).toBe(true);
});
