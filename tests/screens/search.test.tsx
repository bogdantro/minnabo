import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { SearchScreen } from '@/screens/SearchScreen';
import { renderWithProviders } from '../testUtils';

const PH = 'Søk etter plen, flytting, datahjelp …';

test('shows an empty state for a query with no matches', async () => {
  await renderWithProviders(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText(PH), 'xyzzy');
  await waitFor(() => expect(screen.getByText('Ingen treff på «xyzzy»')).toBeTruthy());
  expect(screen.getByText('Legg ut et oppdrag')).toBeTruthy();
});

test('typing a query shows matching oppdrag only (no service offers)', async () => {
  await renderWithProviders(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText(PH), 'plen');
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  expect(screen.queryByText('Jeg kan klippe plenen din')).toBeNull();
});

test('results are scoped to the user kommune (Lillehammer)', async () => {
  await renderWithProviders(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText(PH), 'vaskehjelp');
  // "Vaskehjelp før visning" is in Øyer – outside the kommune
  await waitFor(() => expect(screen.getByText(/Ingen treff på/)).toBeTruthy());
});

test('an initialCategory pre-filters and shows as an active filter chip', async () => {
  await renderWithProviders(<SearchScreen initialCategory="hage" />);
  expect(screen.getByLabelText('Fjern filter Hage')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  expect(screen.queryByText('Hjelp med flytting')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Fjern filter Hage'));
  await waitFor(() => expect(screen.getByText('Hjelp med flytting')).toBeTruthy());
});

test('recent and popular searches show when the field is empty', async () => {
  await renderWithProviders(<SearchScreen />);
  expect(await screen.findByText('Populært i Lillehammer')).toBeTruthy();
  await fireEvent.press(screen.getByText('Plen'));
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
});
