import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'minnabo.safeTrip.v1';

export type SafeTrip = {
  /** the agreement this trip is tied to */
  proposalId: string;
  /** short label shown in the banner, e.g. the counterpart's name */
  label: string;
  startedAt: string;
  /** ISO time the person expects to have checked back in by */
  dueAt: string;
  /** names of the contacts who'd be alerted */
  contactNames: string[];
  /** Sikkerhet card details: job + approximate area */
  job?: string;
  place?: string;
};

let current: SafeTrip | null = null;
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    current = raw ? (JSON.parse(raw) as SafeTrip) : null;
  } catch {
    current = null;
  }
  emit();
}

function persist() {
  if (current) AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => undefined);
  else AsyncStorage.removeItem(KEY).catch(() => undefined);
}

export const safeTrip = {
  get: () => current,
  start(trip: SafeTrip) {
    current = trip;
    persist();
    emit();
  },
  /** push the expected end time */
  extend(dueAt: string) {
    if (!current) return;
    current = { ...current, dueAt };
    persist();
    emit();
  },
  /** the person checked back in safely */
  checkIn() {
    current = null;
    persist();
    emit();
  },
  _reset() {
    current = null;
    hydrated = false;
    emit();
  },
};

export function useSafeTrip(): {
  trip: SafeTrip | null;
  overdue: boolean;
  start: (trip: SafeTrip) => void;
  extend: (dueAt: string) => void;
  checkIn: () => void;
} {
  const [trip, setTrip] = useState(current);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void hydrate();
    const sync = () => setTrip(current ? { ...current } : null);
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  // Re-render once a minute so `overdue` and any countdown stay current.
  useEffect(() => {
    if (!trip) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [trip]);

  return {
    trip,
    overdue: !!trip && now > Date.parse(trip.dueAt),
    start: safeTrip.start,
    extend: safeTrip.extend,
    checkIn: safeTrip.checkIn,
  };
}
