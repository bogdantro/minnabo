/** The oppdrag card (2026-11-13): who is asking comes first, and a real photo runs across the top. */
import { screen } from '@testing-library/react-native';
import { ListingCard } from '@/components/ui';
import { renderWithProviders } from '../testUtils';

const base = {
  title: 'Montere kjøkkenskap',
  category: 'montering' as const,
  priceLabel: 'Budsjett',
  priceValue: '2 200 kr',
  posted: '3 t siden',
  place: 'Lillehammer · 1,4 km',
};

/** The visible texts in reading order (the card's accessibility label lists the title first, so skip it). */
const order = (a: string, b: string) => {
  const texts = screen.getAllByText(/./).map((t) => ([] as unknown[]).concat(t.props.children).join(''));
  return texts.findIndex((t) => t.includes(a)) < texts.findIndex((t) => t.includes(b));
};

test('the person and when they posted come before the title', async () => {
  await renderWithProviders(<ListingCard {...base} ownerName="Jonas Berg" ownerRating={4.9} owner={{ id: 'u1', initials: 'JB' }} />);
  expect(screen.getByText('Jonas Berg')).toBeTruthy();
  expect(screen.getByText('3 t siden')).toBeTruthy();
  expect(order('Jonas Berg', 'Montere kjøkkenskap')).toBe(true);
  expect(order('3 t siden', 'Montere kjøkkenskap')).toBe(true);
});

test('without a person the age stays with the pills', async () => {
  await renderWithProviders(<ListingCard {...base} />);
  expect(screen.getByText('3 t siden')).toBeTruthy();
  expect(order('Trenger hjelp', '3 t siden')).toBe(true);
});

test('with a photo on top the pills sit on the photo, before the person; without a photo nothing changes', async () => {
  const photo = 'https://example.com/a.jpg';
  const { unmount } = await renderWithProviders(<ListingCard {...base} photoTop photoUri={photo} ownerName="Jonas Berg" urgent />);
  expect(screen.getByText('Haster')).toBeTruthy();
  expect(order('Trenger hjelp', 'Jonas Berg')).toBe(true);
  unmount();
  await renderWithProviders(<ListingCard {...base} photoTop ownerName="Jonas Berg" />);
  expect(order('Jonas Berg', 'Trenger hjelp')).toBe(true);
});
