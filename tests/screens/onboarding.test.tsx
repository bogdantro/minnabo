import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ConsentScreen } from '@/screens/Onboarding/ConsentScreen';
import { SetupScreen } from '@/screens/Onboarding/SetupScreen';
import { LoginScreen } from '@/screens/Onboarding/LoginScreen';
import { supabase } from '@/lib/supabase';
import { renderWithProviders } from '../testUtils';

test('login sends an email OTP then verifies the 6-digit code', async () => {
  await renderWithProviders(<LoginScreen />);

  await fireEvent.changeText(screen.getByLabelText('E-postadresse'), 'ola@example.com');
  await fireEvent.press(screen.getByText('Send kode'));
  await waitFor(() =>
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ola@example.com' }),
    ),
  );

  await waitFor(() => expect(screen.getByLabelText('Engangskode')).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('Engangskode'), '123456');
  await fireEvent.press(screen.getByText('Bekreft'));
  await waitFor(() =>
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ola@example.com', token: '123456', type: 'email' }),
    ),
  );
});

test('login rejects an invalid email before sending', async () => {
  await renderWithProviders(<LoginScreen />);
  await fireEvent.changeText(screen.getByLabelText('E-postadresse'), 'not-an-email');
  await fireEvent.press(screen.getByText('Send kode'));
  await waitFor(() => expect(screen.getByText(/gyldig e-postadresse/i)).toBeTruthy());
  expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
});

test('consent screen blocks until all boxes are checked, then records consent', async () => {
  await renderWithProviders(<ConsentScreen />);
  await fireEvent.press(screen.getByText('Fortsett'));
  await waitFor(() => expect(screen.getByText(/må godta alle/)).toBeTruthy());

  await fireEvent.press(screen.getByLabelText('Jeg godtar vilkårene'));
  await fireEvent.press(screen.getByLabelText('Jeg har lest personvernerklæringen'));
  await fireEvent.press(
    screen.getByLabelText('Jeg er over aldersgrensen (eller har samtykke fra foresatte)'),
  );
  await fireEvent.press(screen.getByText('Fortsett'));
  await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('consent_records'));
});

test('setup writes the profile and marks onboarding complete', async () => {
  await renderWithProviders(<SetupScreen />);
  await fireEvent.changeText(screen.getByLabelText('Visningsnavn'), 'Ola Nordmann');
  await fireEvent.changeText(screen.getByLabelText('Kommune'), 'Hamar');
  await fireEvent.changeText(screen.getByLabelText('Sted'), 'Hamar sentrum');
  await fireEvent.press(screen.getByText('Fullfør'));
  await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('profiles'));
});
