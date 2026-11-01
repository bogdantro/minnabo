import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppLockGate } from '@/components/AppLockGate';
import { SikkerhetScreen } from '@/screens/SikkerhetScreen';
import { appLock, unlock } from '@/lib/appLock';
import { renderWithProviders } from '../testUtils';

const auth = LocalAuthentication.authenticateAsync as jest.Mock;
const enrolled = LocalAuthentication.isEnrolledAsync as jest.Mock;

beforeEach(async () => {
  appLock._reset();
  await appLock.setEnabled(false);
  appLock._reset();
  auth.mockResolvedValue({ success: true });
  enrolled.mockResolvedValue(true);
});

test('off by default: no lock screen', async () => {
  await renderWithProviders(<AppLockGate />);
  await waitFor(() => expect(screen.queryByTestId('app-lock')).toBeNull());
});

test('on: locked at start until Face ID says it is the owner', async () => {
  await appLock.setEnabled(true);
  appLock._reset();
  auth.mockResolvedValueOnce({ success: false });
  await renderWithProviders(<AppLockGate />);
  expect(await screen.findByText('MinNabo er låst')).toBeTruthy();
  // cancelled the first time – «Lås opp» asks again
  await fireEvent.press(screen.getByRole('button', { name: 'Lås opp' }));
  await waitFor(() => expect(screen.queryByTestId('app-lock')).toBeNull());
});

test('Face ID removed from the phone: the lock lets the owner in', async () => {
  enrolled.mockResolvedValue(false);
  await expect(unlock()).resolves.toBe(true);
});

test('turning the lock on in Sikkerhet needs one Face ID first', async () => {
  auth.mockResolvedValueOnce({ success: false });
  await renderWithProviders(<SikkerhetScreen />);
  const toggle = await screen.findByLabelText('Lås appen med Face ID eller fingeravtrykk');
  await fireEvent(toggle, 'valueChange', true);
  await waitFor(() => expect(auth).toHaveBeenCalled());
  expect(appLock.isEnabled()).toBe(false);

  await fireEvent(toggle, 'valueChange', true);
  await waitFor(() => expect(appLock.isEnabled()).toBe(true));
});
