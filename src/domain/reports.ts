import type { Report } from './types';

/** Where a report I sent is: Mottatt → Under behandling → Avgjort. */
export type ReportStage = 'received' | 'processing' | 'resolved';

/**
 * Mottatt = OPEN and nobody has picked it up; Under behandling = OPEN and claimed by a
 * moderator (reports.claimed_at); Avgjort = RESOLVED.
 */
export function reportStage(r: Pick<Report, 'status' | 'claimedAt'>): ReportStage {
  if (r.status === 'RESOLVED') return 'resolved';
  return r.claimedAt ? 'processing' : 'received';
}
