import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * "Slå av varsler" per conversation (Chat menu). Stored on the device only –
 * push notifications don't know about it until the backend gets a mute field
 * (see docs/LEFT_OUT.md).
 */
const KEY = 'minnabo.mutedConversations.v1';

let cache = new Set<string>();
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    cache = new Set();
  }
  emit();
}

export const mutedConversations = {
  has: (id: string) => cache.has(id),
  toggle(id: string): boolean {
    const next = new Set(cache);
    const on = !next.has(id);
    if (on) next.add(id);
    else next.delete(id);
    cache = next;
    AsyncStorage.setItem(KEY, JSON.stringify([...cache])).catch(() => undefined);
    emit();
    return on;
  },
  _reset() {
    cache = new Set();
    hydrated = false;
    emit();
  },
};

export function useMutedConversation(id: string): [boolean, () => boolean] {
  const [muted, setMuted] = useState(cache.has(id));
  useEffect(() => {
    void hydrate();
    const sync = () => setMuted(cache.has(id));
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, [id]);
  return [muted, useCallback(() => mutedConversations.toggle(id), [id])];
}
