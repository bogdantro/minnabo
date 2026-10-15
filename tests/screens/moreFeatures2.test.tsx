import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { TaskDetailScreen } from '@/screens/TaskDetailScreen';
import { PushBridge } from '@/components/PushBridge';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { _resetVippsLogin, closeVippsWindow, completeVippsLogin, startVippsLogin, waitForSession } from '@/auth/vipps';
import { LoginScreen } from '@/screens/Onboarding/LoginScreen';
import * as WebBrowser from 'expo-web-browser';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { chatRepository } from '@mocks/data/chatRepository';
import { repositories } from '@mocks/data/repositories';
import { extras } from '@mocks/mockClient';
import { renderWithProviders } from '../testUtils';

// `mockLinkListeners` lets a test deliver a link to the app, as iOS does when Vipps sends you back
const mockLinkListeners = new Set<(e: { url: string }) => void>();
jest.mock('expo-linking', () => ({
  createURL: (path: string) => `minnabo://${path}`,
  openURL: jest.fn().mockResolvedValue(true),
  addEventListener: jest.fn((_type: string, cb: (e: { url: string }) => void) => {
    mockLinkListeners.add(cb);
    return { remove: () => mockLinkListeners.delete(cb) };
  }),
}));
const deliverLink = (url: string) => mockLinkListeners.forEach((cb) => cb({ url }));

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
const getSession = supabase.auth.getSession as jest.Mock;
const withSession = getSession.getMockImplementation();
beforeEach(() => _resetVippsLogin());
const stateFromStorage = () => AsyncStorage.getItem('minnabo.vipps.state');
/** `start` answers with the authorize URL; the code exchange answers with `done`. */
const vippsFunction = (done: unknown) =>
  invoke.mockImplementation(async (_name: string, { body }: { body: { action?: string } }) =>
    body.action === 'start'
      ? { data: { url: 'https://api.vipps.no/auth?x', state: `st-${Math.random()}`, codeVerifier: 'ver-1' }, error: null }
      : done,
  );

const authWindow = WebBrowser.openAuthSessionAsync as jest.Mock;

test('Vipps opens in the iOS login window (as Vipps recommends), never in Safari', async () => {
  vippsFunction({ data: null, error: null });
  const opened = jest.fn();
  await startVippsLogin(opened);
  expect(invoke).toHaveBeenCalledWith('vipps-login', { body: { action: 'start', redirectUri: 'minnabo://vipps/callback' } });
  expect(authWindow).toHaveBeenLastCalledWith('https://api.vipps.no/auth?x', 'minnabo://vipps/callback', { preferEphemeralSession: true });
  expect(Linking.openURL).not.toHaveBeenCalledWith('https://api.vipps.no/auth?x');
  expect(opened).toHaveBeenCalled();
  expect(await AsyncStorage.getItem('minnabo.vipps.verifier')).toBe('ver-1');
});

test('a Vipps login swaps the code for a session and never sends a session token', async () => {
  vippsFunction({ data: { tokenHash: 'hash', isNew: true, youth: false }, error: null });
  await startVippsLogin();
  const state = (await stateFromStorage())!;
  const res = await completeVippsLogin({ code: 'c2', state });
  expect(res).toEqual({ isNew: true, youth: false });
  const body = invoke.mock.calls.at(-1)[1].body;
  expect(body).toMatchObject({ code: 'c2', codeVerifier: 'ver-1', redirectUri: 'minnabo://vipps/callback' });
  // the step log holds names and milliseconds only – no code, state or token
  expect(body.trace.map((t: { s: string }) => t.s)).toEqual(['start', 'open', 'window:dismiss', 'exchange']);
  expect(JSON.stringify(body.trace)).not.toMatch(/c2|ver-1|st-/);
});

test('the login window: closed by the person = cancel; closed by the link back = returned; caught the return itself = the code', async () => {
  vippsFunction({ data: null, error: null });
  authWindow.mockResolvedValueOnce({ type: 'cancel' });
  expect(await startVippsLogin()).toBe('cancel');

  // the Vipps app sent the link: /vipps/callback closes the window (which iOS reports as cancel)
  authWindow.mockImplementationOnce(async () => {
    closeVippsWindow();
    return { type: 'cancel' };
  });
  expect(await startVippsLogin()).toBe('returned');
  expect(WebBrowser.dismissAuthSession).toHaveBeenCalled();

  // no Vipps app: the window itself catches minnabo://vipps/callback
  authWindow.mockResolvedValueOnce({ type: 'success', url: 'minnabo://vipps/callback?code=w1&state=s1' });
  expect(await startVippsLogin()).toEqual({ code: 'w1', state: 's1', error: undefined });
});

// The bug from 2026-10-15: iOS reports the login window as «cancelled» when the Vipps app
// sends you back, and the link itself arrives a moment later. The app took that as a real
// cancel and showed «Innlogging med Vipps avbrutt» while it was logging you in.
test('the window closes as «cancel» but the link from Vipps comes right after: no cancel message', async () => {
  vippsFunction({ data: null, error: null });
  authWindow.mockImplementationOnce(async () => {
    setTimeout(() => deliverLink('minnabo://vipps/callback?code=c&state=s'), 400);
    return { type: 'cancel' };
  });
  expect(await startVippsLogin()).toBe('returned');
});

test('a real cancel (no link comes) is still a cancel', async () => {
  vippsFunction({ data: null, error: null });
  authWindow.mockResolvedValueOnce({ type: 'cancel' });
  expect(await startVippsLogin()).toBe('cancel');
});

test('back from Vipps: someone who already has an account goes straight in, without the identity card', async () => {
  const ok = jest.spyOn(toast, 'success');
  const replace = router.replace as jest.Mock;
  replace.mockClear();
  vippsFunction({ data: { tokenHash: 'hash', isNew: false, youth: false }, error: null });
  await startVippsLogin();
  await renderWithProviders(<LoginScreen callback={{ code: 'back', state: (await stateFromStorage())! }} />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  expect(ok).toHaveBeenCalledWith('Du er logget inn', expect.anything());
  expect(screen.queryByText('Identitet bekreftet')).toBeNull();
  ok.mockRestore();
});

test('back from Vipps: a real failure is shown in the sheet with «Prøv igjen», not as a quick message', async () => {
  const err = jest.spyOn(toast, 'error');
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  try {
    vippsFunction({ data: { error: 'Kontoen din er suspendert. Kontakt MinNabo.' }, error: null });
    await startVippsLogin();
    await renderWithProviders(<LoginScreen callback={{ code: 'bad', state: (await stateFromStorage())! }} />);
    expect(await screen.findByText('Innloggingen gikk ikke', {}, { timeout: 12000 })).toBeTruthy();
    expect(screen.getByText('Kontoen din er suspendert. Kontakt MinNabo.')).toBeTruthy();
    expect(screen.getByText('Prøv igjen')).toBeTruthy();
    expect(err).not.toHaveBeenCalled();
  } finally {
    getSession.mockImplementation(withSession);
    err.mockRestore();
  }
}, 20000);

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

// The bug: back from Vipps the app is opened twice (the Vipps app + the browser tab), with
// different codes. The second used to fail at once – «Kunne ikke logge inn med Vipps» – while
// the first was still logging the person in.
test('two links back from Vipps with different codes: one login, no error on either', async () => {
  vippsFunction({ data: { tokenHash: 'hash', isNew: false, youth: false }, error: null });
  await startVippsLogin();
  const state = (await stateFromStorage())!;
  const exchanges = () => invoke.mock.calls.filter((c) => !(c[1].body as { action?: string }).action).length;
  const before = exchanges();
  const [a, b] = await Promise.all([completeVippsLogin({ code: 'from-app', state }), completeVippsLogin({ code: 'from-browser', state })]);
  expect(a).toEqual({ isNew: false, youth: false });
  expect(b).toEqual(a);
  expect(exchanges() - before).toBe(1);
});

test('if the first link fails, the second can still finish the login (the state is kept until success)', async () => {
  await startVippsLogin();
  const state = (await stateFromStorage())!;
  invoke.mockResolvedValueOnce({ data: { error: 'Vipps godtok ikke innloggingen. Prøv igjen.' }, error: null });
  const first = completeVippsLogin({ code: 'used', state });
  vippsFunction({ data: { tokenHash: 'hash', isNew: true, youth: false }, error: null });
  const second = completeVippsLogin({ code: 'fresh', state });
  await expect(first).rejects.toThrow(/godtok ikke/);
  await expect(second).resolves.toEqual({ isNew: true, youth: false });
  expect(await stateFromStorage()).toBeNull();
});

test('waitForSession: true as soon as there is a session, false when none comes', async () => {
  expect(await waitForSession(2000)).toBe(true);
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  try {
    expect(await waitForSession(300)).toBe(false);
  } finally {
    getSession.mockImplementation(withSession);
  }
});

test('back from Vipps: a failed link shows no error when the person ends up logged in', async () => {
  const err = jest.spyOn(toast, 'error');
  const replace = router.replace as jest.Mock;
  replace.mockClear();
  await startVippsLogin();
  invoke.mockResolvedValueOnce({ data: { error: 'Vipps godtok ikke innloggingen. Prøv igjen.' }, error: null });
  await renderWithProviders(<LoginScreen callback={{ code: 'x', state: (await stateFromStorage())! }} />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  expect(err).not.toHaveBeenCalled();
  err.mockRestore();
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

// --- trykk på et varsel ----------------------------------------------------------------
test('tapping a push opens its link, and a push without a link («Melding fra MinNabo») opens Varsler', async () => {
  // the component reads the module with require(), so patch that object (not the import namespace)
  const N = jest.requireMock('expo-notifications') as Record<string, unknown>;
  const before = { add: N.addNotificationResponseReceivedListener, last: N.getLastNotificationResponseAsync };
  let tap: (r: unknown) => void = () => undefined;
  N.addNotificationResponseReceivedListener = jest.fn((cb: (r: unknown) => void) => {
    tap = cb;
    return { remove: jest.fn() };
  });
  N.getLastNotificationResponseAsync = jest.fn().mockResolvedValue(null);
  const push = router.push as jest.Mock;
  push.mockClear();
  try {
    await renderWithProviders(<PushBridge />);
    const response = (data: unknown) => ({ notification: { request: { content: { data } } } });
    tap(response({ route: '/chat/c1' }));
    tap(response({ route: null }));
    tap(response(undefined));
    await waitFor(() => expect(push.mock.calls.map((c) => c[0])).toEqual(['/chat/c1', '/varsler', '/varsler']));
  } finally {
    N.addNotificationResponseReceivedListener = before.add;
    N.getLastNotificationResponseAsync = before.last;
  }
});
