/**
 * Local feature flags. A real flag service arrives in a later phase.
 * `redCross` stays OFF until written approval from Norges Røde Kors (spec §17).
 */
export const featureFlags = {
  redCross: false,
  businessRegistration: false,
  adminPanel: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export const isEnabled = (flag: FeatureFlag): boolean => featureFlags[flag];
