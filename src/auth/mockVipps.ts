import { useEffect, useState } from 'react';

/**
 * MOCK Vipps login. Real Vipps (OIDC) is not wired yet; this stands in for it
 * so the whole login flow from the design can be walked through. Nothing is
 * stored – the identity lives in memory until the app restarts or "Logg ut".
 *
 * The two identities are the sample people from the design files
 * (LoggInn.dc.html: adult, Ungdomskonto.dc.html: 16-year-old).
 */
export type VippsIdentity = {
  name: string;
  firstName: string;
  initials: string;
  birthYear: number;
  age: number;
  /** "+47 ••• •• 234" – only the last digits are ever shown */
  phoneMasked: string;
  /** under 18 → youth account */
  youth: boolean;
};

export const MOCK_ADULT: VippsIdentity = {
  name: 'Mari Haugen',
  firstName: 'Mari',
  initials: 'MH',
  birthYear: 1991,
  age: 34,
  phoneMasked: '+47 ••• •• 234',
  youth: false,
};

export const MOCK_YOUTH: VippsIdentity = {
  name: 'Emil Nygård',
  firstName: 'Emil',
  initials: 'EN',
  birthYear: 2010,
  age: 16,
  phoneMasked: '+47 ••• •• 518',
  youth: true,
};

let current: VippsIdentity | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const mockVipps = {
  get: (): VippsIdentity | null => current,
  signIn(identity: VippsIdentity) {
    current = identity;
    emit();
  },
  signOut() {
    current = null;
    emit();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/** The mock Vipps identity, or null when nobody is "logged in" with Vipps. */
export function useVippsIdentity(): VippsIdentity | null {
  const [id, setId] = useState(current);
  useEffect(() => mockVipps.subscribe(() => setId(current)), []);
  return id;
}
