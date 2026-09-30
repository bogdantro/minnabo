import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ConsentScreen } from '@/screens/Onboarding/ConsentScreen';
import { SetupScreen } from '@/screens/Onboarding/SetupScreen';
import { LoginScreen } from '@/screens/Onboarding/LoginScreen';
import { supabase } from '@/lib/supabase';
import nb from '@/i18n/nb';
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

test('consent screen blocks until the required boxes are checked, then records consent', async () => {
  await renderWithProviders(<ConsentScreen />);
  expect(screen.getByText('3 påkrevde samtykker gjenstår')).toBeTruthy();
  await fireEvent.press(screen.getByText('Fortsett til oppsett'));
  expect(supabase.from).not.toHaveBeenCalledWith('consent_records');

  await fireEvent.press(screen.getByLabelText('Jeg godtar vilkårene for MinNabo'));
  await fireEvent.press(screen.getByLabelText('Jeg har lest personvernerklæringen'));
  await fireEvent.press(screen.getByLabelText('Alderen min er bekreftet (18 år eller eldre)'));
  expect(screen.getByText('Alt klart – du kan gå videre')).toBeTruthy();
  await fireEvent.press(screen.getByText('Fortsett til oppsett'));
  await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('consent_records'));
});

test('"Godta alle" checks every consent including the optional one', async () => {
  await renderWithProviders(<ConsentScreen />);
  await fireEvent.press(screen.getByText('Godta alle'));
  expect(screen.getByText('3 av 3 påkrevde')).toBeTruthy();
  expect(screen.getByText('Fjern alle')).toBeTruthy();
});

test('setup writes the profile and marks onboarding complete', async () => {
  await renderWithProviders(<SetupScreen />);
  await fireEvent.changeText(screen.getByLabelText('Visningsnavn'), 'Ola Nordmann');
  await fireEvent.changeText(screen.getByLabelText('Kommune'), 'Hamar');
  await fireEvent.changeText(screen.getByLabelText('Sted'), 'Hamar sentrum');
  await fireEvent.press(screen.getByText('Fullfør'));
  await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('profiles'));
});

test('"Bruk posisjonen min" fills the kommune field', async () => {
  await renderWithProviders(<SetupScreen />);
  await fireEvent.press(screen.getByText(nb.home.useMyLocation));
  await waitFor(() =>
    expect(screen.getByLabelText(nb.onboarding.municipalityLabel).props.value).toBe('Lillehammer'),
  );
  expect(screen.getByLabelText(nb.onboarding.placeLabel).props.value).toBe('Lillehammer');
});
