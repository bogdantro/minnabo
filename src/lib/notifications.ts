/**
 * Push notifications: permission, Expo push token registration and the local
 * "Send et testvarsel" (Varslinger). Delivery of real pushes happens server-side
 * (supabase/functions/send-push) from the notifications table.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiClient } from '@/api/client';
import { reportError } from './reporting';

// Loaded lazily: the native module is not needed by most screens, and web has
// only partial support.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const N = () => require('expo-notifications') as typeof import('expo-notifications');

/**
 * MinNabo's own sound (assets/sounds, made by scripts/make-notification-sound.py, bundled
 * by the expo-notifications plugin in app.json). send-push names the same file and channel.
 */
export const NOTIFICATION_SOUND = 'minnabo.wav';
/**
 * Android plays a channel's sound and vibration, not the push's own. A channel can't be
 * changed after it exists on a phone, so a new sound or pattern needs a new channel id.
 */
export const NOTIFICATION_CHANNEL = 'minnabo';
/** Two short buzzes – felt in a pocket when the phone is on silent / vibrate (ms: wait, buzz, pause, buzz). */
const VIBRATION = [0, 220, 140, 220];

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  const Notifications = N();
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
    name: 'Varsler fra MinNabo',
    importance: Notifications.AndroidImportance.HIGH,
    sound: NOTIFICATION_SOUND,
    enableVibrate: true,
    vibrationPattern: VIBRATION,
  });
}

/** This phone's push token once registered – needed to release it on sign-out. */
let registeredToken: string | null = null;

let handlerSet = false;
function ensureHandler() {
  if (handlerSet) return;
  handlerSet = true;
  N().setNotificationHandler({
    // While the app is open, pushes show quietly – except «Send et testvarsel», which is
    // there to hear what the sound is like.
    handleNotification: async (n) => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: (n.request.content.data as { test?: boolean } | undefined)?.test === true,
      shouldSetBadge: false,
    }),
  });
}

/** Ask for permission once; true when notifications may be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const Notifications = N();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Varslinger → "Send et testvarsel": shows a local notification right away.
 * Returns false when the platform/permission doesn't allow it (web, denied).
 */
export async function sendTestNotification(title: string, body: string): Promise<boolean> {
  try {
    if (!(await ensureNotificationPermission())) return false;
    ensureHandler();
    await ensureAndroidChannel();
    await N().scheduleNotificationAsync({
      content: { title, body, sound: NOTIFICATION_SOUND, data: { test: true } },
      trigger: Platform.OS === 'android' ? { channelId: NOTIFICATION_CHANNEL } : null,
    });
    return true;
  } catch (e) {
    reportError(e, { where: 'sendTestNotification' });
    return false;
  }
}

/**
 * A local notification at `at` (shown even when the app is closed). Returns its id, or
 * null when notifications are not allowed. `route` opens that screen when tapped.
 */
export async function scheduleLocalAt(at: Date, title: string, body: string, route?: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || !(await ensureNotificationPermission())) return null;
    ensureHandler();
    const Notifications = N();
    await ensureAndroidChannel();
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: NOTIFICATION_SOUND, data: route ? { route } : {} },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: NOTIFICATION_CHANNEL },
    });
  } catch (e) {
    reportError(e, { where: 'scheduleLocalAt' });
    return null;
  }
}

export async function cancelLocal(id: string | null | undefined): Promise<void> {
  if (!id || Platform.OS === 'web') return;
  try {
    await N().cancelScheduledNotificationAsync(id);
  } catch (e) {
    reportError(e, { where: 'cancelLocal' });
  }
}

/**
 * Register this device's Expo push token with the backend so the server can
 * deliver pushes. Safe to call on every start; does nothing on simulators/web.
 */
export async function registerForPush(): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device') as typeof import('expo-device');
    if (!Device.isDevice) return;
    if (!(await ensureNotificationPermission())) return;
    ensureHandler();
    // before the first push arrives: that is what gives it the sound and the vibration
    await ensureAndroidChannel();
    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await N().getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await apiClient.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
    registeredToken = token;
  } catch (e) {
    reportError(e, { where: 'registerForPush' });
  }
}

/** Before signing out: stop sending this account's notifications to this phone. */
export async function unregisterPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await apiClient.unregisterPushToken(token);
  } catch (e) {
    reportError(e, { where: 'unregisterPush' });
  }
}
