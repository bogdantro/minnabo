/**
 * «Enkel visning» (seniormodus, 0101): a simpler home with big buttons and «Jeg trenger hjelp med …».
 * Stored on the phone, so it follows the person who uses this phone rather than the account.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'minnabo.seniorMode';

let on = false;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  if (loaded) return;
  loaded = true;
  void AsyncStorage.getItem(KEY)
    .then((v) => {
      if ((v === '1') !== on) {
        on = v === '1';
        emit();
      }
    })
    .catch(() => undefined);
}

export const seniorMode = {
  get: () => on,
  set(next: boolean) {
    on = next;
    emit();
    void (next ? AsyncStorage.setItem(KEY, '1') : AsyncStorage.removeItem(KEY)).catch(() => undefined);
  },
  subscribe(l: () => void) {
    load();
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** tests only */
  _reset() {
    on = false;
    loaded = false;
  },
};

/** [on, set] – the same value on every screen at once. */
export function useSeniorMode(): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(seniorMode.subscribe, seniorMode.get, seniorMode.get);
  return [value, seniorMode.set];
}
