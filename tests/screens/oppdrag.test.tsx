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
