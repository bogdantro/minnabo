import type { MinNaboMessage } from '@/api/ApiClient';
import { UserError } from '@/lib/errors';

type Poll = { options: string[]; closed: boolean; votes: Map<string, number> };

let messages: MinNaboMessage[] = [];
const polls = new Map<string, Poll>();
let seq = 0;

/** The thread with «MinNabo» (0066). Empty until a test lets the admin send something. */
export const minnaboStore = {
  thread(me: string): MinNaboMessage[] {
    return messages.map((m) => {
      const poll = m.broadcastId ? polls.get(m.broadcastId) : undefined;
      if (!poll) return m;
      const myVote = poll.votes.get(me);
      const show = myVote !== undefined || poll.closed;
      return {
        ...m,
        pollOptions: poll.options,
        pollClosed: poll.closed,
        myVote,
        pollCounts: show ? poll.options.map((_, i) => [...poll.votes.values()].filter((v) => v === i + 1).length) : undefined,
      };
    });
  },
  /** Test helper: what the website's admin does. */
  adminSends(input: { body: string; kind?: MinNaboMessage['kind']; title?: string; options?: string[]; otherVotes?: number[] }): MinNaboMessage {
    const id = `mn-${++seq}`;
    const kind = input.kind ?? 'MESSAGE';
    const broadcastId = kind === 'MESSAGE' && !input.title ? undefined : `bc-${seq}`;
    if (kind === 'POLL' && broadcastId) {
      polls.set(broadcastId, {
        options: input.options ?? [],
        closed: false,
        votes: new Map((input.otherVotes ?? []).map((v, i) => [`other-${i}`, v])),
      });
    }
    const m: MinNaboMessage = { id, fromAdmin: true, body: input.body, createdAt: new Date().toISOString(), kind, title: input.title, broadcastId };
    messages = [...messages, m];
    return m;
  },
  reply(body: string): void {
    const text = body.trim();
    if (!text) throw new UserError('Skriv en melding.');
    messages = [...messages, { id: `mn-${++seq}`, fromAdmin: false, body: text, createdAt: new Date().toISOString(), kind: 'MESSAGE' }];
  },
  vote(broadcastId: string, option: number, me: string): void {
    const poll = polls.get(broadcastId);
    if (!poll) throw new UserError('Fant ikke spørsmålet.');
    if (poll.closed) throw new UserError('Avstemningen er avsluttet.');
    if (option < 1 || option > poll.options.length) throw new UserError('Ugyldig valg.');
    poll.votes.set(me, option);
  },
  markRead(): void {
    const now = new Date().toISOString();
    messages = messages.map((m) => (m.fromAdmin && !m.readAt ? { ...m, readAt: now } : m));
  },
  _reset(): void {
    messages = [];
    polls.clear();
    seq = 0;
  },
};
