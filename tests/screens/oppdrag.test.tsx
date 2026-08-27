import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { OppdragScreen } from '@/screens/OppdragScreen';
import { renderWithProviders } from '../testUtils';

test('shows the question, profile shortcut and both listing sections', async () => {
  await renderWithProviders(<OppdragScreen />);
  expect(screen.getByText('Hva trenger du hjelp med?')).toBeTruthy();
  expect(screen.getByLabelText('Åpne profil')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  expect(screen.getByText('Folk som trenger hjelp')).toBeTruthy();
  expect(screen.getByText('Folk som tilbyr hjelp')).toBeTruthy();
});

test('the need-help section shows requests and the offer section shows offers', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  // a service offer also renders, in its own section
  expect(screen.getByText('Jeg kan klippe plenen din')).toBeTruthy();
});

test('filtering by Hage keeps only hage listings across both sections', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Hage' }));
  await waitFor(() => expect(screen.queryByText('Hjelp med flytting')).toBeNull());
  expect(screen.getByText('Klippe plen')).toBeTruthy();
  expect(screen.getByText('Jeg kan klippe plenen din')).toBeTruthy();
});
