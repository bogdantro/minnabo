import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

/**
 * Real Vipps login (OIDC authorization-code flow). Vipps is used for login only.
 *
 *   startVippsLogin()      → the `vipps-login` edge function builds the authorize URL
 *                            (app_to_app_v2 + PKCE). It opens in Apple's login window
 *                            (ASWebAuthenticationSession), as Vipps recommends for apps –
 *                            not in Safari, which used to send a second link back.
 *                            The person approves in the Vipps app.
 *   <redirect>?code=…      → back in the app (route `/vipps/callback`), see vippsRedirectUri()
 *   completeVippsLogin()   → the `vipps-login` edge function swaps the code for a
 *                            one-time token, which becomes a Supabase session
 *
 * The client id is public; the client secret, the environment (test/production)
 * and the PKCE challenge are handled by the edge function.
 */
const CLIENT_ID = process.env.EXPO_PUBLIC_VIPPS_CLIENT_ID ?? '';
const STATE_KEY = 'minnabo.vipps.state';
const VERIFIER_KEY = 'minnabo.vipps.verifier';

/** False when the build has no EXPO_PUBLIC_VIPPS_CLIENT_ID (then login is unavailable). */
export const vippsConfigured = CLIENT_ID.length > 0;

/**
 * Where Vipps sends the person back. Must be registered in the Vipps portal and allowed in the
 * edge function (VIPPS_REDIRECT_URIS). Default `minnabo://vipps/callback`. Set
 * EXPO_PUBLIC_VIPPS_REDIRECT=https://minnaboapp.no/vipps/callback (a universal link, which Vipps
 * recommends) once the website serves apple-app-site-association – see docs/LEFT_OUT.md A31.
 */
export const vippsRedirectUri = () => process.env.EXPO_PUBLIC_VIPPS_REDIRECT || Linking.createURL('vipps/callback');

/** What the login window captures when the browser itself redirects (no Vipps app, or the
 *  website's /vipps/callback page forwarding). Always the app's own scheme. */
const sessionCallback = () => Linking.createURL('vipps/callback');

export type VippsLoginResult = { isNew: boolean; youth: boolean };
export type VippsCallback = { code?: string; state?: string; error?: string };

// --- steps, for finding problems later ------------------------------------------------
// Names and milliseconds only – never codes, names or numbers. Sent along with the code
// exchange, so they show up in the vipps-login function's log next to the server's side.
let t0 = 0;
/** set when the link back from Vipps closed the login window */
let returned = false;
let trace: { s: string; ms: number }[] = [];
export function traceStep(step: string): void {
  if (trace.length < 40) trace.push({ s: step.slice(0, 40), ms: t0 ? Date.now() - t0 : 0 });
}

/**
 * Send the person to Vipps in Apple's login window and wait.
 *  * 'returned'  – the Vipps app sent them back through the link; `/vipps/callback` finishes
 *  * 'cancel'    – they closed the window themselves
 *  * a callback  – the window itself caught the return (no Vipps app on the phone)
 */
export async function startVippsLogin(onOpened?: () => void): Promise<'returned' | 'cancel' | VippsCallback> {
  t0 = Date.now();
  trace = [];
  returned = false;
  traceStep('start');
  const { data, error } = await supabase.functions.invoke('vipps-login', {
    body: { action: 'start', redirectUri: vippsRedirectUri() },
  });
  if (error || !data?.url || !data.state || !data.codeVerifier) throw new Error('Kunne ikke åpne Vipps.');
  await AsyncStorage.setItem(STATE_KEY, data.state);
  await AsyncStorage.setItem(VERIFIER_KEY, data.codeVerifier);
  traceStep('open');
  onOpened?.();
  // Notice the link back from Vipps the moment iOS hands it over, before /vipps/callback
  // has even opened.
  const links = Linking.addEventListener('url', ({ url }) => {
    if (url.includes('vipps/callback')) {
      if (!returned) traceStep('link');
      returned = true;
    }
  });
  try {
    // A private window: iOS then skips its «MinNabo vil bruke vipps.no» question. The approval
    // happens in the Vipps app, so the window needs no saved browser cookies.
    const res = await WebBrowser.openAuthSessionAsync(data.url, sessionCallback(), { preferEphemeralSession: true });
    traceStep(`window:${res.type}`);
    if (res.type === 'success') {
      const q = queryOf(res.url);
      return { code: q.code, state: q.state, error: q.error };
    }
    // iOS reports the window as «cancel» also when the Vipps app sends the person back, and the
    // link can arrive a moment after that. Only a cancel with no link after it is a real cancel.
    if (res.type === 'cancel' && !returned) await waitUntil(() => returned, LINK_GRACE_MS);
    return returned || res.type !== 'cancel' ? 'returned' : 'cancel';
  } finally {
    links.remove();
  }
}

/** How long a «cancel» from the login window waits for the link from Vipps. */
const LINK_GRACE_MS = 2500;

/** Resolves when `done()` turns true, or after `ms`. */
function waitUntil(done: () => boolean, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = setInterval(() => {
      if (done() || Date.now() - started >= ms) {
        clearInterval(tick);
        resolve();
      }
    }, 100);
  });
}

/** `?a=1&b=2` of a URL as an object (decoded). */
function queryOf(url: string): Record<string, string | undefined> {
  const query = url.split('#')[0].split('?')[1] ?? '';
  const out: Record<string, string | undefined> = {};
  for (const part of query.split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      out[k] = v;
    }
  }
  return out;
}

/** The link back from Vipps arrived: close the login window that is still open behind it. */
export function closeVippsWindow(): void {
  returned = true;
  traceStep('link');
  try {
    WebBrowser.dismissAuthSession();
  } catch {
    // no window open (cold start from the link)
  }
}

// Coming back from Vipps can open the app more than once: the Vipps app and the browser tab
// that started the login both hand over minnabo://vipps/callback, sometimes with different
// codes. Handling them one by one in parallel made the second fail with an error while the
// first was still logging the person in. So:
//  * logins run one at a time (a queue), never in parallel
//  * the saved state is kept until a login has succeeded, so a second link can still finish
//  * once a login has succeeded, a late duplicate gets the same result, not an error
let queue: Promise<unknown> = Promise.resolve();
let succeeded: { result: VippsLoginResult; at: number } | null = null;
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

/** Finish the login with what Vipps sent back. Throws an Error with a message for the user. */
export function completeVippsLogin(params: { code?: string; state?: string; error?: string }): Promise<VippsLoginResult> {
  const run = queue.then(() => exchange(params));
  queue = run.catch(() => undefined);
  return run;
}

/** The previous login just succeeded and the session is still there → this link is a duplicate. */
async function recentSuccess(): Promise<VippsLoginResult | null> {
  if (!succeeded || Date.now() - succeeded.at > DUPLICATE_WINDOW_MS) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ? succeeded.result : null;
}

async function exchange(params: { code?: string; state?: string; error?: string }): Promise<VippsLoginResult> {
  const done = await recentSuccess();
  if (done) return done;
  // Vipps turns down people under 15 inside its own app and only sends back an error code
  // (the same kind as a cancel), so the age limit is mentioned – it's the likely reason
  // for anyone who didn't cancel themselves.
  if (params.error) throw new Error('Vipps fullførte ikke innloggingen. Du må være minst 15 år for å bruke MinNabo – er du det, prøv igjen.');
  if (!params.code) throw new Error('Innloggingen ble avbrutt.');
  const expected = await AsyncStorage.getItem(STATE_KEY);
  const codeVerifier = await AsyncStorage.getItem(VERIFIER_KEY);
  if (!expected || expected !== params.state || !codeVerifier) throw new Error('Innloggingen kunne ikke bekreftes. Prøv igjen.');

  traceStep('exchange');
  const { data, error } = await supabase.functions.invoke('vipps-login', {
    body: { code: params.code, codeVerifier, redirectUri: vippsRedirectUri(), trace: [...trace] },
  });
  traceStep(error || !data?.tokenHash ? 'exchange:failed' : 'exchange:ok');
  if (error || !data?.tokenHash) {
    // The function answers with { error } in norsk; functions-js hides it behind a generic message.
    let message: string | undefined = data?.error;
    const res = (error as { context?: Response } | null)?.context;
    if (!message && res && typeof res.json === 'function') {
      message = await res
        .json()
        .then((b: { error?: string }) => b?.error)
        .catch(() => undefined);
    }
    throw new Error(message || 'Kunne ikke logge inn med Vipps. Prøv igjen.');
  }

  const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: data.tokenHash, type: 'magiclink' });
  if (otpError) throw new Error('Kunne ikke starte økten. Prøv igjen.');
  // only now is the one-time state used up
  await AsyncStorage.removeItem(STATE_KEY);
  await AsyncStorage.removeItem(VERIFIER_KEY);
  const result = { isNew: !!data.isNew, youth: !!data.youth };
  succeeded = { result, at: Date.now() };
  return result;
}

/**
 * Resolves true as soon as there is a session, or false after `ms`. The screen waits for
 * this before ever telling someone the login failed: a parallel link may still be finishing.
 */
export function waitForSession(ms = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      sub.subscription.unsubscribe();
      resolve(ok);
    };
    const check = () =>
      supabase.auth
        .getSession()
        .then(({ data }) => data.session && finish(true))
        .catch(() => undefined);
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(true);
    });
    const poll = setInterval(check, 400);
    const timer = setTimeout(() => finish(false), ms);
    void check();
  });
}

/** Tests only. */
export function _resetVippsLogin(): void {
  queue = Promise.resolve();
  succeeded = null;
  returned = false;
  trace = [];
  t0 = 0;
}
