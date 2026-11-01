import type { NoShowReport } from '@/domain/types';

/** No-show reports and the tilbud pause (mirrors 0074). */
let reports: NoShowReport[] = [];
let pauseUntil: string | null = null;

export const noShowStore = {
  list: () => reports,
  get: (id: string) => reports.find((r) => r.id === id),
  add: (r: NoShowReport) => {
    reports = [...reports, r];
  },
  patch: (id: string, patch: Partial<NoShowReport>) => {
    reports = reports.map((r) => (r.id === id ? { ...r, ...patch } : r));
  },
  pauseUntil: () => pauseUntil,
  /** tests: two no-shows in 90 days */
  setPause: (iso: string | null) => {
    pauseUntil = iso;
  },
  _reset: () => {
    reports = [];
    pauseUntil = null;
  },
};
