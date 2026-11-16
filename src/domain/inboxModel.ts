/**
 * Innboks sorting and folders (0109), kept free of React so it can be tested:
 *   «Venter på deg» / «Venter på dem», Forespørsler, Mistenkelig, Avtalt / Fullført, snoozed, pinned first,
 *   and several chats about one oppdrag grouped together.
 */
import type { AgendaItem, Conversation } from './types';
import { scamSignals } from './chatSafety';

/** A conversation counts as waiting after a day without an answer. */
export const WAIT_MS = 24 * 60 * 60 * 1000;

export type InboxFolder = 'waitingMe' | 'waitingThem' | 'agreed' | 'done' | 'requests' | 'suspicious' | 'snoozed';

/** The avtale behind a conversation: the same oppdrag and the same neighbour. */
export function agendaFor(c: Conversation, agenda: AgendaItem[]): AgendaItem | undefined {
  return agenda.find((a) => !a.cancelled && a.listingId === c.listing.id && a.counterpartId === c.counterpart.id);
}

export const isSnoozed = (c: Conversation, now: number) => !!c.snoozedUntil && Date.parse(c.snoozedUntil) > now;

/** The other person wrote last, more than a day ago. */
export const waitingOnMe = (c: Conversation, now: number) =>
  c.lastMessageMine === false && now - Date.parse(c.lastMessageAt) > WAIT_MS && c.statusTag !== 'OFFER_ACCEPTED';

/** I wrote last, more than a day ago. */
export const waitingOnThem = (c: Conversation, now: number) => c.lastMessageMine === true && now - Date.parse(c.lastMessageAt) > WAIT_MS;

/** Someone I have never written to, about something that isn't agreed. */
export const isRequest = (c: Conversation, written: Set<string>) => !written.has(c.id) && c.statusTag !== 'OFFER_ACCEPTED' && !c.notice;

/** The newest message from the other person mentions forskudd, an account number or codes before an avtale. */
export const isSuspicious = (c: Conversation, agreed: boolean) =>
  c.lastMessageMine === false && scamSignals(c.lastMessagePreview, agreed).some((s) => s === 'MONEY' || s === 'ACCOUNT' || s === 'CODES');

export function inFolder(folder: InboxFolder, c: Conversation, ctx: { now: number; agenda: AgendaItem[]; written: Set<string> }): boolean {
  const a = agendaFor(c, ctx.agenda);
  switch (folder) {
    case 'waitingMe':
      return waitingOnMe(c, ctx.now);
    case 'waitingThem':
      return waitingOnThem(c, ctx.now);
    case 'agreed':
      return !!a && !a.fullyCompleted;
    case 'done':
      return !!a && a.fullyCompleted;
    case 'requests':
      return isRequest(c, ctx.written);
    case 'suspicious':
      return isSuspicious(c, !!a);
    case 'snoozed':
      return isSnoozed(c, ctx.now);
  }
}

/** The status on a row: the avtale's time, «Fullført – gi vurdering», or a waiting tilbud. */
export function rowStatus(c: Conversation, agenda: AgendaItem[]): { kind: 'agreedAt' | 'agreed' | 'review' | 'done' | 'offer'; at?: string } | null {
  const a = agendaFor(c, agenda);
  if (a?.fullyCompleted) return a.myRating ? { kind: 'done' } : { kind: 'review' };
  if (a) return a.scheduledAt ? { kind: 'agreedAt', at: a.scheduledAt } : { kind: 'agreed' };
  if (c.statusTag === 'NEW_OFFER') return { kind: 'offer' };
  return null;
}

/** Pinned first (newest pin on top), then the newest message. */
export function sortInbox(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    const pa = a.pinnedAt ? Date.parse(a.pinnedAt) : 0;
    const pb = b.pinnedAt ? Date.parse(b.pinnedAt) : 0;
    if (pa || pb) return pb - pa;
    return Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt);
  });
}

export type InboxItem = { kind: 'conv'; c: Conversation } | { kind: 'group'; listingId: string; title: string; convs: Conversation[] };

/**
 * Several tilbud on one of my oppdrag become one stacked row (newest first inside); everything else stays a
 * row of its own. Pinned conversations are never folded into a group.
 */
export function groupByListing(list: Conversation[]): InboxItem[] {
  const byListing = new Map<string, Conversation[]>();
  for (const c of list) {
    if (c.role !== 'client' || !c.listing.id || c.listing.type !== 'TASK_REQUEST' || c.pinnedAt) continue;
    byListing.set(c.listing.id, [...(byListing.get(c.listing.id) ?? []), c]);
  }
  const out: InboxItem[] = [];
  const placed = new Set<string>();
  for (const c of list) {
    const group = c.listing.id ? byListing.get(c.listing.id) : undefined;
    if (group && group.length > 1 && !c.pinnedAt) {
      if (placed.has(c.listing.id)) continue;
      placed.add(c.listing.id);
      out.push({ kind: 'group', listingId: c.listing.id, title: c.listing.title, convs: group });
    } else out.push({ kind: 'conv', c });
  }
  return out;
}

/** «Siste uke» / «Siste måned» on a search. */
export const withinDays = (iso: string, days: number, now: number) => now - Date.parse(iso) <= days * 86_400_000;
