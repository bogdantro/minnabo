import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ENV } from '@/lib/env';
import { useSession } from '@/auth/session';
import { chatKeys, profileKeys } from './queries';

/**
 * Live updates for one open conversation: any new message or proposal change
 * refetches the messages / conversation / agreement / proposal queries.
 */
export function useConversationChannel(conversationId: string): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (ENV.useMocks || !conversationId) return;
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
          qc.invalidateQueries({ queryKey: ['conversations'] });
        },
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
    if (ENV.useMocks || !conversationId || !userId) return;
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
    if (ENV.useMocks || !userId) return;
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
        () => qc.invalidateQueries({ queryKey: profileKeys.notifications }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => qc.invalidateQueries({ queryKey: ['conversations'] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
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
    if (ENV.useMocks || !userId) return;
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
