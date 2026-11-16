/** Innboks folders and sorting (0109). */
import type { AgendaItem, Conversation } from '@/domain/types';
import { groupByListing, inFolder, isRequest, isSuspicious, rowStatus, sortInbox, waitingOnMe, waitingOnThem } from '@/domain/inboxModel';
import { suggestedReplies } from '@/domain/quickReplies';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const conv = (over: Partial<Conversation> = {}): Conversation =>
  ({
    id: 'c1',
    listing: { id: 'l1', title: 'Plenklipping', type: 'TASK_REQUEST', place: 'Sentrum' },
    counterpart: { id: 'u-kari', displayName: 'Kari Holm', initials: 'KH' },
    lastMessagePreview: 'Hei',
    lastMessageAt: hoursAgo(1),
    unread: false,
    statusTag: null,
    lastMessageMine: false,
    role: 'client',
    ...over,
  }) as Conversation;

const agendaItem = (over: Partial<AgendaItem> = {}): AgendaItem =>
  ({ proposalId: 'p1', listingId: 'l1', listingTitle: 'Plenklipping', counterpartId: 'u-kari', agreedAt: hoursAgo(48), fullyCompleted: false, role: 'CLIENT', cancelled: false, ...over }) as AgendaItem;

test('a conversation waits on me only after a day without my answer', () => {
  expect(waitingOnMe(conv({ lastMessageAt: hoursAgo(2) }), NOW)).toBe(false);
  expect(waitingOnMe(conv({ lastMessageAt: hoursAgo(30) }), NOW)).toBe(true);
  expect(waitingOnMe(conv({ lastMessageAt: hoursAgo(30), lastMessageMine: true }), NOW)).toBe(false);
  expect(waitingOnThem(conv({ lastMessageAt: hoursAgo(30), lastMessageMine: true }), NOW)).toBe(true);
});

test('a request is someone I have never written to, never an agreed job', () => {
  expect(isRequest(conv(), new Set())).toBe(true);
  expect(isRequest(conv(), new Set(['c1']))).toBe(false);
  expect(isRequest(conv({ statusTag: 'OFFER_ACCEPTED' }), new Set())).toBe(false);
});

test('a message about forskudd before an avtale is suspicious, but not after it', () => {
  const c = conv({ lastMessagePreview: 'Kan du vippse forskudd på 500 kr først?' });
  expect(isSuspicious(c, false)).toBe(true);
  expect(isSuspicious(c, true)).toBe(false);
  expect(isSuspicious(conv({ lastMessagePreview: 'Passer lørdag?' }), false)).toBe(false);
});

test('the row shows the avtale: its time, then «gi vurdering» when done and not reviewed', () => {
  const c = conv();
  expect(rowStatus(c, [agendaItem({ scheduledAt: hoursAgo(-20) })])?.kind).toBe('agreedAt');
  expect(rowStatus(c, [agendaItem({ fullyCompleted: true })])?.kind).toBe('review');
  expect(rowStatus(c, [agendaItem({ fullyCompleted: true, myRating: 5 })])?.kind).toBe('done');
  expect(rowStatus(conv({ statusTag: 'NEW_OFFER' }), [])?.kind).toBe('offer');
  // another neighbour's avtale on the same oppdrag is not this conversation's
  expect(rowStatus(c, [agendaItem({ counterpartId: 'u-other' })])).toBeNull();
  expect(inFolder('agreed', c, { now: NOW, agenda: [agendaItem()], written: new Set() })).toBe(true);
});

test('pinned conversations come first, then the newest', () => {
  const list = sortInbox([
    conv({ id: 'old', lastMessageAt: hoursAgo(50) }),
    conv({ id: 'new', lastMessageAt: hoursAgo(1) }),
    conv({ id: 'pin', lastMessageAt: hoursAgo(100), pinnedAt: hoursAgo(5) }),
  ]);
  expect(list.map((c) => c.id)).toEqual(['pin', 'new', 'old']);
});

test('several tilbud on one of my oppdrag are stacked, other rows stay single', () => {
  const items = groupByListing([
    conv({ id: 'a', counterpart: { id: 'u1', displayName: 'A' } as Conversation['counterpart'] }),
    conv({ id: 'b', counterpart: { id: 'u2', displayName: 'B' } as Conversation['counterpart'] }),
    conv({ id: 'c', listing: { id: 'l2', title: 'Flytting', type: 'TASK_REQUEST', place: '' } }),
    conv({ id: 'd', role: 'helper', listing: { id: 'l3', title: 'Hjelp', type: 'TASK_REQUEST', place: '' } }),
  ]);
  expect(items.map((i) => (i.kind === 'group' ? `g:${i.convs.length}` : i.c.id))).toEqual(['g:2', 'c', 'd']);
});

test('suggested replies fit the last message, with nothing for plain chat', () => {
  expect(suggestedReplies('Tusen takk for hjelpen!')).toContain('Bare hyggelig!');
  expect(suggestedReplies('Når passer det for deg?')).toContain('Det passer fint!');
  expect(suggestedReplies('Kan du ta med stige?')).toContain('Ja, det kan jeg.');
  expect(suggestedReplies('Fint vær i dag')).toEqual([]);
});
