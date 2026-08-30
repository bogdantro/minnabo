import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'minnabo.recentSearches.v1';
const MAX = 8;

let cache: string[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    cache = [];
  }
  emit();
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => undefined);
}

export const recentSearches = {
  add(term: string) {
    const t = term.trim();
    if (t.length < 2) return;
    cache = [t, ...cache.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX);
    persist();
    emit();
  },
  remove(term: string) {
    cache = cache.filter((x) => x !== term);
    persist();
    emit();
  },
  clear() {
    cache = [];
    persist();
    emit();
  },
  _reset() {
    cache = [];
    hydrated = false;
    emit();
  },
};

export function useRecentSearches(): {
  items: string[];
  add: (t: string) => void;
  remove: (t: string) => void;
  clear: () => void;
} {
  const [items, setItems] = useState(cache);
  useEffect(() => {
    void hydrate();
    const sync = () => setItems([...cache]);
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);
  return {
    items,
    add: useCallback((t: string) => recentSearches.add(t), []),
    remove: useCallback((t: string) => recentSearches.remove(t), []),
    clear: useCallback(() => recentSearches.clear(), []),
  };
}
