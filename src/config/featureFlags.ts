import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Feature flags. Defaults live here; in dev builds (and for admins) they can be
 * overridden on the device from Innstillinger → Utvikler.
 * `redCross` stays OFF until written approval from Norges Røde Kors (spec §17).
 */
export const featureFlags = {
  redCross: false,
  businessRegistration: true,
  adminPanel: true,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

/** Shown in the Utvikler panel: label + the flag's stable key. */
export const FLAG_META: Record<FeatureFlag, { label: string; code: string }> = {
  redCross: { label: 'Røde Kors-samarbeid', code: 'ff_redcross_partner' },
  businessRegistration: { label: 'Bedriftsregistrering', code: 'ff_business_registration' },
  adminPanel: { label: 'Adminpanel', code: 'ff_admin_panel' },
};

const KEY = 'minnabo.flagOverrides.v1';
let overrides: Partial<Record<FeatureFlag, boolean>> = {};
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    overrides = raw ? (JSON.parse(raw) as typeof overrides) : {};
  } catch {
    overrides = {};
  }
  emit();
}

export const isEnabled = (flag: FeatureFlag): boolean => overrides[flag] ?? featureFlags[flag];

export function setFlagOverride(flag: FeatureFlag, on: boolean): void {
  overrides = { ...overrides, [flag]: on };
  AsyncStorage.setItem(KEY, JSON.stringify(overrides)).catch(() => undefined);
  emit();
}

/** Current value of every flag; re-renders when an override changes. */
export function useFeatureFlags(): Record<FeatureFlag, boolean> {
  const read = () =>
    Object.fromEntries((Object.keys(featureFlags) as FeatureFlag[]).map((f) => [f, isEnabled(f)])) as Record<FeatureFlag, boolean>;
  const [flags, setFlags] = useState(read);
  useEffect(() => {
    void hydrate();
    const sync = () => setFlags(read());
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);
  return flags;
}

/** Tests only. */
export function _resetFlagOverrides(): void {
  overrides = {};
  emit();
}
