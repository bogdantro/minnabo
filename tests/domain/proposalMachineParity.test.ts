import { canTransition, type ProposalEvent, type ProposalStatus } from '@/domain/proposalMachine';

/**
 * Parity guard: the plpgsql `proposal_next()` in
 * supabase/migrations/0003_rpc_realtime.sql must allow exactly the same
 * transitions as the TS state machine. This is a hand-maintained mirror of
 * that function — update BOTH when the rules change.
 */
type Actor = 'PROPOSER' | 'RECIPIENT';

function sqlProposalNext(
  from: ProposalStatus,
  event: ProposalEvent,
  actor: Actor,
): ProposalStatus | null {
  if (from === 'DRAFT' && event === 'SEND' && actor === 'PROPOSER') return 'SENT';
  if (from === 'SENT') {
    if (event === 'WITHDRAW' && actor === 'PROPOSER') return 'WITHDRAWN';
    if (event === 'DECLINE' && actor === 'RECIPIENT') return 'DECLINED';
    if (event === 'ACCEPT' && actor === 'RECIPIENT') return 'ACCEPTED';
    if (event === 'REQUEST_REVISION' && actor === 'RECIPIENT') return 'REVISION_PENDING';
  }
  if (from === 'ACCEPTED' && event === 'REQUEST_REVISION' && actor === 'RECIPIENT')
    return 'REVISION_PENDING';
  if (from === 'REVISION_PENDING') {
    if (event === 'SUBMIT_REVISION' && actor === 'PROPOSER') return 'SENT';
    if (event === 'CONFIRM_REVISION' && actor === 'PROPOSER') return 'ACCEPTED';
    if (event === 'WITHDRAW' && actor === 'PROPOSER') return 'WITHDRAWN';
    if (event === 'DECLINE' && actor === 'RECIPIENT') return 'DECLINED';
  }
  return null;
}

const STATUSES: ProposalStatus[] = [
  'DRAFT',
  'SENT',
  'WITHDRAWN',
  'DECLINED',
  'ACCEPTED',
  'REVISION_PENDING',
];
const EVENTS: ProposalEvent[] = [
  'SEND',
  'WITHDRAW',
  'DECLINE',
  'ACCEPT',
  'REQUEST_REVISION',
  'SUBMIT_REVISION',
  'CONFIRM_REVISION',
];
const ACTORS: Actor[] = ['PROPOSER', 'RECIPIENT'];

test('the SQL and TS proposal state machines allow the same transitions', () => {
  for (const from of STATUSES) {
    for (const event of EVENTS) {
      for (const actor of ACTORS) {
        const ts = canTransition(from, event, actor);
        const sql = sqlProposalNext(from, event, actor) !== null;
        expect(`${from}/${event}/${actor} → ts:${ts}`).toBe(
          `${from}/${event}/${actor} → ts:${sql}`,
        );
      }
    }
  }
});
