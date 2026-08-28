import { useSyncExternalStore } from 'react';

export type Purpose = 'NEED_HELP' | 'WANT_JOBS' | 'BOTH';

export type OnboardingState = {
  isOnboarded: boolean;
  contact?: string;
  purpose?: Purpose;
  municipality?: string;
  place?: string;
  maxDistanceKm?: number;
  consents: { terms: boolean; privacy: boolean; age: boolean };
};

// Default onboarded so the app opens on Oppdrag. Onboarding is reachable via
// "Logg ut" / "Slett konto". (Reversible assumption — see README.)
const DEFAULT_STATE: OnboardingState = {
  isOnboarded: true,
  purpose: 'BOTH',
  municipality: 'Lillehammer',
  place: 'Lillehammer',
  maxDistanceKm: 15,
  consents: { terms: false, privacy: false, age: false },
};

let state: OnboardingState = { ...DEFAULT_STATE };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const authStore = {
  get: () => state,
  patch: (patch: Partial<OnboardingState>) => {
    state = { ...state, ...patch };
    emit();
  },
  completeOnboarding: () => {
    state = { ...state, isOnboarded: true };
    emit();
  },
  signOut: () => {
    state = { isOnboarded: false, consents: { terms: false, privacy: false, age: false } };
    emit();
  },
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  _reset: () => {
    state = { ...DEFAULT_STATE };
    emit();
  },
};

export function useAuth(): OnboardingState {
  return useSyncExternalStore(authStore.subscribe, authStore.get, authStore.get);
}
