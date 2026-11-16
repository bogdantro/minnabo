/**
 * A small set of ids kept on this phone (AsyncStorage), shared by every screen that reads the same key and
 * updated everywhere at once. For personal, unimportant choices that don't need the server: ticks on
 * Sesongsjekk, hidden oppdrag, recently viewed.
 *
 *   const [done, toggle] = useLocalSet('minnabo.season.v1');
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Store = { ids: string[]; hydrated: boolean; listeners: Set<() => void> };
const stores = new Map<string, Store>();

function storeFor(key: string): Store {
  let s = stores.get(key);
  if (!s) {
    s = { ids: [], hydrated: false, listeners: new Set() };
    stores.set(key, s);
    const st = s;
    void AsyncStorage.getItem(key)
      .then((raw) => {
        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
        st.ids = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
      })
      .catch(() => {
        st.ids = [];
      })
      .finally(() => {
        st.hydrated = true;
        st.listeners.forEach((l) => l());
      });
  }
  return s;
}

/** Replace the list (newest first is up to the caller), keep at most `max`. */
export function setLocalIds(key: string, ids: string[], max = 200): void {
  const s = storeFor(key);
  s.ids = ids.slice(0, max);
  s.listeners.forEach((l) => l());
  void AsyncStorage.setItem(key, JSON.stringify(s.ids)).catch(() => undefined);
}

export function getLocalIds(key: string): string[] {
  return storeFor(key).ids;
}

/** [ids, toggle(id), set(ids)] for a key; re-renders when any screen changes it. */
export function useLocalSet(key: string, max = 200): [string[], (id: string) => void, (ids: string[]) => void] {
  const s = storeFor(key);
  const [ids, setIds] = useState<string[]>(s.ids);
  useEffect(() => {
    const on = () => setIds([...s.ids]);
    s.listeners.add(on);
    on();
    return () => {
      s.listeners.delete(on);
    };
  }, [s]);
  const toggle = useCallback(
    (id: string) => setLocalIds(key, s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [id, ...s.ids], max),
    [key, s, max],
  );
  const replace = useCallback((next: string[]) => setLocalIds(key, next, max), [key, max]);
  return [ids, toggle, replace];
}

/** Tests only: forget everything. */
export function _resetLocalSets(): void {
  stores.clear();
}
