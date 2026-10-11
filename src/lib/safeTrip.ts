import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import nb from '@/i18n/nb';
import { cancelLocal, scheduleLocalAt } from './notifications';

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
  /** the local "Er du trygt ferdig?" reminder at dueAt */
  reminderId?: string | null;
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

// The reminder at the deadline goes to the person on the trip (a local notification –
// the trip lives on this phone only). Rescheduled on Forleng, cancelled on Stopp.
const isActive = (trip: SafeTrip) => !!current && current.startedAt === trip.startedAt;

async function remind(trip: SafeTrip) {
  await cancelLocal(trip.reminderId);
  if (!isActive(trip)) return;
  const at = new Date(trip.dueAt);
  const id = at.getTime() > Date.now()
    ? await scheduleLocalAt(at, nb.tryggTur.dueTitle, nb.tryggTur.dueBody(trip.label), '/sikkerhet')
    : null;
  // stopped (or replaced) while scheduling: don't leave a reminder behind
  if (!isActive(trip) || current!.dueAt !== trip.dueAt) {
    await cancelLocal(id);
    return;
  }
  current = { ...current!, reminderId: id };
  persist();
}

export const safeTrip = {
  get: () => current,
  start(trip: SafeTrip) {
    const old = current?.reminderId;
    const next: SafeTrip = { ...trip, reminderId: null };
    current = next;
    persist();
    emit();
    void cancelLocal(old).then(() => remind(next));
  },
  /** push the expected end time */
  extend(dueAt: string) {
    if (!current) return;
    current = { ...current, dueAt };
    persist();
    emit();
    void remind(current);
  },
  /** the person checked back in safely */
  checkIn() {
    const id = current?.reminderId;
    current = null;
    persist();
    emit();
    void cancelLocal(id);
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
