import type { PendingReview } from '@/api/ApiClient';

/** Finished jobs the signed-in user still has to review (mirrors my_pending_reviews, 0072). */
let pending: PendingReview[] = [];

export const reviewDutyStore = {
  list: (): PendingReview[] => pending,
  /** tests: a job just finished */
  add: (p: PendingReview) => {
    pending = [...pending, p];
  },
  done: (proposalId: string) => {
    pending = pending.filter((p) => p.proposalId !== proposalId);
  },
  _reset: () => {
    pending = [];
  },
};
