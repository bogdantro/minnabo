import { useSyncExternalStore } from 'react';
import type { Report } from '@/domain/types';

let blocked = new Set<string>();
let reports: Report[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const safetyStore = {
  isBlocked: (profileId: string) => blocked.has(profileId),
  listBlocked: () => [...blocked],
  toggleBlock: (profileId: string) => {
    const next = new Set(blocked);
    next.has(profileId) ? next.delete(profileId) : next.add(profileId);
    blocked = next;
    emit();
  },
  submitReport: (input: Omit<Report, 'id' | 'createdAt'>) => {
    const report: Report = { ...input, id: `rep-${Date.now()}`, createdAt: new Date().toISOString() };
    reports = [report, ...reports];
    emit();
    return report;
  },
  listReports: () => [...reports],
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  _reset: () => {
    blocked = new Set();
    reports = [];
    emit();
  },
};

export function useIsBlocked(profileId: string): [boolean, () => void] {
  const isBlocked = useSyncExternalStore(
    safetyStore.subscribe,
    () => safetyStore.isBlocked(profileId),
    () => safetyStore.isBlocked(profileId),
  );
  return [isBlocked, () => safetyStore.toggleBlock(profileId)];
}
