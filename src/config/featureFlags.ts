import { useEffect, useState } from 'react';

/**
 * Feature flags, fixed per build.
 * `redCross` stays OFF until written approval from Norges Røde Kors (spec §17).
 */
export const featureFlags = {
  redCross: false,
  /** "For bedrifter" (Meny, Innstillinger, Verifisering, /bedrift). Hidden until it is ready. */
  businessRegistration: false,
  /** The registration form on "For bedrifter". Off = only the information card. */
  businessForm: false,
  adminPanel: true,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

// Overrides exist for tests only (setFlagOverride); the app uses the defaults above.
let overrides: Partial<Record<FeatureFlag, boolean>> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const isEnabled = (flag: FeatureFlag): boolean => overrides[flag] ?? featureFlags[flag];

/** Tests only. */
export function setFlagOverride(flag: FeatureFlag, on: boolean): void {
  overrides = { ...overrides, [flag]: on };
  emit();
}

/** Current value of every flag; re-renders when an override changes. */
export function useFeatureFlags(): Record<FeatureFlag, boolean> {
  const read = () =>
    Object.fromEntries((Object.keys(featureFlags) as FeatureFlag[]).map((f) => [f, isEnabled(f)])) as Record<FeatureFlag, boolean>;
  const [flags, setFlags] = useState(read);
  useEffect(() => {
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
