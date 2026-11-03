import { screen, waitFor } from '@testing-library/react-native';
import { FellesskapScreen } from '@/screens/FellesskapScreen';
import { partners } from '@mocks/data/seedCommunity';
import { renderWithProviders } from '../testUtils';

const LOGO = 'https://example.com/logo.png';
const saved = partners.map((p) => ({ ...p }));

beforeAll(() => {
  // a støttespiller in Lillehammer with a logo and a long name, one for «Hele Innlandet» (no kommune) and a lokal helt
  partners.push(
    { id: 'p-sup-lh', name: 'Lillehammer Byggevare og Interiør AS', tagline: 'Byggevarer', url: null, logoUrl: LOGO, municipality: 'Lillehammer', featured: false },
    { id: 'p-sup-all', name: 'Håndverker Innlandet', tagline: 'Håndverkere i hele Innlandet', url: null, logoUrl: null, municipality: null, featured: false },
    { id: 'p-hero-all', name: 'Innlandet Hjelpelag', tagline: 'Hjelper overalt', url: null, logoUrl: null, municipality: null, featured: false, localHero: true },
  );
});
afterAll(() => {
  partners.splice(0, partners.length, ...saved);
});

test('støttespillere show their logo and full name, without a city tag', async () => {
  await renderWithProviders(<FellesskapScreen />);
  const name = await screen.findByText('Lillehammer Byggevare og Interiør AS');
  expect(name.props.numberOfLines).toBe(2);
  // the logo is the partner's own image, not the placeholder icon
  expect(screen.getByTestId('supporter-logo-p-sup-lh')).toBeTruthy();
  expect(screen.queryByText('Lillehammer', { exact: true })).toBeNull();
});

test('«Hele Innlandet» (no kommune) shows in every kommune – lokale helter and støttespillere alike', async () => {
  await renderWithProviders(<FellesskapScreen />);
  expect(await screen.findByText('Håndverker Innlandet')).toBeTruthy();
  expect(await screen.findByText('Innlandet Hjelpelag')).toBeTruthy();
});

test('lokale helter have no «Lokal helt» tag', async () => {
  await renderWithProviders(<FellesskapScreen />);
  await screen.findByText('Innlandet Hjelpelag');
  await waitFor(() => expect(screen.queryByText('Lokal helt')).toBeNull());
});
