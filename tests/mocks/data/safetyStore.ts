import { useSyncExternalStore } from 'react';
import type { Report } from '@/domain/types';

const SEED_REPORTS: Report[] = [
  {
    id: 'rep-seed-1',
    targetType: 'LISTING',
    targetId: 'l-mont-kjokken',
    reason: 'Svindel eller falsk oppføring',
    details: 'Prisen virker urealistisk lav og profilen er ny.',
    byProfileId: 'u-emma',
    createdAt: '2026-08-25T11:00:00Z',
  },
  {
    id: 'rep-seed-2',
    targetType: 'MESSAGE',
    targetId: 'm-x',
    reason: 'Upassende oppførsel',
    byProfileId: 'u-martin',
    createdAt: '2026-08-24T16:30:00Z',
  },
];

let blocked = new Set<string>();
let reports: Report[] = [...SEED_REPORTS];
let resolved = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};

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
  isResolved: (id: string) => resolved.has(id),
  resolveReport: (id: string) => {
    resolved = new Set(resolved).add(id);
    emit();
  },
  reopenReport: (id: string) => {
    const next = new Set(resolved);
    next.delete(id);
    resolved = next;
    emit();
  },
  openReportCount: () => reports.filter((r) => !resolved.has(r.id)).length,
  version: () => version,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  _reset: () => {
    blocked = new Set();
    reports = [...SEED_REPORTS];
    resolved = new Set();
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
