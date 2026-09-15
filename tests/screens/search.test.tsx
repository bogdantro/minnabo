import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { SearchScreen } from '@/screens/SearchScreen';
import { renderWithProviders } from '../testUtils';

test('shows an empty state for a query with no matches', async () => {
  await renderWithProviders(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Søk etter småjobber'), 'xyzzy');
  await waitFor(() => expect(screen.getByText(/Fant ingen treff/)).toBeTruthy());
});

test('typing a query shows matches of both listing types', async () => {
  await renderWithProviders(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Søk etter småjobber'), 'plen');
  await waitFor(() => {
    expect(screen.getByText('Klippe plen')).toBeTruthy();
    expect(screen.getByText('Jeg kan klippe plenen din')).toBeTruthy();
  });
});

test('results are scoped to the user kommune (Lillehammer)', async () => {
  await renderWithProviders(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Søk etter småjobber'), 'rengjøring');
  // "Fast eller enkeltvis rengjøring" is a Ringsaker offer — out of kommune
  await waitFor(() => expect(screen.getByText(/Fant ingen treff/)).toBeTruthy());
  expect(screen.queryByText('Fast eller enkeltvis rengjøring')).toBeNull();
});

test('an initialCategory (from a homepage category tap) pre-filters straight to results', async () => {
  await renderWithProviders(<SearchScreen initialCategory="hage" />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Hage' })).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Hage' }).props.accessibilityState.selected).toBe(true);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  expect(screen.queryByText('Hjelp med flytting')).toBeNull();
});

test('the type toggle narrows results to offers', async () => {
  await renderWithProviders(<SearchScreen initialQuery="plen" />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());

  await fireEvent.press(screen.getByRole('button', { name: 'Tilbyr hjelp' }));

  await waitFor(() => {
    expect(screen.getByText('Jeg kan klippe plenen din')).toBeTruthy();
    expect(screen.queryByText('Klippe plen')).toBeNull();
  });
});
