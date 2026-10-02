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
  | 'REVISION_PENDING'
  /** an accepted agreement that one of the parties called off */
  | 'CANCELLED';

export type ProposalEvent =
  | 'SEND'
  | 'WITHDRAW'
  | 'DECLINE'
  | 'ACCEPT'
  | 'REQUEST_REVISION'
  | 'SUBMIT_REVISION'
  | 'CONFIRM_REVISION'
  | 'CANCEL';

export type Actor = 'PROPOSER' | 'RECIPIENT';

/** `ANY` = either party may trigger the event. */
type Rule = { to: ProposalStatus; actor: Actor | 'ANY' };

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
    // either party can call off an agreement (Avlys avtalen)
    CANCEL: { to: 'CANCELLED', actor: 'ANY' },
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
  CANCELLED: {},
};

export const canTransition = (
  from: ProposalStatus,
  event: ProposalEvent,
  actor: Actor,
): boolean => {
  const rule = TABLE[from][event];
  return !!rule && (rule.actor === 'ANY' || rule.actor === actor);
};

export const transition = (
  from: ProposalStatus,
  event: ProposalEvent,
  actor: Actor,
): ProposalStatus => {
  const rule = TABLE[from][event];
  if (!rule || (rule.actor !== 'ANY' && rule.actor !== actor)) {
    throw new Error('Ugyldig endring av tilbudet.');
  }
  return rule.to;
};

export const isTerminal = (status: ProposalStatus): boolean =>
  status === 'WITHDRAWN' || status === 'DECLINED' || status === 'CANCELLED';
