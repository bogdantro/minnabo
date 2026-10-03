import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'minnabo.trustedContacts.v1';
const MAX = 5;

export type TrustedContact = { id: string; name: string; phone: string; relation?: string };

let cache: TrustedContact[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as TrustedContact[]) : [];
  } catch {
    cache = [];
  }
  emit();
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => undefined);
}

export const trustedContacts = {
  list: () => [...cache],
  add(name: string, phone: string, relation?: string) {
    const n = name.trim();
    const p = phone.trim();
    if (!n || !p || cache.length >= MAX) return;
    cache = [...cache, { id: `tc-${Date.now()}`, name: n, phone: p, ...(relation ? { relation } : {}) }];
    persist();
    emit();
  },
  remove(id: string) {
    cache = cache.filter((c) => c.id !== id);
    persist();
    emit();
  },
  _reset() {
    cache = [];
    hydrated = false;
    emit();
  },
};

export function useTrustedContacts(): {
  contacts: TrustedContact[];
  add: (name: string, phone: string, relation?: string) => void;
  remove: (id: string) => void;
  full: boolean;
} {
  const [contacts, setContacts] = useState(cache);
  useEffect(() => {
    void hydrate();
    const sync = () => setContacts([...cache]);
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);
  return {
    contacts,
    add: useCallback((name: string, phone: string, relation?: string) => trustedContacts.add(name, phone, relation), []),
    remove: useCallback((id: string) => trustedContacts.remove(id), []),
    full: contacts.length >= MAX,
  };
}
