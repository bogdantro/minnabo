import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ConsentScreen } from '@/screens/Onboarding/ConsentScreen';
import { SetupScreen } from '@/screens/Onboarding/SetupScreen';
import { LoginScreen } from '@/screens/Onboarding/LoginScreen';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { MOCK_YOUTH, mockVipps } from '@/auth/mockVipps';
import { YouthAccountScreen } from '@/screens/Onboarding/YouthAccountScreen';
import nb from '@/i18n/nb';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  jest.clearAllMocks();
  mockVipps.signOut();
});

test('Vipps login: sheet goes Åpner → Bekreft → Identitet bekreftet, then on to Samtykke', async () => {
  await renderWithProviders(<LoginScreen />);
  expect(screen.getByText('Logg inn eller opprett konto')).toBeTruthy();
  expect(screen.getAllByText('Vipps brukes kun til innlogging – aldri til betaling.').length).toBeGreaterThan(0);

  await fireEvent.press(screen.getByText('Fortsett med Vipps'));
  expect(screen.getByText('Åpner Vipps …')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Bekreft i Vipps-appen')).toBeTruthy(), { timeout: 4000 });
  await waitFor(() => expect(screen.getByText('Identitet bekreftet')).toBeTruthy(), { timeout: 4000 });
  expect(screen.getByText('Mari Haugen · født 1991')).toBeTruthy();

  await fireEvent.press(screen.getByText('Fortsett'));
  expect(router.replace).toHaveBeenCalledWith('/samtykker');
  expect(mockVipps.get()?.youth).toBe(false);
});

test('Vipps login: under 18 goes to Ungdomskonto', async () => {
  await renderWithProviders(<LoginScreen />);
  await fireEvent.press(screen.getByText('Fortsett med Vipps'));
  await waitFor(() => expect(screen.getByText('Identitet bekreftet')).toBeTruthy(), { timeout: 6000 });
  await fireEvent.press(screen.getByText('Under 18 år? Se ungdomskonto'));
  expect(router.replace).toHaveBeenCalledWith('/ungdomskonto');
  expect(mockVipps.get()?.youth).toBe(true);
});

test('Ungdomskonto unlocks only after all three boxes are ticked', async () => {
  mockVipps.signIn(MOCK_YOUTH);
  await renderWithProviders(<YouthAccountScreen />);
  expect(screen.getByText('Hei, Emil!')).toBeTruthy();
  await fireEvent.press(screen.getByText('Opprett ungdomskonto'));
  expect(router.replace).not.toHaveBeenCalledWith('/ung');
  for (const l of nb.youth.checks) await fireEvent.press(screen.getByLabelText(l));
  await fireEvent.press(screen.getByText('Opprett ungdomskonto'));
  expect(router.replace).toHaveBeenCalledWith('/ung');
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

test('setup validates each step before moving on', async () => {
  await renderWithProviders(<SetupScreen />);
  await fireEvent.changeText(screen.getByLabelText('Visningsnavn'), 'O');
  await fireEvent.press(screen.getByText('Neste'));
  expect(screen.getByText('Visningsnavnet må ha minst 2 tegn')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Visningsnavn'), 'Ola Nordmann');
  await fireEvent.press(screen.getByText('Neste'));
  expect(screen.getByText('Steg 2 av 3')).toBeTruthy();
  await fireEvent.press(screen.getByText('Neste'));
  expect(screen.getByText('Velg ett alternativ for å gå videre')).toBeTruthy();
});

test('setup walks navn → bruk → sted and writes the profile', async () => {
  await renderWithProviders(<SetupScreen />);
  await fireEvent.changeText(screen.getByLabelText('Visningsnavn'), 'Ola Nordmann');
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(screen.getByText('Jeg trenger hjelp'));
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(screen.getByText('Hamar'));
  await fireEvent.press(screen.getByText('Fullfør'));
  await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('profiles'));
  await waitFor(() => expect(screen.getByText('Velkommen til nabolaget, Ola!')).toBeTruthy());
});

test('"Bruk posisjonen min" picks the kommune', async () => {
  await renderWithProviders(<SetupScreen />);
  await fireEvent.changeText(screen.getByLabelText('Visningsnavn'), 'Ola Nordmann');
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(screen.getByText('Begge deler'));
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(screen.getByText(nb.setup.locIdle));
  await waitFor(() => expect(screen.getAllByText('Fant deg: Lillehammer kommune').length).toBeGreaterThan(0));
  expect(screen.getByText('Din posisjon')).toBeTruthy();
});
