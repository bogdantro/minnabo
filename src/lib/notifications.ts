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

/** This phone's push token once registered – needed to release it on sign-out. */
let registeredToken: string | null = null;

let handlerSet = false;
function ensureHandler() {
  if (handlerSet) return;
  handlerSet = true;
  N().setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
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
    await N().scheduleNotificationAsync({ content: { title, body }, trigger: null });
    return true;
  } catch (e) {
    reportError(e, { where: 'sendTestNotification' });
    return false;
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
