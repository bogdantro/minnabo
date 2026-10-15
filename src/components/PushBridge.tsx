import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSession } from '@/auth/session';
import { safePush } from '@/lib/nav';
import { useUnreadConversationCount, useUnreadNotificationCount } from '@/api/queries';
import { registerForPush } from '@/lib/notifications';

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
    const sub = Notifications.addNotificationResponseReceivedListener((r) => safePush(routeOf(r.notification.request.content.data)));
    // the tap that started the app
    void Notifications.getLastNotificationResponseAsync?.()
      .then((r) => {
        if (r) setPending(routeOf(r.notification.request.content.data));
      })
      .catch(() => undefined);
    return () => sub.remove();
  }, []);

  return userId ? <BadgeSync /> : null;
}
