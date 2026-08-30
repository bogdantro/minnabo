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

test('the type toggle narrows results to offers', async () => {
  await renderWithProviders(<SearchScreen initialQuery="plen" />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());

  await fireEvent.press(screen.getByRole('button', { name: 'Tilbyr hjelp' }));

  await waitFor(() => {
    expect(screen.getByText('Jeg kan klippe plenen din')).toBeTruthy();
    expect(screen.queryByText('Klippe plen')).toBeNull();
  });
});
