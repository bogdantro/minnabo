import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@/auth/session';
import { useProfile, useUpdateProfile } from '@/api/queries';
import { expandKommuner } from '@/data/kommuner';

/**
 * The "reach" preference: how far past the signed-in user's own kommune the
 * app's location-scoped screens should look. 0 = own kommune only, 1 = direct
 * neighbours, 2 = neighbours-of-neighbours. Persisted in AsyncStorage; combined
 * with the profile kommune by `useLocationScope()` into a municipality
 * allow-list. Kommune is MinNabo's location unit — no distance/coordinates.
 *
 * Without a backend session (the mock Vipps login) the kommune lives here too,
 * so location-scoped screens still work before anything is saved.
 *
 * Mirrors the singleton + listener + hook pattern of `src/lib/neighbourhood.ts`.
 */
const KEY = 'minnabo.locationScope.reach';
const KOMMUNE_KEY = 'minnabo.locationScope.kommune';

export type Reach = 0 | 1 | 2;

let reach: Reach = 0;
let localKommune: string | undefined;
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
    localKommune = (await AsyncStorage.getItem(KOMMUNE_KEY)) || undefined;
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
  /** Kommune for a session with no backend user (mock login). */
  setLocalKommune(k: string) {
    localKommune = k;
    AsyncStorage.setItem(KOMMUNE_KEY, k).catch(() => undefined);
    emit();
  },
  _reset() {
    reach = 0;
    localKommune = undefined;
    hydrated = false;
    emit();
  },
};

export function useLocationScope(): {
  municipality?: string;
  municipalities: string[];
  reach: Reach;
  setReach: (r: Reach) => void;
  /** Change kommune: saved on the profile, or locally without a backend user. */
  setKommune: (k: string) => void;
  ready: boolean;
} {
  const { userId } = useSession();
  const { data: profile, isLoading } = useProfile(userId ?? '');
  const update = useUpdateProfile();
  const [r, setR] = useState<Reach>(reach);
  const [local, setLocal] = useState(localKommune);

  useEffect(() => {
    void hydrate();
    const sync = () => {
      setR(reach);
      setLocal(localKommune);
    };
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const municipality = (userId ? profile?.location.municipality : local) || undefined;
  const municipalities = useMemo(
    () => expandKommuner(municipality, r),
    [municipality, r],
  );
  return {
    municipality,
    municipalities,
    reach: r,
    setReach: locationScope.setReach,
    setKommune: (k) => {
      if (k === municipality) return;
      if (userId) update.mutate({ municipality: k, place: k });
      else locationScope.setLocalKommune(k);
    },
    ready: !userId || !isLoading,
  };
}
