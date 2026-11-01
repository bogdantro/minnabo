import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import nb from '@/i18n/nb';

/**
 * «Lås appen med Face ID / fingeravtrykk» (Sikkerhet). Off by default and kept on this
 * phone only. The phone's own code always works as a fallback, so nobody can be locked
 * out of their own app; if Face ID / fingerprint is removed from the phone, the lock lets go.
 */
const KEY = 'minnabo.appLock';

/** Back from the background after this long → ask again. A quick look at a text doesn't count. */
export const LOCK_AFTER_MS = 60 * 1000; // 1 minute

let enabled = false;
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  enabled = (await AsyncStorage.getItem(KEY).catch(() => null)) === '1';
  emit();
}

/** Face ID / Touch ID / fingerprint set up on this phone (never on web). */
export async function lockAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Ask for Face ID / fingerprint (or the phone's code). True = it's the owner. */
export async function unlock(): Promise<boolean> {
  // nothing set up any more: never keep the owner out of their own app
  if (!(await lockAvailable())) return true;
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: nb.appLock.prompt,
    cancelLabel: nb.appLock.cancel,
    fallbackLabel: nb.appLock.useCode,
    disableDeviceFallback: false,
  }).catch(() => ({ success: false }));
  return r.success;
}

export const appLock = {
  isEnabled: () => enabled,
  async setEnabled(on: boolean) {
    enabled = on;
    await AsyncStorage.setItem(KEY, on ? '1' : '0').catch(() => undefined);
    emit();
  },
  hydrate,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  _reset() {
    enabled = false;
    hydrated = false;
  },
};

/** [enabled, ready] – ready once the setting has been read from the phone. */
export function useAppLockEnabled(): [boolean, boolean] {
  const [state, setState] = useState<[boolean, boolean]>([enabled, hydrated]);
  useEffect(() => {
    const sync = () => setState([enabled, hydrated]);
    const off = appLock.subscribe(sync);
    void hydrate().then(sync);
    return off;
  }, []);
  return state;
}
