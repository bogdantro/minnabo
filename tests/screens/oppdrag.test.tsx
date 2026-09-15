import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { OppdragScreen } from '@/screens/OppdragScreen';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  jest.clearAllMocks();
});

test('shows the hero, location, search and category row', async () => {
  await renderWithProviders(<OppdragScreen />);
  expect(screen.getByText('Trenger du en hånd?')).toBeTruthy();
  expect(screen.getByText('Finn en tjeneste')).toBeTruthy();
  expect(screen.getByLabelText('Åpne profil')).toBeTruthy();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Alle' })).toBeTruthy());
  await waitFor(() => expect(screen.getByLabelText(/Lillehammer/)).toBeTruthy());
});

test('shows the newest open tasks as full-width photo cards, capped at 8', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByText('Jobber nær deg')).toBeTruthy());
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());

  // Only task requests ("trenger hjelp") belong in this feed, not offers.
  expect(screen.queryByText('Jeg kan klippe plenen din')).toBeNull();

  const badges = screen.getAllByText('Trenger hjelp');
  expect(badges.length).toBeGreaterThan(0);
  expect(badges.length).toBeLessThanOrEqual(8);
});

test('a "Se alle" button below the feed goes to the full task list', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  await fireEvent.press(screen.getByText('Se alle'));
  expect(router.push).toHaveBeenCalledWith('/oppdrag-liste');
});

test('the community teaser links to Fellesskap', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByText('Naboer som hjelper naboer')).toBeTruthy());
  expect(
    screen.getByRole('button', { name: /Naboer som hjelper naboer/ }),
  ).toBeTruthy();
});

test('picking a category sends the user to search, pre-filtered', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Hage' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Hage' }));
  expect(router.push).toHaveBeenCalledWith('/sok?category=hage');
});

test('picking "Alle" sends the user to unfiltered search', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Alle' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Alle' }));
  expect(router.push).toHaveBeenCalledWith('/sok');
});
