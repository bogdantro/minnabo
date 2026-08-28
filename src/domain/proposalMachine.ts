/**
 * Pure proposal (tilbud) state machine (spec §12, §15).
 *
 *   DRAFT --SEND(proposer)--> SENT
 *   SENT  --WITHDRAW(proposer)--> WITHDRAWN
 *   SENT  --DECLINE(recipient)--> DECLINED
 *   SENT  --ACCEPT(recipient)--> ACCEPTED
 *   ACCEPTED --REQUEST_REVISION(recipient)--> REVISION_PENDING
 *   REVISION_PENDING --CONFIRM_REVISION(proposer)--> ACCEPTED
 *   REVISION_PENDING --DECLINE(recipient)--> DECLINED
 */

export type ProposalStatus =
  | 'DRAFT'
  | 'SENT'
  | 'WITHDRAWN'
  | 'DECLINED'
  | 'ACCEPTED'
  | 'REVISION_PENDING';

export type ProposalEvent =
  | 'SEND'
  | 'WITHDRAW'
  | 'DECLINE'
  | 'ACCEPT'
  | 'REQUEST_REVISION'
  | 'SUBMIT_REVISION'
  | 'CONFIRM_REVISION';

export type Actor = 'PROPOSER' | 'RECIPIENT';

type Rule = { to: ProposalStatus; actor: Actor };

const TABLE: Record<ProposalStatus, Partial<Record<ProposalEvent, Rule>>> = {
  DRAFT: {
    SEND: { to: 'SENT', actor: 'PROPOSER' },
  },
  SENT: {
    WITHDRAW: { to: 'WITHDRAWN', actor: 'PROPOSER' },
    DECLINE: { to: 'DECLINED', actor: 'RECIPIENT' },
    ACCEPT: { to: 'ACCEPTED', actor: 'RECIPIENT' },
    REQUEST_REVISION: { to: 'REVISION_PENDING', actor: 'RECIPIENT' },
  },
  ACCEPTED: {
    REQUEST_REVISION: { to: 'REVISION_PENDING', actor: 'RECIPIENT' },
  },
  REVISION_PENDING: {
    // proposer sends new terms -> back to the recipient for acceptance
    SUBMIT_REVISION: { to: 'SENT', actor: 'PROPOSER' },
    // or the proposer just confirms the requested change as-is
    CONFIRM_REVISION: { to: 'ACCEPTED', actor: 'PROPOSER' },
    WITHDRAW: { to: 'WITHDRAWN', actor: 'PROPOSER' },
    DECLINE: { to: 'DECLINED', actor: 'RECIPIENT' },
  },
  WITHDRAWN: {},
  DECLINED: {},
};

export const canTransition = (
  from: ProposalStatus,
  event: ProposalEvent,
  actor: Actor,
): boolean => {
  const rule = TABLE[from][event];
  return !!rule && rule.actor === actor;
};

export const transition = (
  from: ProposalStatus,
  event: ProposalEvent,
  actor: Actor,
): ProposalStatus => {
  const rule = TABLE[from][event];
  if (!rule || rule.actor !== actor) {
    throw new Error('Ugyldig endring av tilbudet.');
  }
  return rule.to;
};

export const isTerminal = (status: ProposalStatus): boolean =>
  status === 'WITHDRAWN' || status === 'DECLINED';
