import nb from '@/i18n/nb';

export type Milestone = { key: 'jobs' | 'fast' | 'top'; label: string; icon: 'checks' | 'zap' | 'star' };

const JOB_STEPS = [50, 25, 10, 5] as const;

/**
 * The badges a profile has earned, from numbers the profile already shows:
 * oppdrag fullført (highest step reached), a typical reply time within the
 * hour, and a high average over at least five vurderinger.
 */
export function milestonesFor(p: {
  completedTasks?: number;
  replyMinutes?: number | null;
  rating?: { average: number; count: number };
}): Milestone[] {
  const out: Milestone[] = [];
  const step = JOB_STEPS.find((n) => (p.completedTasks ?? 0) >= n);
  if (step) out.push({ key: 'jobs', label: nb.milestones.jobs(step), icon: 'checks' });
  if (p.replyMinutes != null && p.replyMinutes <= 60) out.push({ key: 'fast', label: nb.milestones.fast, icon: 'zap' });
  if (p.rating && p.rating.count >= 5 && p.rating.average >= 4.8) out.push({ key: 'top', label: nb.milestones.top, icon: 'star' });
  return out;
}
