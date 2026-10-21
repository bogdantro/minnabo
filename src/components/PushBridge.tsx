import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSession } from '@/auth/session';
import { safePush } from '@/lib/nav';
import { useUnreadConversationCount, useUnreadNotificationCount } from '@/api/queries';
import { registerForPush } from '@/lib/notifications';
import nb from '@/i18n/nb';

/**
 * The «Hvordan gikk det?» push the day after a job (0069) carries this category, which
 * gives it star buttons. Must match REVIEW_CATEGORY in supabase/functions/send-push.
 * Three buttons, because Android shows no more than three.
 */
export const REVIEW_CATEGORY = 'review';
const STAR_ACTIONS: Record<string, number> = { 'stars-5': 5, 'stars-4': 4 };

/** '/vurder/p1' + 'stars-5' → '/vurder/p1?stjerner=5'. Anything else stays as it was. */
export function reviewRouteFor(route: string, action: string): string {
  const stars = STAR_ACTIONS[action];
  return stars && route.startsWith('/vurder/') ? `${route}?stjerner=${stars}` : route;
}

/** Keeps the number on the app icon in step with what is unread (pushes set it while the app is closed). */
function BadgeSync() {
  const count = useUnreadConversationCount() + useUnreadNotificationCount();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    void Notifications.setBadgeCountAsync?.(count).catch(() => undefined);
  }, [count]);
  return null;
}

/**
 * Mounted once at the root. Registers this device for push when someone is
 * signed in, and opens the right screen when a push is tapped (the server puts
 * the in-app route in `data.route`, see supabase/functions/send-push).
 */
export function PushBridge() {
  const { userId } = useSession();
  // the route from the notification that started the app, held until we are signed in
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!pending || !userId) return;
    // after the start-up redirects (login → tabs) have run, so they don't replace it
    const t = setTimeout(() => {
      safePush(pending);
      setPending(null);
    }, 700);
    return () => clearTimeout(t);
  }, [pending, userId]);

  useEffect(() => {
    if (!userId) {
      // signed out: nothing unread to show on the icon
      if (Platform.OS !== 'web') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        void Notifications.setBadgeCountAsync?.(0).catch(() => undefined);
      }
      return;
    }
    void registerForPush();
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    if (typeof Notifications.addNotificationResponseReceivedListener !== 'function') return;
    // A varsel without a link of its own (e.g. «Melding fra MinNabo» from the website's admin)
    // opens Varsler, where the whole text can be read.
    const routeOf = (data: unknown): string => {
      const route = (data as { route?: unknown } | null)?.route;
      return typeof route === 'string' && route.startsWith('/') ? route : '/varsler';
    };
    // star buttons on the review reminder (registered once; harmless to repeat)
    void Notifications.setNotificationCategoryAsync?.(REVIEW_CATEGORY, [
      { identifier: 'stars-5', buttonTitle: nb.reviewReminder.fiveStars, options: { opensAppToForeground: true } },
      { identifier: 'stars-4', buttonTitle: nb.reviewReminder.fourStars, options: { opensAppToForeground: true } },
      { identifier: 'write', buttonTitle: nb.reviewReminder.write, options: { opensAppToForeground: true } },
    ])?.catch(() => undefined);
    const targetOf = (r: import('expo-notifications').NotificationResponse) =>
      reviewRouteFor(routeOf(r.notification.request.content.data), r.actionIdentifier);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => safePush(targetOf(r)));
    // the tap that started the app
    void Notifications.getLastNotificationResponseAsync?.()
      .then((r) => {
        if (r) setPending(targetOf(r));
      })
      .catch(() => undefined);
    return () => sub.remove();
  }, []);

  return userId ? <BadgeSync /> : null;
}
