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

test('job-type filter separates offers from requests', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());

  await fireEvent.press(screen.getByText('Folk som tilbyr hjelp'));
  await waitFor(() => {
    expect(screen.getByText('Jeg kan klippe plenen din')).toBeTruthy();
    expect(screen.queryByText('Klippe plen')).toBeNull();
  });

  await fireEvent.press(screen.getByText('Oppdrag å ta'));
  await waitFor(() => {
    expect(screen.getByText('Klippe plen')).toBeTruthy();
    expect(screen.queryByText('Jeg kan klippe plenen din')).toBeNull();
  });
});
