import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

/**
 * Real Vipps login (OIDC authorization-code flow). Vipps is used for login only.
 *
 *   startVippsLogin()      → the `vipps-login` edge function builds the authorize URL
 *                            (app_to_app_v2 + PKCE); the person approves in the Vipps app
 *   minnabo://vipps/callback?code=… → back in the app (route `/vipps/callback`)
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

/** Must be registered as a redirect URI in the Vipps portal and allowed in the edge function. */
export const vippsRedirectUri = () => Linking.createURL('vipps/callback');

export type VippsLoginResult = { isNew: boolean; youth: boolean };

/** Send the person to Vipps. Resolves once the browser / Vipps app has been opened. */
export async function startVippsLogin(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('vipps-login', {
    body: { action: 'start', redirectUri: vippsRedirectUri() },
  });
  if (error || !data?.url || !data.state || !data.codeVerifier) throw new Error('Kunne ikke åpne Vipps.');
  await AsyncStorage.setItem(STATE_KEY, data.state);
  await AsyncStorage.setItem(VERIFIER_KEY, data.codeVerifier);
  await Linking.openURL(data.url);
}

/** Finish the login with what Vipps sent back. Throws an Error with a message for the user. */
export async function completeVippsLogin(params: { code?: string; state?: string; error?: string }): Promise<VippsLoginResult> {
  if (params.error || !params.code) throw new Error('Innloggingen ble avbrutt.');
  const expected = await AsyncStorage.getItem(STATE_KEY);
  const codeVerifier = await AsyncStorage.getItem(VERIFIER_KEY);
  await AsyncStorage.removeItem(STATE_KEY);
  await AsyncStorage.removeItem(VERIFIER_KEY);
  if (!expected || expected !== params.state || !codeVerifier) throw new Error('Innloggingen kunne ikke bekreftes. Prøv igjen.');

  const { data, error } = await supabase.functions.invoke('vipps-login', {
    body: { code: params.code, codeVerifier, redirectUri: vippsRedirectUri() },
  });
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
  return { isNew: !!data.isNew, youth: !!data.youth };
}
