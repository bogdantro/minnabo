import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { OppdragScreen } from '@/screens/OppdragScreen';
import { renderWithProviders } from '../testUtils';

test('shows the question, profile shortcut, categories and listings', async () => {
  await renderWithProviders(<OppdragScreen />);
  expect(screen.getByText('Hva trenger du hjelp med?')).toBeTruthy();
  expect(screen.getByLabelText('Åpne profil')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  expect(screen.getByText('Jobber nær deg')).toBeTruthy();
});

test('filtering by Hage removes non-hage listings', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Hage' }));
  await waitFor(() => {
    expect(screen.queryByText('Hjelp med flytting')).toBeNull();
    expect(screen.getByText('Klippe plen')).toBeTruthy();
  });
});
