import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { OppdragScreen } from '@/screens/OppdragScreen';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  jest.clearAllMocks();
});

test('shows the greeting, header, location row, search and category chips', async () => {
  await renderWithProviders(<OppdragScreen />);
  expect(screen.getByText('Finn hjelp eller en småjobb nær deg')).toBeTruthy();
  expect(screen.getByLabelText('Åpne profil')).toBeTruthy();
  expect(screen.getByText('Søk etter plen, flytting, datahjelp …')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Alle' })).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Lillehammer kommune')).toBeTruthy());
});

test('lists open oppdrag (no service offers) as listing cards', async () => {
  await renderWithProviders(<OppdragScreen />);
  expect(screen.getByText('Folk som trenger hjelp')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  // Product rule 1: there is no "Folk som tilbyr hjelp" section.
  expect(screen.queryByText('Jeg kan klippe plenen din')).toBeNull();
  expect(screen.queryByText('Folk som tilbyr hjelp')).toBeNull();
  const hearts = screen.getAllByLabelText('Lagre');
  expect(hearts.length).toBeGreaterThan(0);
  expect(hearts.length).toBeLessThanOrEqual(6);
});

test('category chips filter the list in place', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Transport/levering' }));
  await waitFor(() => expect(screen.queryByText('Klippe plen')).toBeNull());
  expect(screen.getByText('Hjelp med flytting')).toBeTruthy();
  expect(router.push).not.toHaveBeenCalled();
});

test('"Se alle oppdrag" goes to the full list', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  await fireEvent.press(screen.getByText('Se alle oppdrag'));
  expect(router.push).toHaveBeenCalledWith('/oppdrag-liste');
});

test('the search bar opens Søk and the lead card opens Oppdrag for meg', async () => {
  await renderWithProviders(<OppdragScreen />);
  await fireEvent.press(screen.getByLabelText('Søk etter oppdrag'));
  expect(router.push).toHaveBeenCalledWith('/sok');
  await fireEvent.press(screen.getByText('Oppdrag for meg'));
  expect(router.push).toHaveBeenCalledWith('/oppdrag-for-meg');
});

test('the payment note is shown', async () => {
  await renderWithProviders(<OppdragScreen />);
  expect(
    screen.getByText('MinNabo håndterer ikke betaling. Pris og betaling avtales direkte mellom dere.'),
  ).toBeTruthy();
});
