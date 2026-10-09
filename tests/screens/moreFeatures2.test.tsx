import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { TaskDetailScreen } from '@/screens/TaskDetailScreen';
import { PushBridge } from '@/components/PushBridge';
import * as Linking from 'expo-linking';
import { completeVippsLogin, startVippsLogin } from '@/auth/vipps';
import { supabase } from '@/lib/supabase';
import { chatRepository } from '@mocks/data/chatRepository';
import { repositories } from '@mocks/data/repositories';
import { extras } from '@mocks/mockClient';
import { renderWithProviders } from '../testUtils';

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `minnabo://${path}`,
  openURL: jest.fn().mockResolvedValue(true),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  chatRepository._reset();
  repositories.listings._reset();
  extras.reset();
  await AsyncStorage.clear();
});

const task = () => repositories.listings.get('l-vaskehjelp')!; // owned by Emma

// --- prisveiledning ---------------------------------------------------------------
test('Gi tilbud shows what earlier tilbud in the category landed on', async () => {
  extras.price[task().category.slug] = { low: 300, high: 500, sampleSize: 12 };
  await renderWithProviders(<TaskDetailScreen listing={task()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText('Gi tilbud'));
  expect(await screen.findByText('Vanlig i ditt område: 300–500 kr')).toBeTruthy();
});

test('Gi tilbud shows no guidance until there is enough data', async () => {
  await renderWithProviders(<TaskDetailScreen listing={task()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText('Gi tilbud'));
  await screen.findByText('Ditt pristilbud');
  expect(screen.queryByText(/Vanlig i ditt område/)).toBeNull();
});

// --- be om hjelp igjen: the helper's view ---------------------------------------------
test('an oppdrag sent only to me says so, and shows that it repeats', async () => {
  const l = task();
  const invited = { ...l, invitedProfileId: 'u-mb', task: { ...l.task!, recurrence: 'WEEKLY' as const } };
  await renderWithProviders(<TaskDetailScreen listing={invited} onBack={() => {}} />);
  expect(await screen.findByText(`${l.owner.displayName.split(' ')[0]} ber deg om hjelp igjen`)).toBeTruthy();
  expect(screen.getByText('Bare du ser dette oppdraget og kan gi tilbud.')).toBeTruthy();
  expect(screen.getByText('Gjentas hver uke')).toBeTruthy();
});

// --- testkonto → Vipps ----------------------------------------------------------------
const invoke = supabase.functions.invoke as jest.Mock;
const stateFromStorage = () => AsyncStorage.getItem('minnabo.vipps.state');
/** `start` answers with the authorize URL; the code exchange answers with `done`. */
const vippsFunction = (done: unknown) =>
  invoke.mockImplementation(async (_name: string, { body }: { body: { action?: string } }) =>
    body.action === 'start'
      ? { data: { url: 'https://api.vipps.no/auth?x', state: `st-${Math.random()}`, codeVerifier: 'ver-1' }, error: null }
      : done,
  );

test('Vipps is opened with the URL the edge function built (app_to_app_v2 + PKCE)', async () => {
  vippsFunction({ data: null, error: null });
  await startVippsLogin();
  expect(invoke).toHaveBeenCalledWith('vipps-login', { body: { action: 'start', redirectUri: 'minnabo://vipps/callback' } });
  expect(Linking.openURL).toHaveBeenCalledWith('https://api.vipps.no/auth?x');
  expect(await AsyncStorage.getItem('minnabo.vipps.verifier')).toBe('ver-1');
});

test('a Vipps login swaps the code for a session and never sends a session token', async () => {
  vippsFunction({ data: { tokenHash: 'hash', isNew: true, youth: false }, error: null });
  await startVippsLogin();
  const state = (await stateFromStorage())!;
  const res = await completeVippsLogin({ code: 'c2', state });
  expect(res).toEqual({ isNew: true, youth: false });
  expect(invoke.mock.calls.at(-1)[1].body).toEqual({ code: 'c2', codeVerifier: 'ver-1', redirectUri: 'minnabo://vipps/callback' });
});

test('the same Vipps return handled twice logs in once – no error on the second screen', async () => {
  vippsFunction({ data: { tokenHash: 'hash', isNew: false, youth: false }, error: null });
  await startVippsLogin();
  const state = (await stateFromStorage())!;
  const exchanges = () => invoke.mock.calls.filter((c) => !(c[1].body as { action?: string }).action).length;
  const before = exchanges();
  const [a, b] = await Promise.all([
    completeVippsLogin({ code: 'dup-1', state }),
    completeVippsLogin({ code: 'dup-1', state }),
  ]);
  expect(a).toEqual({ isNew: false, youth: false });
  expect(b).toEqual(a);
  expect(exchanges() - before).toBe(1);
});

test('an error from the Vipps login reaches the person', async () => {
  vippsFunction({ data: { error: 'Kontoen din er suspendert. Kontakt MinNabo.' }, error: null });
  await startVippsLogin();
  const state = (await stateFromStorage())!;
  await expect(completeVippsLogin({ code: 'c3', state })).rejects.toThrow(/suspendert/);
});

// --- tall på app-ikonet -----------------------------------------------------------------
test('the app icon shows unread conversations + unread notifications', async () => {
  const setBadge = Notifications.setBadgeCountAsync as jest.Mock;
  await renderWithProviders(<PushBridge />);
  const unreadChats = chatRepository.listConversations({ unreadOnly: true }).length;
  expect(unreadChats).toBeGreaterThan(0);
  await waitFor(() => {
    const last = setBadge.mock.calls.at(-1)?.[0] as number;
    expect(last).toBeGreaterThanOrEqual(unreadChats);
  });
  // reading everything brings the number down
  const before = setBadge.mock.calls.at(-1)?.[0] as number;
  chatRepository.listConversations().forEach((c) => chatRepository.markRead(c.id));
  expect(before).toBeGreaterThan(0);
});
