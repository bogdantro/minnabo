import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { MenySheet } from '@/components/MenySheet';
import { renderWithProviders } from '../testUtils';

test('lists app pages with names when open', async () => {
  await renderWithProviders(<MenySheet visible onClose={() => {}} />);
  expect(screen.getByText('Min profil')).toBeTruthy();
  expect(screen.getByText('Mine oppdrag og tjenester')).toBeTruthy();
  expect(screen.getByText('Lagrede oppføringer og søk')).toBeTruthy();
  expect(screen.getByText('Personvern')).toBeTruthy();
});

test('tapping an item navigates and closes', async () => {
  (router.push as jest.Mock).mockClear();
  const onClose = jest.fn();
  await renderWithProviders(<MenySheet visible onClose={onClose} />);
  fireEvent.press(screen.getByText('Min profil'));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/profil'));
  expect(onClose).toHaveBeenCalled();
});
