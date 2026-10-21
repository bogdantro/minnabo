import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ConsentScreen } from '@/screens/Onboarding/ConsentScreen';
import { SetupScreen } from '@/screens/Onboarding/SetupScreen';
import { LoginScreen } from '@/screens/Onboarding/LoginScreen';
import { router } from 'expo-router';
import * as Location from 'expo-location';
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

/** Steps 1–2 of Oppsett with a typed name (an account without a Vipps name), up to «Hvor bor du?». */
async function toPlaceStep() {
  await renderWithProviders(<SetupScreen />);
  await fireEvent.changeText(screen.getByLabelText('Visningsnavn'), 'Ola Nordmann');
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(screen.getByText('Begge deler'));
  await fireEvent.press(screen.getByText('Neste'));
}

/** What Oppsett wrote to `profiles` (the upsert's first argument). */
function savedProfile(): Record<string, unknown> | undefined {
  const from = supabase.from as jest.Mock;
  const i = from.mock.calls.findIndex(([table]) => table === 'profiles');
  return i < 0 ? undefined : from.mock.results[i].value.upsert.mock.calls[0]?.[0];
}

test('setup walks navn → bruk → sted and writes the profile', async () => {
  await toPlaceStep();
  await fireEvent.press(screen.getByText(nb.setup.locIdle));
  await screen.findAllByText('Fant deg: Lillehammer kommune');
  await fireEvent.press(screen.getByText('Fullfør'));
  await waitFor(() => expect(screen.getByText('Velkommen til nabolaget, Ola!')).toBeTruthy());
  expect(savedProfile()).toMatchObject({ display_name: 'Ola Nordmann', municipality: 'Lillehammer' });
});

test('"Bruk posisjonen min" picks the kommune and keeps the kommune list out of the way', async () => {
  await toPlaceStep();
  await fireEvent.press(screen.getByText(nb.setup.locIdle));
  await waitFor(() => expect(screen.getAllByText('Fant deg: Lillehammer kommune').length).toBeGreaterThan(0));
  expect(screen.queryByText('Hamar')).toBeNull();
});

test('the place step asks which kommune you are in – no Område, that comes later with Nabolag', async () => {
  await toPlaceStep();
  expect(screen.getByText('Hvilken kommune er du i?')).toBeTruthy();
  expect(screen.queryByText('Hvor bor du?')).toBeNull();
  await fireEvent.press(screen.getByText(nb.setup.locIdle));
  await screen.findAllByText('Fant deg: Lillehammer kommune');
  expect(screen.queryByLabelText('Område')).toBeNull();
  await fireEvent.press(screen.getByText('Fullfør'));
  await waitFor(() => expect(savedProfile()).toMatchObject({ municipality: 'Lillehammer', place: 'Lillehammer' }));
});

test('the place step asks for the position first – the kommune list only shows when that fails', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({ granted: false } as never);
  await toPlaceStep();
  expect(screen.queryByText('Hamar')).toBeNull();
  expect(screen.queryByLabelText(nb.setup.searchKommune)).toBeNull();

  await fireEvent.press(screen.getByText(nb.setup.locIdle));
  expect(await screen.findByText(nb.location.permissionDenied)).toBeTruthy();
  await fireEvent.press(screen.getByText('Hamar'));
  await fireEvent.press(screen.getByText('Fullfør'));
  await waitFor(() => expect(screen.getByText('Velkommen til nabolaget, Ola!')).toBeTruthy());
  expect(savedProfile()).toMatchObject({ municipality: 'Hamar' });
});

test('a found kommune can still be changed through «Ikke riktig? Velg selv»', async () => {
  await toPlaceStep();
  await fireEvent.press(screen.getByText(nb.setup.locIdle));
  await screen.findAllByText('Fant deg: Lillehammer kommune');
  await fireEvent.press(screen.getByText(nb.setup.pickOther));
  await fireEvent.press(screen.getByText('Hamar'));
  await fireEvent.press(screen.getByText('Fullfør'));
  await waitFor(() => expect(screen.getByText('Velkommen til nabolaget, Ola!')).toBeTruthy());
  expect(savedProfile()).toMatchObject({ municipality: 'Hamar' });
});

test('with a Vipps name the visningsnavn can only be that name or its short forms – no free text', async () => {
  jest.spyOn(apiClient, 'getMyAccount').mockResolvedValue({ ...YOUTH, youth: false, age: 34, fullName: 'Ola Nordmann' });
  await renderWithProviders(<SetupScreen />);
  expect(await screen.findByRole('radio', { name: 'Ola N.' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Ola Nordmann' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Ola' })).toBeTruthy();
  expect(screen.queryByPlaceholderText(nb.setup.namePlaceholder)).toBeNull();

  await fireEvent.press(screen.getByRole('radio', { name: 'Ola N.' }));
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(screen.getByText('Begge deler'));
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(screen.getByText(nb.setup.locIdle));
  await screen.findAllByText('Fant deg: Lillehammer kommune');
  await fireEvent.press(screen.getByText('Fullfør'));
  await waitFor(() => expect(savedProfile()).toMatchObject({ display_name: 'Ola N.' }));
});

test('there is no hidden test login: holding the logo does nothing, Vipps is the only way in', async () => {
  await renderWithProviders(<LoginScreen />);
  await fireEvent(screen.getByLabelText('MinNabo'), 'longPress');
  expect(screen.queryByText('Testinnlogging')).toBeNull();
  expect(screen.queryByLabelText('Passord')).toBeNull();
  expect(supabase.functions.invoke).not.toHaveBeenCalledWith('reviewer-login', expect.anything());
});
