import type { ConsentRecord } from '@/api/ApiClient';

/** Demo user's consent log: everything accepted at onboarding, tips on. */
const seed = (): ConsentRecord[] => [
  { id: 'cr-1', terms: true, privacy: true, age: true, tips: true, createdAt: '2026-01-15T09:02:00Z' },
];

let rows = seed();

export const consentStore = {
  list: (): ConsentRecord[] => [...rows],
  setTips(on: boolean): ConsentRecord {
    const last = rows[0];
    const row: ConsentRecord = {
      id: `cr-${Date.now()}`,
      terms: last?.terms ?? true,
      privacy: last?.privacy ?? true,
      age: last?.age ?? true,
      tips: on,
      createdAt: new Date().toISOString(),
    };
    rows = [row, ...rows];
    return row;
  },
  _reset(): void {
    rows = seed();
  },
};
