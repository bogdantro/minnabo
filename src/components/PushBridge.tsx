import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useSession } from '@/auth/session';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { reportError } from '@/lib/reporting';
import { toast } from '@/lib/toast';
import { chatKeys, useUnreadConversationCount, useUnreadNotificationCount } from '@/api/queries';
import { registerForPush } from '@/lib/notifications';
import nb from '@/i18n/nb';

/**
 * The «Hvordan gikk det?» push the day after a job (0069) carries this category, which
 * gives it star buttons. Must match REVIEW_CATEGORY in supabase/functions/send-push.
 * Three buttons, because Android shows no more than three.
 */
export const REVIEW_CATEGORY = 'review';
const STAR_ACTIONS: Record<string, number> = { 'stars-5': 5, 'stars-4': 4 };

/**
 * One-tap answers on job-day pushes (0074). Must match ATTEND_CATEGORY / AVAILABLE_CATEGORY in
 * send-push. The button only adds `svar=ja`; the screen that opens does the rest, so a
 * tap can never do something the person can't see.
 */
export const ATTEND_CATEGORY = 'attend';
export const AVAILABLE_CATEGORY = 'available';
const YES = 'svar-ja';

/**
 * «Svar» on a chat push (asked 2026-11-09): a text field in the notification itself, sent without opening
 * the app. Must match MESSAGE_CATEGORY in send-push. The server checks it like any other message.
 */
export const MESSAGE_CATEGORY = 'message';
export const REPLY_ACTION = 'reply';
/** A quick reply can't be longer than a normal message. */
const REPLY_MAX = 2000;

type QuickReply = { conversationId: string; text: string; route: string };

/** The reply typed in a notification, or null. Pure, so it can be tested. */
export function quickReplyOf(actionIdentifier: string, userText: string | undefined, data: unknown): QuickReply | null {
  if (actionIdentifier !== REPLY_ACTION) return null;
  const text = (userText ?? '').trim().slice(0, REPLY_MAX);
  const d = (data ?? {}) as { conversationId?: unknown; route?: unknown };
  if (!text || typeof d.conversationId !== 'string' || !d.conversationId) return null;
  return { conversationId: d.conversationId, text, route: typeof d.route === 'string' ? d.route : `/chat/${d.conversationId}` };
}

/**
 * '/vurder/p1' + 'stars-5' → '/vurder/p1?stjerner=5'
 * '/avtale/p1?bekreft=1' + 'svar-ja' → '/avtale/p1?bekreft=1&svar=ja'
 * Anything else stays as it was.
 */
export function reviewRouteFor(route: string, action: string): string {
  const stars = STAR_ACTIONS[action];
  if (stars && route.startsWith('/vurder/')) return `${route}?stjerner=${stars}`;
  if (action === YES && (route.includes('?bekreft=1') || route.includes('?ledig=1'))) return `${route}&svar=ja`;
  return route;
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
  // replies typed in a notification, held until the session is back (the app may have been asleep)
  const replies = useRef<QuickReply[]>([]);
  const signedIn = useRef(false);
  const qc = useQueryClient();

  const sendReply = useCallback(
    (next: QuickReply) =>
      apiClient
        .sendMessage(next.conversationId, next.text)
      .then(() => {
        haptics.success();
        toast.success(nb.chat.quickReplySent, { icon: 'check' });
        void qc.invalidateQueries({ queryKey: chatKeys.messages(next.conversationId) });
        void qc.invalidateQueries({ queryKey: ['conversations'] });
      })
      .catch((e) => {
        // never lost: the chat opens so it can be sent again
        reportError(e, { where: 'pushQuickReply' });
        toast.error(nb.chat.quickReplyFailed);
        safePush(next.route);
      }),
    [qc],
  );
  const queueReply = useCallback(
    (reply: QuickReply) => {
      if (signedIn.current) void sendReply(reply);
      else if (!replies.current.some((x) => x.conversationId === reply.conversationId && x.text === reply.text)) replies.current.push(reply);
    },
    [sendReply],
  );
  useEffect(() => {
    signedIn.current = !!userId;
    if (!userId) return;
    const waiting = replies.current.splice(0);
    waiting.forEach((r) => void sendReply(r));
  }, [userId, sendReply]);

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
    void Notifications.setNotificationCategoryAsync?.(ATTEND_CATEGORY, [
      { identifier: YES, buttonTitle: nb.rescue.pushAttend, options: { opensAppToForeground: true } },
    ])?.catch(() => undefined);
    void Notifications.setNotificationCategoryAsync?.(AVAILABLE_CATEGORY, [
      { identifier: YES, buttonTitle: nb.rescue.pushAvailable, options: { opensAppToForeground: true } },
    ])?.catch(() => undefined);
    void Notifications.setNotificationCategoryAsync?.(MESSAGE_CATEGORY, [
      {
        identifier: REPLY_ACTION,
        buttonTitle: nb.chat.quickReply,
        textInput: { submitButtonTitle: nb.chat.quickReplySend, placeholder: nb.chat.quickReplyPh },
        options: { opensAppToForeground: false },
      },
    ])?.catch(() => undefined);
    const targetOf = (r: import('expo-notifications').NotificationResponse) =>
      reviewRouteFor(routeOf(r.notification.request.content.data), r.actionIdentifier);
    const handle = (r: import('expo-notifications').NotificationResponse, opened: (route: string) => void) => {
      const reply = quickReplyOf(r.actionIdentifier, r.userText, r.notification.request.content.data);
      if (reply) {
        queueReply(reply);
        // the notification stays on screen on some Androids until it is dismissed
        void Notifications.dismissNotificationAsync?.(r.notification.request.identifier).catch(() => undefined);
        return;
      }
      opened(targetOf(r));
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) => handle(r, safePush));
    // the tap (or reply) that started the app
    void Notifications.getLastNotificationResponseAsync?.()
      .then((r) => {
        if (r) handle(r, setPending);
      })
      .catch(() => undefined);
    return () => sub.remove();
  }, [queueReply]);

  return userId ? <BadgeSync /> : null;
}
