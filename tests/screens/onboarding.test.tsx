import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ConsentScreen } from '@/screens/Onboarding/ConsentScreen';
import { SetupScreen } from '@/screens/Onboarding/SetupScreen';
import { LoginScreen } from '@/screens/Onboarding/LoginScreen';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { apiClient } from '@/api/client';
import { YouthAccountScreen } from '@/screens/Onboarding/YouthAccountScreen';
import nb from '@/i18n/nb';
import { renderWithProviders } from '../testUtils';

const YOUTH = { vipps: true, youth: true, age: 16, birthYear: 2010, fullName: 'Emil Nygård', phoneMasked: '+47 ••• •• 518' };

beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => jest.restoreAllMocks());

test('login is Vipps only: no other way in, and without a Vipps client it says so', async () => {
  const err = jest.spyOn(toast, 'error');
  await renderWithProviders(<LoginScreen />);
  expect(screen.getByText('Logg inn eller opprett konto')).toBeTruthy();
  expect(screen.getAllByText('Vipps brukes kun til innlogging – aldri til betaling.').length).toBeGreaterThan(0);
  expect(screen.queryByText(/uten Vipps/)).toBeNull();

  await fireEvent.press(screen.getByText('Fortsett med Vipps'));
  await waitFor(() => expect(err).toHaveBeenCalledWith('Vipps-innlogging er ikke satt opp ennå.'));
  expect(supabase.auth.signInAnonymously).not.toHaveBeenCalled();
});

test('Ungdomskonto unlocks only after all three boxes are ticked', async () => {
  jest.spyOn(apiClient, 'getMyAccount').mockResolvedValue(YOUTH);
  await renderWithProviders(<YouthAccountScreen />);
  expect(await screen.findByText('Hei, Emil!')).toBeTruthy();
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

// The app stores' reviewer cannot use Vipps: a hidden login behind a long hold on the logo.
describe('reviewer login', () => {
  const invoke = supabase.functions.invoke as jest.Mock;
  const auth = supabase.auth as unknown as { verifyOtp: jest.Mock };

  beforeEach(() => {
    auth.verifyOtp = jest.fn().mockResolvedValue({ error: null });
  });
  afterEach(() => invoke.mockResolvedValue({ data: null, error: null }));

  test('nothing shows until the logo is held, then the demo account is let in', async () => {
    invoke.mockResolvedValue({ data: { tokenHash: 'hash-1', isNew: true, youth: false }, error: null });
    await renderWithProviders(<LoginScreen />);
    expect(screen.queryByText('Testinnlogging')).toBeNull();
    expect(screen.queryByLabelText('Passord')).toBeNull();

    await fireEvent(screen.getByLabelText('MinNabo'), 'longPress');
    expect(await screen.findByText('Testinnlogging')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Brukernavn'), 'apple');
    await fireEvent.changeText(screen.getByLabelText('Passord'), 'riktig-passord');
    await fireEvent.press(screen.getByText('Logg inn'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/samtykker'));
    expect(invoke).toHaveBeenCalledWith('reviewer-login', { body: { username: 'apple', password: 'riktig-passord' } });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash-1', type: 'magiclink' });
  });

  test('a wrong password, or the login switched off on the server, shows the answer and lets nobody in', async () => {
    invoke.mockResolvedValue({ data: { error: 'Feil brukernavn eller passord.' }, error: null });
    await renderWithProviders(<LoginScreen />);
    await fireEvent(screen.getByLabelText('MinNabo'), 'longPress');
    await fireEvent.changeText(await screen.findByLabelText('Brukernavn'), 'apple');
    await fireEvent.changeText(screen.getByLabelText('Passord'), 'feil');
    await fireEvent.press(screen.getByText('Logg inn'));

    expect(await screen.findByText('Feil brukernavn eller passord.')).toBeTruthy();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

test('the reviewer login also opens from the big logo on the first screen', async () => {
  const { WelcomeScreen } = require('@/screens/Onboarding/WelcomeScreen');
  await renderWithProviders(<WelcomeScreen />);
  // the logo sits in the decorative collage (hidden from screen readers); in the app the sheet
  // opens in its own layer, in tests it renders inline – so include hidden elements here
  const all = { includeHiddenElements: true };
  expect(screen.queryByText('Testinnlogging', all)).toBeNull();
  await fireEvent(screen.getByTestId('welcome-logo', all), 'longPress');
  expect(await screen.findByText('Testinnlogging', all)).toBeTruthy();
  expect(screen.getByLabelText('Brukernavn', all)).toBeTruthy();
});

test('the reviewer login also opens from the small logo at the top of the first screen', async () => {
  const { WelcomeScreen } = require('@/screens/Onboarding/WelcomeScreen');
  await renderWithProviders(<WelcomeScreen />);
  await fireEvent(screen.getByTestId('welcome-brand'), 'longPress');
  expect(await screen.findByText('Testinnlogging', { includeHiddenElements: true })).toBeTruthy();
});
