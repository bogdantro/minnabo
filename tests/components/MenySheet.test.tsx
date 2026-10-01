import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { MenySheet } from '@/components/MenySheet';
import { signOut } from '@/auth/session';
import { renderWithProviders } from '../testUtils';

jest.mock('@/auth/session', () => ({
  ...jest.requireActual('@/auth/session'),
  signOut: jest.fn().mockResolvedValue(undefined),
}));

test('shows the user header, Utforsk tiles and the menu sections', async () => {
  await renderWithProviders(<MenySheet visible onClose={() => {}} />);
  expect(screen.getByText('Se profilen din')).toBeTruthy();
  for (const t of ['Oppdrag', 'Fellesskap', 'Innboks', 'Legg ut']) {
    expect(screen.getByText(t)).toBeTruthy();
  }
  expect(screen.getByText('Min profil')).toBeTruthy();
  expect(screen.getByText('Mine oppdrag')).toBeTruthy();
  expect(screen.getByText('Lagrede oppføringer og søk')).toBeTruthy();
  expect(screen.getByText('Personvern')).toBeTruthy();
  expect(screen.getByText('MinNabo håndterer ikke betaling.')).toBeTruthy();
});

test('tapping a row navigates and closes', async () => {
  (router.push as jest.Mock).mockClear();
  const onClose = jest.fn();
  await renderWithProviders(<MenySheet visible onClose={onClose} />);
  await fireEvent.press(screen.getByText('Min profil'));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/profil'));
  expect(onClose).toHaveBeenCalled();
});

test('"Legg ut" opens the wizard', async () => {
  (router.push as jest.Mock).mockClear();
  await renderWithProviders(<MenySheet visible onClose={() => {}} />);
  await fireEvent.press(screen.getByText('Legg ut'));
  expect(router.push).toHaveBeenCalledWith('/legg-ut');
});

test('Logg ut asks for confirmation, then signs out', async () => {
  await renderWithProviders(<MenySheet visible onClose={() => {}} />);
  await fireEvent.press(screen.getAllByText('Logg ut')[0]);
  expect(screen.getByText('Logg ut av MinNabo?')).toBeTruthy();
  const buttons = screen.getAllByText('Logg ut');
  await fireEvent.press(buttons[buttons.length - 1]);
  await waitFor(() => expect(signOut).toHaveBeenCalled());
  expect(router.replace).toHaveBeenCalledWith('/velkommen');
});
