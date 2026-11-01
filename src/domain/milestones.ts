import nb from '@/i18n/nb';

export type Milestone = {
  key: 'first' | 'jobs' | 'reliable' | 'local' | 'fast' | 'top' | 'recruiter';
  label: string;
  icon: 'sparkle' | 'checks' | 'hand' | 'home' | 'zap' | 'star' | 'gift';
};

const JOB_STEPS = [50, 25, 10, 5] as const;

/**
 * The nabo-merker a profile has earned, from numbers the profile already shows:
 *   «Første jobb» (1–4 done) → «5/10/25/50 oppdrag fullført» (highest step reached),
 *   «Møter alltid opp» (100 % over 5+ jobs, see domain/reliability),
 *   «Hjelper i nabolaget ditt» (done jobs, and the viewer lives in the same kommune),
 *   a typical reply time within the hour, a high average over at least five vurderinger,
 *   and «Verver» for someone who brought a neighbour to MinNabo.
 */
export function milestonesFor(p: {
  completedTasks?: number;
  replyMinutes?: number | null;
  rating?: { average: number; count: number };
  alwaysShowsUp?: boolean;
  /** the person looking lives in the same kommune (never true on your own profile) */
  sameKommune?: boolean;
  invitedCount?: number;
}): Milestone[] {
  const out: Milestone[] = [];
  const done = p.completedTasks ?? 0;
  const step = JOB_STEPS.find((n) => done >= n);
  if (step) out.push({ key: 'jobs', label: nb.milestones.jobs(step), icon: 'checks' });
  else if (done >= 1) out.push({ key: 'first', label: nb.milestones.first, icon: 'sparkle' });
  if (p.alwaysShowsUp) out.push({ key: 'reliable', label: nb.milestones.reliable, icon: 'hand' });
  if (p.sameKommune && done >= 1) out.push({ key: 'local', label: nb.milestones.local, icon: 'home' });
  if (p.replyMinutes != null && p.replyMinutes <= 60) out.push({ key: 'fast', label: nb.milestones.fast, icon: 'zap' });
  if (p.rating && p.rating.count >= 5 && p.rating.average >= 4.8) out.push({ key: 'top', label: nb.milestones.top, icon: 'star' });
  if ((p.invitedCount ?? 0) >= 1) out.push({ key: 'recruiter', label: nb.milestones.recruiter, icon: 'gift' });
  return out;
}
