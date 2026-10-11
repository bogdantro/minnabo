import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/auth/session';
import { apiClient } from './client';
import { appSettingsKeys, categoryKeys, chatKeys, communityKeys, profileKeys } from './queries';

/**
 * Live updates for one open conversation: any new message or proposal change
 * refetches the messages / conversation / agreement / proposal queries.
 * While the chat is open everything in it counts as read, so Innboks never
 * shows it as unread when you go back.
 */
export function useConversationChannel(conversationId: string, visible = true): void {
  const qc = useQueryClient();
  // `visible` = the chat is the screen on top; behind Avtale / Jobbdag it is not being read
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
    if (!conversationId || !visible) return;
    // opened, or come back to: everything in it is read now
    apiClient
      .markConversationsRead([conversationId])
      .catch(() => undefined)
      .finally(() => qc.invalidateQueries({ queryKey: ['conversations'] }));
  }, [conversationId, visible, qc]);

  useEffect(() => {
    if (!conversationId) return;
    const markRead = () => {
      if (!visibleRef.current) return qc.invalidateQueries({ queryKey: ['conversations'] });
      return apiClient
        .markConversationsRead([conversationId])
        .catch(() => undefined)
        .finally(() => qc.invalidateQueries({ queryKey: ['conversations'] }));
    };
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
          qc.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) });
          qc.invalidateQueries({ queryKey: chatKeys.agreement(conversationId) });
          void markRead();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `conversation_id=eq.${conversationId}`,
        },
        // the other person read the chat → my ticks turn to "Lest"
        () => qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) }),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proposals',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['proposal'] });
          qc.invalidateQueries({ queryKey: ['proposals'] });
          qc.invalidateQueries({ queryKey: chatKeys.agreement(conversationId) });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);
}

/**
 * Typing indicator for one open conversation. `notifyTyping()` broadcasts a
 * lightweight ping (throttled by the caller); `counterpartTyping` flips true
 * when the other side pings and clears itself after a short idle timeout.
 * No-op under mocks — there is no peer to hear it.
 */
export function useTypingChannel(conversationId: string): {
  counterpartTyping: boolean;
  notifyTyping: () => void;
} {
  const { userId } = useSession();
  const [counterpartTyping, setCounterpartTyping] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId || !userId) return;
    const channel = supabase.channel(`typing:${conversationId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        if ((payload as { payload?: { from?: string } }).payload?.from === userId) return;
        setCounterpartTyping(true);
        if (clearTimer.current) clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(() => setCounterpartTyping(false), 4000);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, userId]);

  const notifyTyping = () => {
    const ch = channelRef.current;
    if (!ch || typeof ch.send !== 'function') return;
    try {
      ch.send({ type: 'broadcast', event: 'typing', payload: { from: userId } });
    } catch {
      /* channel not ready yet — the next keystroke will retry */
    }
  };

  return { counterpartTyping, notifyTyping };
}

/**
 * Mounted once at the app root while signed in: refetches the inbox and
 * notifications whenever the current user gets a new message or notification.
 */
export function useInboxRealtime(): void {
  const qc = useQueryClient();
  const { userId } = useSession();

  useEffect(() => {
    if (!userId) return;
    // several changes in quick succession (a conversation row + its message) → one refetch
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshInbox = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void qc.invalidateQueries({ queryKey: ['conversations'] }), 350);
    };
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: profileKeys.notifications });
          // a new time proposed / answered on an avtale arrives as a notification
          qc.invalidateQueries({ queryKey: ['agreement'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        refreshInbox,
      )
      // a new message in any of my conversations (row-level security limits this to mine)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        refreshInbox,
      )
      // the other person got or read my message → the tick on the row changes
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants' },
        refreshInbox,
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}

/**
 * Things the website's admin changes in the shared database: platform settings, partners,
 * categories and donations. Any change refetches the matching data, so an open screen
 * updates within seconds. Runs before login too (app_settings is readable then – maintenance
 * mode). A partner that becomes hidden sends no row event (row security), which is why the
 * `partners.version` setting is the signal for partners.
 */
export function usePlatformRealtime(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};
    // several rows change in one admin action → one refetch per kind
    const soon = (name: string, run: () => void) => () => {
      clearTimeout(timers[name]);
      timers[name] = setTimeout(run, 300);
    };
    const partners = soon('partners', () => void qc.invalidateQueries({ queryKey: communityKeys.partners }));
    const channel = supabase
      .channel('platform')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, soon('settings', () => {
        void qc.invalidateQueries({ queryKey: appSettingsKeys.app });
        void qc.invalidateQueries({ queryKey: communityKeys.partners });
      }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partners' }, partners)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_placements' }, partners)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, soon('categories', () => void qc.invalidateQueries({ queryKey: categoryKeys.all })))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donation_records' }, soon('donations', () => void qc.invalidateQueries({ queryKey: communityKeys.donations })))
      .subscribe();

    return () => {
      Object.values(timers).forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

/** Renders nothing; keeps the platform realtime subscription alive. */
export function PlatformRealtime(): null {
  usePlatformRealtime();
  return null;
}

/** Renders nothing; just keeps the inbox realtime subscription alive. */
export function InboxRealtime(): null {
  useInboxRealtime();
  return null;
}

/**
 * Global presence: the set of profile ids currently online. Every signed-in
 * client tracks itself on a shared channel.
 */
export function usePresence(): Set<string> {
  const { userId } = useSession();
  const [online, setOnline] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel('presence:lobby', {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        setOnline(new Set(Object.keys(state)));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ profileId: userId, at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return online;
}
