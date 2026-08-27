import { apiClient } from '@/api/client';

test('search by text returns matching titles of both types, never inferring type', async () => {
  const res = await apiClient.listListings({ filter: { query: 'plen' } });
  const titles = res.map((l) => l.title);
  expect(titles).toEqual(
    expect.arrayContaining(['Klippe plen', 'Jeg kan klippe plenen din']),
  );
  expect(new Set(res.map((l) => l.type)).size).toBe(2);
});

test('category filter "alle" does not filter', async () => {
  const all = await apiClient.listListings({ filter: { categorySlug: 'alle' } });
  const none = await apiClient.listListings({});
  expect(all.length).toBe(none.length);
});

test('price sort puts cheapest first, undefined last', async () => {
  const res = await apiClient.listListings({ sort: 'PRICE' });
  const prices = res.map((l) => l.price?.amountMinor ?? Number.POSITIVE_INFINITY);
  expect(prices).toEqual([...prices].sort((a, b) => a - b));
});

test('getListing throws bokmål error when missing', async () => {
  await expect(apiClient.getListing('nope')).rejects.toThrow('Fant ikke oppføringen.');
});

test('getListing returns the seeded listing', async () => {
  const l = await apiClient.getListing('l-klippe-plen');
  expect(l.title).toBe('Klippe plen');
});
