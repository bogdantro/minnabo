import type { Proposal } from './types';

/** An unanswered offer goes stale after a week. */
export const PROPOSAL_TTL_DAYS = 7;

export function isProposalExpired(proposal: Proposal, now: Date = new Date()): boolean {
  if (proposal.status !== 'SENT' && proposal.status !== 'REVISION_PENDING') return false;
  const ageDays = (now.getTime() - Date.parse(proposal.createdAt)) / 86_400_000;
  return ageDays > PROPOSAL_TTL_DAYS;
}

export function proposalExpiresInDays(proposal: Proposal, now: Date = new Date()): number {
  const ageDays = (now.getTime() - Date.parse(proposal.createdAt)) / 86_400_000;
  return Math.ceil(PROPOSAL_TTL_DAYS - ageDays);
}
