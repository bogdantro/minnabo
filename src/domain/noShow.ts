import type { AgreementSnapshot, NoShowReason, NoShowReport, Proposal } from './types';

/**
 * «Hjelperen kom ikke» and the job-day states, mirroring 0074_no_show_rescue.sql.
 * The database is the rule; this decides what the app shows.
 */

/** The reasons the owner can pick, in the order shown. */
export const OWNER_REASONS: Exclude<NoShowReason, 'HELPER_CANCELLED'>[] = ['NO_SHOW', 'NO_REPLY', 'LATE'];

/** How long the helper has to explain. */
export const EXPLAIN_HOURS = 48;

/** Midnight (local time) of the job day: Fri 30 Oct 14:00 -> Fri 30 Oct 00:00. */
export function jobDayStart(scheduledAt: string): Date {
  const d = new Date(scheduledAt);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** From the morning of the job day; an avtale without a set time can be reported any time. */
export function noShowWindowOpen(a: Pick<AgreementSnapshot, 'scheduledAt'> | null | undefined, now = Date.now()): boolean {
  if (!a?.scheduledAt) return true;
  return now >= jobDayStart(a.scheduledAt).getTime();
}

/** The owner may use «Hjelperen kom ikke» on this avtale right now. */
export function canReportNoShow(
  p: Pick<Proposal, 'status' | 'toProfileId'> | undefined,
  a: Pick<AgreementSnapshot, 'scheduledAt' | 'cancelledAt'> | null | undefined,
  meId: string,
  finished: boolean,
  now = Date.now(),
): boolean {
  return !!p && !!a && p.status === 'ACCEPTED' && p.toProfileId === meId && !a.cancelledAt && !finished && noShowWindowOpen(a, now);
}

export type Attendance = 'none' | 'confirmed' | 'onTheWay' | 'arrived';

export function attendanceOf(a: Pick<AgreementSnapshot, 'helperConfirmedAt' | 'helperStatus'> | null | undefined): Attendance {
  if (a?.helperStatus === 'ARRIVED') return 'arrived';
  if (a?.helperStatus === 'ON_THE_WAY') return 'onTheWay';
  return a?.helperConfirmedAt ? 'confirmed' : 'none';
}

/** The job is today (local time). */
export function isJobDay(a: Pick<AgreementSnapshot, 'scheduledAt'> | null | undefined, now = new Date()): boolean {
  if (!a?.scheduledAt) return false;
  const d = new Date(a.scheduledAt);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** The helper can still explain (no answer yet, within 48 hours). */
export const canExplain = (r: Pick<NoShowReport, 'status' | 'countsAt' | 'iAmReported'>, now = Date.now()) =>
  r.iAmReported && r.status === 'PENDING' && Date.parse(r.countsAt) > now;

/** Hours left to explain, rounded up: 47 t. */
export const hoursLeft = (countsAt: string, now = Date.now()) => Math.max(0, Math.ceil((Date.parse(countsAt) - now) / 3_600_000));

/** "Teller fullt" / "Teller halvt" / "Teller ikke" – how the report weighs now. */
export function weightNow(r: Pick<NoShowReport, 'status' | 'weight' | 'countsAt'>, now = Date.now()): 0 | 0.5 | 1 {
  if (r.status === 'DISMISSED') return 0;
  if (r.status === 'DISPUTED') return 0.5;
  if (r.status === 'COUNTED' || Date.parse(r.countsAt) <= now) return r.weight >= 1 ? 1 : 0.5;
  return 0;
}
