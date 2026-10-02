import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SeeAllScreen } from '@/screens/SeeAllScreen';
import { renderWithProviders } from '../testUtils';

test('lists oppdrag only, with a count and the payment note', async () => {
  await renderWithProviders(<SeeAllScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  expect(screen.getByText('Hjelp med flytting')).toBeTruthy();
  expect(screen.queryByText('Jeg kan klippe plenen din')).toBeNull();
  expect(screen.getByText(/^\d+ oppdrag$/)).toBeTruthy();
  expect(screen.getByText(/MinNabo håndterer ikke betaling/)).toBeTruthy();
});

test('a category from the route pre-filters, and "Alle" clears it', async () => {
  await renderWithProviders(<SeeAllScreen initialCategory="hage" />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  expect(screen.queryByText('Hjelp med flytting')).toBeNull();
  expect(screen.getByText('Hage · sortert: nærmest')).toBeTruthy();
  await fireEvent.press(screen.getByText('Alle'));
  await waitFor(() => expect(screen.getByText('Hjelp med flytting')).toBeTruthy());
});

test('the sort menu changes the sort label', async () => {
  await renderWithProviders(<SeeAllScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  await fireEvent.press(screen.getByText('Nærmest'));
  expect(screen.getByText('Sorter etter')).toBeTruthy();
  await fireEvent.press(screen.getByText('Lavest pris'));
  expect(screen.queryByText('Sorter etter')).toBeNull();
  expect(screen.getByText('Alle kategorier · sortert: lavest pris')).toBeTruthy();
});
