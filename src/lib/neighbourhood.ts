import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { neighbourCountFor } from './socialProof';

const KEY = 'minnabo.neighbourhood.v1';

let group: string | null = null;
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    group = (await AsyncStorage.getItem(KEY)) || null;
  } catch {
    group = null;
  }
  emit();
}

function persist() {
  if (group) AsyncStorage.setItem(KEY, group).catch(() => undefined);
  else AsyncStorage.removeItem(KEY).catch(() => undefined);
}

export const neighbourhood = {
  get: () => group,
  join(name: string) {
    group = name.trim() || null;
    persist();
    emit();
  },
  leave() {
    group = null;
    persist();
    emit();
  },
  _reset() {
    group = null;
    hydrated = false;
    emit();
  },
};

export function useNeighbourhood(): {
  group: string | null;
  members: number;
  join: (name: string) => void;
  leave: () => void;
} {
  const [g, setG] = useState(group);
  useEffect(() => {
    void hydrate();
    const sync = () => setG(group);
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);
  return {
    group: g,
    members: g ? Math.max(6, Math.round(neighbourCountFor(g) / 3)) : 0,
    join: neighbourhood.join,
    leave: neighbourhood.leave,
  };
}
