import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/api/client';
import { reportError } from './reporting';

/**
 * «Inviter en nabo»: the invite link opens /velkommen?ref=<inviter id>. The id is kept
 * on the phone through the Vipps login and Oppsett, and sent once the new profile
 * exists (record_invite, 0081). Nothing is stored for a link without a ref.
 */
const KEY = 'minnabo.invite.ref';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function rememberInviter(ref: string | undefined): Promise<void> {
  if (!ref || !UUID.test(ref)) return;
  await AsyncStorage.setItem(KEY, ref).catch(() => undefined);
}

/** After Oppsett: tell the server who invited us (once), then forget it. Never blocks onboarding. */
export async function sendPendingInvite(): Promise<void> {
  try {
    const ref = await AsyncStorage.getItem(KEY);
    if (!ref) return;
    await apiClient.recordInvite(ref);
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    // kept for the next try (e.g. offline); the server ignores it after 14 days anyway
    reportError(e, { where: 'sendPendingInvite' });
  }
}
