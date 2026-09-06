import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@/auth/session';
import { useProfile } from '@/api/queries';
import { expandKommuner } from '@/data/kommuner';

/**
 * The "reach" preference: how far past the signed-in user's own kommune the
 * app's location-scoped screens should look. 0 = own kommune only, 1 = direct
 * neighbours, 2 = neighbours-of-neighbours. Persisted in AsyncStorage; combined
 * with the profile kommune by `useLocationScope()` into a municipality
 * allow-list. Kommune is MinNabo's location unit — no distance/coordinates.
 *
 * Mirrors the singleton + listener + hook pattern of `src/lib/neighbourhood.ts`.
 */
const KEY = 'minnabo.locationScope.reach';

export type Reach = 0 | 1 | 2;

let reach: Reach = 0;
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function coerce(raw: string | null): Reach {
  const n = Number(raw);
  return n === 1 || n === 2 ? (n as Reach) : 0;
}

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    reach = coerce(await AsyncStorage.getItem(KEY));
  } catch {
    reach = 0;
  }
  emit();
}

export const locationScope = {
  getReach: (): Reach => reach,
  setReach(r: Reach) {
    reach = r;
    AsyncStorage.setItem(KEY, String(r)).catch(() => undefined);
    emit();
  },
  _reset() {
    reach = 0;
    hydrated = false;
    emit();
  },
};

export function useLocationScope(): {
  municipality?: string;
  municipalities: string[];
  reach: Reach;
  setReach: (r: Reach) => void;
  ready: boolean;
} {
  const { userId } = useSession();
  const { data: profile, isLoading } = useProfile(userId ?? '');
  const [r, setR] = useState<Reach>(reach);

  useEffect(() => {
    void hydrate();
    const sync = () => setR(reach);
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const municipality = profile?.location.municipality || undefined;
  const municipalities = useMemo(
    () => expandKommuner(municipality, r),
    [municipality, r],
  );
  return {
    municipality,
    municipalities,
    reach: r,
    setReach: locationScope.setReach,
    ready: !!userId && !isLoading,
  };
}
