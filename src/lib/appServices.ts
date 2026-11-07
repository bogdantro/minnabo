/**
 * Small wrappers around native services. Each one is loaded when first used and never throws: an
 * over-the-air update can reach a build without the module, and that must not stop the app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { safePush } from './nav';

// ------------------------------------------------------------------
// «Vurder appen»
// ------------------------------------------------------------------
const RATING_KEY = 'minnabo.ratingAsked.v1';
/** Apple shows the box at most three times a year anyway; we ask rarely so it lands well. */
const RATING_EVERY_MS = 120 * 24 * 60 * 60 * 1000;

/** After a good moment: a 5-star review given, a job finished. */
export async function askForRating(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const last = Number((await AsyncStorage.getItem(RATING_KEY)) ?? 0);
    if (Date.now() - last < RATING_EVERY_MS) return;
    const StoreReview = await import('expo-store-review');
    if (!(await StoreReview.hasAction())) return;
    await AsyncStorage.setItem(RATING_KEY, String(Date.now()));
    await StoreReview.requestReview();
  } catch {
    /* a rating box is never worth an error */
  }
}

// ------------------------------------------------------------------
// Quick actions on the app icon
// ------------------------------------------------------------------
const QUICK_ACTIONS = [
  { id: 'post', title: 'Legg ut oppdrag', icon: 'symbol:plus.circle', params: { href: '/legg-ut' } },
  { id: 'inbox', title: 'Innboks', icon: 'symbol:message', params: { href: '/innboks' } },
  { id: 'forme', title: 'Oppdrag for meg', icon: 'symbol:sparkles', params: { href: '/oppdrag-for-meg' } },
];

/** Registers the actions and follows a tap. Youth accounts can't post, so they don't get that one. */
export async function setupQuickActions(youth: boolean): Promise<() => void> {
  if (Platform.OS === 'web') return () => undefined;
  try {
    const Q = await import('expo-quick-actions');
    await Q.setItems(youth ? QUICK_ACTIONS.filter((a) => a.id !== 'post' && a.id !== 'forme') : QUICK_ACTIONS);
    const open = (a: { params?: Record<string, unknown> | null } | null | undefined) => {
      const href = a?.params?.href;
      if (typeof href === 'string') safePush(href);
    };
    if (Q.initial) open(Q.initial);
    const sub = Q.addListener(open);
    return () => sub.remove();
  } catch {
    return () => undefined;
  }
}

// ------------------------------------------------------------------
// On the lock screen: the job timer and Trygg tur
// ------------------------------------------------------------------
const LIVE_CHANNEL = 'minnabo-live';
export type LiveKey = 'job' | 'trip';

/**
 * A quiet notification that stays while the job or trip is on. On Android it can't be swiped away;
 * on iPhone it is a normal lock-screen notification. It must make no sound: it shows when the
 * person has just pressed a button in the app themselves.
 */
export async function showLive(key: LiveKey, title: string, body: string, route: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const N = await import('expo-notifications');
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(LIVE_CHANNEL, { name: 'Pågående jobb og Trygg tur', importance: N.AndroidImportance.LOW, sound: null, enableVibrate: false });
    }
    await N.scheduleNotificationAsync({
      identifier: `minnabo-live-${key}`,
      content: { title, body, sticky: true, autoDismiss: false, sound: false, data: { route, live: true } },
      trigger: Platform.OS === 'android' ? { channelId: LIVE_CHANNEL } : null,
    });
  } catch {
    /* the job itself goes on */
  }
}

export async function clearLive(key: LiveKey): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const N = await import('expo-notifications');
    await N.dismissNotificationAsync(`minnabo-live-${key}`);
  } catch {
    /* nothing to clear */
  }
}
