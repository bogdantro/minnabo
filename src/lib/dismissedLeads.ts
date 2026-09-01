import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'minnabo.dismissedLeads.v1';

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

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify([...cache])).catch(() => undefined);
}

export const dismissedLeads = {
  has: (id: string) => cache.has(id),
  dismiss(id: string) {
    cache = new Set(cache).add(id);
    persist();
    emit();
  },
  _reset() {
    cache = new Set();
    hydrated = false;
    emit();
  },
};

export function useDismissedLeads() {
  const [ids, setIds] = useState(cache);
  useEffect(() => {
    void hydrate();
    const sync = () => setIds(new Set(cache));
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);
  return {
    dismissed: ids,
    dismiss: useCallback((id: string) => dismissedLeads.dismiss(id), []),
  };
}
