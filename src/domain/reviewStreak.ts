import type { AgendaItem } from './types';

/** Below this many finished jobs a count says nothing ("1 av 1"), so it isn't shown. */
export const STREAK_MIN_JOBS = 2;

/**
 * «Du har vurdert 5 av 5 jobber» after a review. `justReviewed` counts the one sent a moment
 * ago, before Mine avtaler has caught up. Null when there are too few jobs to say anything.
 */
export function reviewStreak(items: AgendaItem[] | undefined, justReviewed?: string): { reviewed: number; total: number } | null {
  const finished = (items ?? []).filter((a) => a.fullyCompleted && !a.cancelled);
  if (finished.length < STREAK_MIN_JOBS) return null;
  const reviewed = finished.filter((a) => a.myRating != null || a.proposalId === justReviewed).length;
  return { reviewed, total: finished.length };
}
