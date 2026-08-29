import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/auth/session';
import { chatKeys, profileKeys } from './queries';

/**
 * Live updates for one open conversation: any new message or proposal change
 * refetches the messages / conversation / agreement / proposal queries.
 */
export function useConversationChannel(conversationId: string): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;
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
 * Mounted once at the app root while signed in: refetches the inbox and
 * notifications whenever the current user gets a new message or notification.
 */
export function useInboxRealtime(): void {
  const qc = useQueryClient();
  const { userId } = useSession();

  useEffect(() => {
    if (!userId) return;
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
