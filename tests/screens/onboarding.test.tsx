import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ConsentScreen } from '@/screens/Onboarding/ConsentScreen';
import { SetupScreen } from '@/screens/Onboarding/SetupScreen';
import { LoginScreen } from '@/screens/Onboarding/LoginScreen';
import { authStore } from '@/data/authStore';
import { renderWithProviders } from '../testUtils';

test('login accepts the demo one-time code', async () => {
  await renderWithProviders(<LoginScreen />);
  await fireEvent.changeText(
    screen.getByLabelText('Telefonnummer eller e-post'),
    'ola@example.com',
  );
  await fireEvent.press(screen.getByText('Send kode'));
  await waitFor(() => expect(screen.getByLabelText('Engangskode')).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('Engangskode'), '0000');
  await fireEvent.press(screen.getByText('Bekreft'));
  await waitFor(() => expect(authStore.get().contact).toBe('ola@example.com'));
});

test('consent screen blocks until all boxes are checked', async () => {
  await renderWithProviders(<ConsentScreen />);
  await fireEvent.press(screen.getByText('Fortsett'));
  await waitFor(() => expect(screen.getByText(/må godta alle/)).toBeTruthy());

  await fireEvent.press(screen.getByLabelText('Jeg godtar vilkårene'));
  await fireEvent.press(screen.getByLabelText('Jeg har lest personvernerklæringen'));
  await fireEvent.press(
    screen.getByLabelText('Jeg er over aldersgrensen (eller har samtykke fra foresatte)'),
  );
  await fireEvent.press(screen.getByText('Fortsett'));
  await waitFor(() => expect(authStore.get().consents.terms).toBe(true));
});

test('setup completes onboarding once municipality and place are set', async () => {
  authStore.signOut();
  await renderWithProviders(<SetupScreen />);
  await fireEvent.changeText(screen.getByLabelText('Kommune'), 'Hamar');
  await fireEvent.changeText(screen.getByLabelText('Sted'), 'Hamar sentrum');
  await fireEvent.press(screen.getByText('Fullfør'));
  await waitFor(() => expect(authStore.get().isOnboarded).toBe(true));
  expect(authStore.get().municipality).toBe('Hamar');
});
