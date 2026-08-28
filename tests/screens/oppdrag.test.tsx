import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { OppdragScreen } from '@/screens/OppdragScreen';
import { renderWithProviders } from '../testUtils';

const seen = (text: string | RegExp) =>
  waitFor(() => expect(screen.getByText(text)).toBeTruthy(), { timeout: 6000 });

test('shows the heading, profile shortcut and both sections', async () => {
  await renderWithProviders(<OppdragScreen />);
  expect(screen.getByText('Finn hjelp eller en småjobb nær deg')).toBeTruthy();
  expect(screen.getByLabelText('Åpne profil')).toBeTruthy();
  await seen('Klippe plen');
  expect(screen.getByText('Folk som tilbyr hjelp')).toBeTruthy();
  expect(screen.getByText('Folk som trenger hjelp')).toBeTruthy();
});

test('the offer section shows providers and the task section shows requests', async () => {
  await renderWithProviders(<OppdragScreen />);
  await seen('Klippe plen');
  expect(screen.getByText('Jeg kan klippe plenen din')).toBeTruthy();
});

test('filtering by Hage keeps only hage listings across both sections', async () => {
  await renderWithProviders(<OppdragScreen />);
  await seen('Klippe plen');
  await fireEvent.press(screen.getByRole('button', { name: 'Hage' }));
  await waitFor(() => expect(screen.queryByText('Hjelp med flytting')).toBeNull(), { timeout: 6000 });
  expect(screen.getByText('Klippe plen')).toBeTruthy();
});
