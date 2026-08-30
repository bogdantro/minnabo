import { useEffect } from 'react';
import { useNetworkState } from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { chatKeys } from '@/api/queries';
import { toast } from './toast';
import nb from '@/i18n/nb';

const KEY = 'minnabo.outbox.v1';

export type OutboxItem =
  | { id: string; kind: 'message'; conversationId: string; text: string }
  | { id: string; kind: 'attachment'; conversationId: string; url: string };

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;
export type OutboxInput = DistributiveOmit<OutboxItem, 'id'>;

let queue: OutboxItem[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

const persist = () => AsyncStorage.setItem(KEY, JSON.stringify(queue)).catch(() => undefined);
const emit = () => listeners.forEach((l) => l());

export const outbox = {
  async hydrate() {
    if (hydrated) return;
    hydrated = true;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      queue = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
    } catch {
      queue = [];
    }
    emit();
  },
  enqueue(item: OutboxInput) {
    queue = [
      ...queue,
      { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } as OutboxItem,
    ];
    void persist();
    emit();
    toast.info(nb.toast.offlineQueued);
  },
  get size() {
    return queue.length;
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  async flush(onDone: (conversationIds: string[]) => void) {
    if (queue.length === 0) return;
    const touched = new Set<string>();
    const remaining: OutboxItem[] = [];
    for (const item of queue) {
      try {
        if (item.kind === 'message') {
          await apiClient.sendMessage(item.conversationId, item.text);
        } else {
          await apiClient.sendAttachment(item.conversationId, item.url);
        }
        touched.add(item.conversationId);
      } catch {
        remaining.push(item); // keep it for the next attempt
      }
    }
    queue = remaining;
    void persist();
    emit();
    if (touched.size > 0) onDone([...touched]);
  },
  _reset() {
    queue = [];
    hydrated = false;
    emit();
  },
};

/** Mounted at the app root: replays queued sends whenever connectivity returns. */
export function OfflineOutbox(): null {
  const qc = useQueryClient();
  const net = useNetworkState();
  const online = net.isConnected !== false && net.isInternetReachable !== false;

  useEffect(() => {
    void outbox.hydrate();
  }, []);

  useEffect(() => {
    if (!online) return;
    void outbox.flush((conversationIds) => {
      for (const id of conversationIds) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(id) });
        qc.invalidateQueries({ queryKey: chatKeys.conversation(id) });
      }
      qc.invalidateQueries({ queryKey: ['conversations'] });
    });
  }, [online, qc]);

  return null;
}
