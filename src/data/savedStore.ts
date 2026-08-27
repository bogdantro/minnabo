import { useCallback, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'minnabo.savedListings';

let saved = new Set<string>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const persist = () => {
  AsyncStorage.setItem(KEY, JSON.stringify([...saved])).catch(() => undefined);
};

export const savedStore = {
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      saved = new Set(raw ? (JSON.parse(raw) as string[]) : []);
      emit();
    } catch {
      saved = new Set();
    }
  },
  has: (id: string) => saved.has(id),
  toggle: (id: string) => {
    const next = new Set(saved);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saved = next;
    persist();
    emit();
  },
  list: () => [...saved],
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  _reset: () => {
    saved = new Set();
    emit();
  },
};

export function useIsSaved(id: string): [boolean, () => void] {
  const isSaved = useSyncExternalStore(
    savedStore.subscribe,
    () => savedStore.has(id),
    () => savedStore.has(id),
  );
  const toggle = useCallback(() => savedStore.toggle(id), [id]);
  return [isSaved, toggle];
}
