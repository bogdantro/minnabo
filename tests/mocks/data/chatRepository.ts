import type {
  AgreementSnapshot,
  Conversation,
  Message,
  Proposal,
} from '@/domain/types';
import { transition, type ProposalEvent, type Actor } from '@/domain/proposalMachine';
import { UserError } from '@/lib/errors';
import nb from '@/i18n/nb';
import { safetyStore } from './safetyStore';
import { repositories } from './repositories';
import {
  conversations as seedConversations,
  messagesByConversation as seedMessages,
  proposals as seedProposals,
  agreements as seedAgreements,
  CURRENT_USER_ID,
} from './seedChat';

let conversations: Conversation[] = clone(seedConversations);
let messages: Record<string, Message[]> = clone(seedMessages);
let proposals: Proposal[] = clone(seedProposals);
let agreements: AgreementSnapshot[] = clone(seedAgreements);

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

let idSeq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idSeq++}`;

export const chatRepository = {
  currentUserId: CURRENT_USER_ID,

  listConversations(opts?: { unreadOnly?: boolean; query?: string }): Conversation[] {
    let result = [...conversations]
      .map((c) => {
        const last = [...(messages[c.id] ?? [])].reverse().find((m) => m.kind !== 'SYSTEM');
        return { ...c, lastMessageDelivery: last && last.authorProfileId === CURRENT_USER_ID ? last.delivery : undefined };
      })
      .filter((c) => !safetyStore.isBlocked(c.counterpart.id))
      .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
    if (opts?.unreadOnly) result = result.filter((c) => c.unread);
    if (opts?.query?.trim()) {
      const q = opts.query.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.counterpart.displayName.toLowerCase().includes(q) ||
          c.listing.title.toLowerCase().includes(q) ||
          c.lastMessagePreview.toLowerCase().includes(q),
      );
    }
    return result;
  },

  getConversation(id: string): Conversation | undefined {
    return conversations.find((c) => c.id === id);
  },

  /** Open (or reuse) a conversation with the owner of a listing. */
  findOrCreateConversationForListing(listingId: string): Conversation {
    const existing = conversations.find((c) => c.listing.id === listingId);
    if (existing) return existing;

    const listing = repositories.listings.get(listingId);
    if (!listing) throw new UserError('Fant ikke oppføringen.');
    if (listing.owner.id === CURRENT_USER_ID) {
      throw new UserError('Du kan ikke kontakte deg selv.');
    }

    const conv: Conversation = {
      id: nextId('c'),
      listing: {
        id: listing.id,
        title: listing.title,
        type: listing.type,
        place: listing.location.place,
        imageUrl: listing.images[0]?.url,
      },
      counterpart: { ...listing.owner },
      lastMessagePreview: '',
      lastMessageAt: new Date().toISOString(),
      unread: false,
      statusTag: null,
    };
    conversations = [conv, ...conversations];
    messages[conv.id] = [];
    return conv;
  },

  getMessages(conversationId: string): Message[] {
    return [...(messages[conversationId] ?? [])].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    );
  },

  getProposal(id: string): Proposal | undefined {
    return proposals.find((p) => p.id === id);
  },

  /** Proposals sent to the current user, newest first, grouped-friendly. */
  listReceivedProposals(): Proposal[] {
    return proposals
      .filter((p) => p.toProfileId === CURRENT_USER_ID)
      .filter((p) => p.status === 'SENT' || p.status === 'REVISION_PENDING' || p.status === 'ACCEPTED')
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },

  proposalsForListing(listingId: string): Proposal[] {
    return proposals
      .filter((p) => p.listingId === listingId)
      .sort((a, b) => a.price.amountMinor - b.price.amountMinor);
  },

  /**
   * Revision flow. If the current user is the recipient this is a
   * "request a change" (→ REVISION_PENDING); if they are the proposer it is
   * "submit revised terms" (→ SENT). Mirrors the `revise_proposal` RPC.
   */
  reviseProposal(
    proposalId: string,
    patch: { priceAmountMinor?: number; scheduledText?: string; message?: string; caveats?: string },
  ): Proposal {
    const existing = chatRepository.getProposal(proposalId);
    if (!existing) throw new UserError('Fant ikke tilbudet.');

    const isRecipient = existing.toProfileId === CURRENT_USER_ID;
    const nextStatus = isRecipient
      ? transition(existing.status, 'REQUEST_REVISION', 'RECIPIENT')
      : transition(existing.status, 'SUBMIT_REVISION', 'PROPOSER');

    const updated: Proposal = {
      ...existing,
      status: nextStatus,
      price:
        !isRecipient && patch.priceAmountMinor
          ? { amountMinor: patch.priceAmountMinor, currency: 'NOK' }
          : existing.price,
      scheduledText: !isRecipient ? patch.scheduledText ?? existing.scheduledText : existing.scheduledText,
      caveats: !isRecipient ? patch.caveats ?? existing.caveats : existing.caveats,
    };
    proposals = proposals.map((p) => (p.id === proposalId ? updated : p));
    if (isRecipient && patch.message?.trim()) {
      chatRepository.sendMessage(updated.conversationId, patch.message.trim());
    } else {
      pushSystem(updated.conversationId, nb.tilbud.revisionSent);
    }
    return updated;
  },

  /** Tilbud the current user has sent, newest first. */
  sentProposals(): Proposal[] {
    return proposals
      .filter((p) => p.fromProfileId === CURRENT_USER_ID)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },

  markProposalSeen(proposalId: string): void {
    proposals = proposals.map((p) =>
      p.id === proposalId && p.toProfileId === CURRENT_USER_ID && !p.seenAt
        ? { ...p, seenAt: new Date().toISOString() }
        : p,
    );
  },

  /** The sender changes an open tilbud; it goes back to SENT. */
  editProposal(
    proposalId: string,
    patch: {
      priceAmountMinor: number;
      scheduledText?: string;
      scheduledAt?: string | null;
      durationText?: string;
      message?: string;
      caveats?: string;
    },
  ): Proposal {
    const existing = chatRepository.getProposal(proposalId);
    if (!existing) throw new UserError('Fant ikke tilbudet.');
    if (existing.fromProfileId !== CURRENT_USER_ID) throw new UserError('Ikke tilgang.');
    if (existing.status !== 'SENT' && existing.status !== 'REVISION_PENDING') throw new UserError('Tilbudet kan ikke endres nå.');
    const updated: Proposal = {
      ...existing,
      status: 'SENT',
      price: { amountMinor: patch.priceAmountMinor, currency: 'NOK' },
      scheduledText: patch.scheduledText?.trim() || undefined,
      scheduledAt: patch.scheduledAt === undefined ? existing.scheduledAt : patch.scheduledAt ?? undefined,
      durationText: patch.durationText === undefined ? existing.durationText : patch.durationText || undefined,
      seenAt: undefined,
      message: patch.message?.trim() || undefined,
      caveats: patch.caveats?.trim() || undefined,
    };
    proposals = proposals.map((p) => (p.id === proposalId ? updated : p));
    pushSystem(updated.conversationId, nb.tilbud.edited);
    return updated;
  },

  toggleReaction(conversationId: string, messageId: string, emoji: string): Message[] {
    const list = messages[conversationId] ?? [];
    messages[conversationId] = list.map((m) => {
      if (m.id !== messageId) return m;
      const current = { ...(m.reactions ?? {}) };
      const people = new Set(current[emoji] ?? []);
      if (people.has(CURRENT_USER_ID)) people.delete(CURRENT_USER_ID);
      else people.add(CURRENT_USER_ID);
      if (people.size === 0) delete current[emoji];
      else current[emoji] = [...people];
      return { ...m, reactions: Object.keys(current).length ? current : undefined };
    });
    return chatRepository.getMessages(conversationId);
  },

  /** Pin one message (or clear the pin with null). Only one pin per conversation. */
  setPinnedMessage(conversationId: string, messageId: string | null): Message[] {
    const list = messages[conversationId] ?? [];
    messages[conversationId] = list.map((m) => ({
      ...m,
      pinned: messageId != null && m.id === messageId,
    }));
    return chatRepository.getMessages(conversationId);
  },

  markRead(conversationId: string): void {
    conversations = conversations.map((c) =>
      c.id === conversationId ? { ...c, unread: false } : c,
    );
    // Reading the thread marks the counterpart's messages as read, and — since
    // the seeded counterpart is treated as present — catches your own sent
    // messages up to READ too, so the delivery ticks reflect a live thread.
    const list = messages[conversationId] ?? [];
    messages[conversationId] = list.map((m) =>
      m.kind === 'SYSTEM' || m.delivery === 'READ' ? m : { ...m, delivery: 'READ' },
    );
  },

  sendMessage(conversationId: string, text: string): Message {
    const msg: Message = {
      id: nextId('m'),
      conversationId,
      authorProfileId: CURRENT_USER_ID,
      text,
      kind: 'TEXT',
      createdAt: new Date().toISOString(),
      delivery: 'SENT',
    };
    messages[conversationId] = [...(messages[conversationId] ?? []), msg];
    touchConversation(conversationId, text, true);
    return msg;
  },

  /** Test helper: a message arriving from the other participant. */
  _receive(conversationId: string, text: string, authorProfileId: string): Message {
    const msg: Message = {
      id: nextId('m'),
      conversationId,
      authorProfileId,
      text,
      kind: 'TEXT',
      createdAt: new Date().toISOString(),
      delivery: 'READ',
    };
    messages[conversationId] = [...(messages[conversationId] ?? []), msg];
    touchConversation(conversationId, text, false);
    return msg;
  },

  sendAttachment(conversationId: string, attachmentUrl: string): Message {
    const msg: Message = {
      id: nextId('m'),
      conversationId,
      authorProfileId: CURRENT_USER_ID,
      text: '',
      kind: 'IMAGE',
      attachmentUrl,
      createdAt: new Date().toISOString(),
      delivery: 'SENT',
    };
    messages[conversationId] = [...(messages[conversationId] ?? []), msg];
    touchConversation(conversationId, '📷 Bilde', true);
    return msg;
  },

  sendProposal(input: {
    conversationId: string;
    listingId: string;
    priceAmountMinor: number;
    message?: string;
    scheduledText?: string;
    scheduledAt?: string | null;
    durationText?: string;
    caveats?: string;
  }): Proposal {
    const conv = chatRepository.getConversation(input.conversationId);
    const proposal: Proposal = {
      id: nextId('p'),
      listingId: input.listingId,
      conversationId: input.conversationId,
      fromProfileId: CURRENT_USER_ID,
      toProfileId: conv?.counterpart.id ?? 'unknown',
      price: { amountMinor: input.priceAmountMinor, currency: 'NOK' },
      message: input.message,
      scheduledText: input.scheduledText,
      scheduledAt: input.scheduledAt ?? undefined,
      durationText: input.durationText || undefined,
      caveats: input.caveats,
      status: 'SENT',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    };
    proposals = [...proposals, proposal];
    const msg: Message = {
      id: nextId('m'),
      conversationId: input.conversationId,
      authorProfileId: CURRENT_USER_ID,
      text: '',
      kind: 'PROPOSAL',
      proposalId: proposal.id,
      createdAt: proposal.createdAt,
      delivery: 'SENT',
    };
    messages[input.conversationId] = [...(messages[input.conversationId] ?? []), msg];
    touchConversation(input.conversationId, `Du ${nb.chat.systemOfferSent}`);
    return proposal;
  },

  /**
   * Instant book: for offers where the helper opted in, skip the proposal
   * round-trip — open the conversation, auto-accept a proposal at the offer's
   * price, and return the resulting agreement's proposal id.
   */
  instantBook(listingId: string): { proposalId: string } {
    const listing = repositories.listings.get(listingId);
    if (!listing) throw new UserError('Fant ikke oppføringen.');
    if (!listing.offer?.instantBook) throw new UserError('Direktebooking er ikke tilgjengelig.');

    const conv = chatRepository.findOrCreateConversationForListing(listingId);
    const proposal: Proposal = {
      id: nextId('p'),
      listingId,
      conversationId: conv.id,
      fromProfileId: listing.owner.id,
      toProfileId: CURRENT_USER_ID,
      price: listing.price ?? { amountMinor: 0, currency: 'NOK' },
      scheduledText: listing.offer.availabilityText,
      status: 'SENT',
      createdAt: new Date().toISOString(),
    };
    proposals = [...proposals, proposal];
    chatRepository.respondToProposal(proposal.id, 'ACCEPT', 'RECIPIENT');
    return { proposalId: proposal.id };
  },

  respondToProposal(
    proposalId: string,
    event: ProposalEvent,
    actor: Actor,
  ): { proposal: Proposal; agreement?: AgreementSnapshot } {
    const existing = chatRepository.getProposal(proposalId);
    if (!existing) throw new UserError('Fant ikke tilbudet.');

    const nextStatus = transition(existing.status, event, actor);
    const updated: Proposal = {
      ...existing,
      status: nextStatus,
      respondedAt: nextStatus === 'ACCEPTED' || nextStatus === 'DECLINED' ? new Date().toISOString() : existing.respondedAt,
    };
    proposals = proposals.map((p) => (p.id === proposalId ? updated : p));

    let systemText: string | null = null;
    let agreement: AgreementSnapshot | undefined;

    if (nextStatus === 'ACCEPTED') {
      // the oppdrag is taken: out of the feed and searches (0047)
      repositories.listings.setStatus(updated.listingId, 'AGREED');
      systemText = nb.chat.offerAccepted;
      const listing = repositories.listings.get(updated.listingId);
      agreement = {
        proposalId,
        listingId: updated.listingId,
        price: updated.price,
        scheduledText: updated.scheduledText,
        scheduledAt: updated.scheduledAt,
        durationText: updated.durationText,
        description:
          listing?.task?.description ?? listing?.offer?.about ?? updated.message ?? '',
        caveats: updated.caveats,
        agreedAt: new Date().toISOString(),
      };
      agreements = [...agreements.filter((a) => a.proposalId !== proposalId), agreement];
      setStatusTag(updated.conversationId, 'OFFER_ACCEPTED');
    } else if (nextStatus === 'DECLINED') {
      systemText = nb.chat.offerDeclined;
    } else if (nextStatus === 'WITHDRAWN') {
      systemText = nb.chat.offerWithdrawn;
    }

    if (systemText) {
      const sys: Message = {
        id: nextId('m'),
        conversationId: updated.conversationId,
        authorProfileId: 'system',
        text: systemText,
        kind: 'SYSTEM',
        createdAt: new Date().toISOString(),
        delivery: 'READ',
      };
      messages[updated.conversationId] = [
        ...(messages[updated.conversationId] ?? []),
        sys,
      ];
      touchConversation(updated.conversationId, systemText);
    }

    return { proposal: updated, agreement };
  },

  getAgreementForConversation(conversationId: string): AgreementSnapshot | undefined {
    const convProposalIds = new Set(
      proposals.filter((p) => p.conversationId === conversationId).map((p) => p.id),
    );
    // Any proposal in this conversation that has a snapshot (survives revision churn).
    return agreements.find((a) => convProposalIds.has(a.proposalId));
  },

  cancelAgreement(proposalId: string, reason?: string): Proposal {
    const existing = chatRepository.getProposal(proposalId);
    if (!existing) throw new UserError('Fant ikke tilbudet.');
    const actor = existing.fromProfileId === CURRENT_USER_ID ? 'PROPOSER' : 'RECIPIENT';
    const updated: Proposal = { ...existing, status: transition(existing.status, 'CANCEL', actor) };
    // the avtale is off: the oppdrag is looking for help again
    repositories.listings.setStatus(updated.listingId, 'RECEIVING_OFFERS');
    proposals = proposals.map((p) => (p.id === proposalId ? updated : p));
    const why = reason?.trim() || undefined;
    agreements = agreements.map((a) =>
      a.proposalId === proposalId ? { ...a, cancelledAt: new Date().toISOString(), cancelReason: why } : a,
    );
    const text = `Avtalen er avlyst${why ? ` · ${why}` : ''}`;
    messages[updated.conversationId] = [
      ...(messages[updated.conversationId] ?? []),
      {
        id: nextId('m'),
        conversationId: updated.conversationId,
        authorProfileId: 'system',
        text,
        kind: 'SYSTEM',
        createdAt: new Date().toISOString(),
        delivery: 'READ',
      },
    ];
    touchConversation(updated.conversationId, text);
    return updated;
  },

  getAgreement(proposalId: string): AgreementSnapshot | undefined {
    return agreements.find((a) => a.proposalId === proposalId);
  },

  /** Accepted proposals the current user is part of, with a listing title. */
  listMyAgreements(): {
    proposalId: string;
    listingId: string;
    listingTitle: string;
    counterpartId: string;
    price: AgreementSnapshot['price'];
    scheduledText?: string;
    scheduledAt?: string;
    durationText?: string;
    agreedAt: string;
    role: 'HELPER' | 'CLIENT';
    cancelled: boolean;
  }[] {
    return agreements
      .map((a) => {
        const proposal = proposals.find((p) => p.id === a.proposalId);
        if (!proposal) return null;
        if (
          proposal.fromProfileId !== CURRENT_USER_ID &&
          proposal.toProfileId !== CURRENT_USER_ID
        ) {
          return null;
        }
        const listing = repositories.listings.get(a.listingId);
        return {
          proposalId: a.proposalId,
          listingId: a.listingId,
          listingTitle: listing?.title ?? (a.description || 'Oppdrag'),
          counterpartId:
            proposal.fromProfileId === CURRENT_USER_ID
              ? proposal.toProfileId
              : proposal.fromProfileId,
          price: a.price,
          scheduledText: a.scheduledText,
          scheduledAt: a.scheduledAt,
          durationText: a.durationText,
          agreedAt: a.agreedAt,
          role: proposal.fromProfileId === CURRENT_USER_ID ? ('HELPER' as const) : ('CLIENT' as const),
          cancelled: proposal.status === 'CANCELLED' || !!a.cancelledAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => Date.parse(b.agreedAt) - Date.parse(a.agreedAt));
  },

  _reset(): void {
    conversations = clone(seedConversations);
    messages = clone(seedMessages);
    proposals = clone(seedProposals);
    agreements = clone(seedAgreements);
  },
};

/** `mine`: I wrote it (never unread, "Du: …"); false: the other person did; undefined: a system line. */
function touchConversation(conversationId: string, preview: string, mine?: boolean): void {
  conversations = conversations.map((c) =>
    c.id === conversationId
      ? {
          ...c,
          lastMessagePreview: preview,
          lastMessageAt: new Date().toISOString(),
          lastMessageMine: mine ?? false,
          unread: mine === true ? false : mine === false ? true : c.unread,
        }
      : c,
  );
}

function pushSystem(conversationId: string, text: string): void {
  const sys: Message = {
    id: nextId('m'),
    conversationId,
    authorProfileId: 'system',
    text,
    kind: 'SYSTEM',
    createdAt: new Date().toISOString(),
    delivery: 'READ',
  };
  messages[conversationId] = [...(messages[conversationId] ?? []), sys];
  touchConversation(conversationId, text);
}

function setStatusTag(
  conversationId: string,
  tag: Conversation['statusTag'],
): void {
  conversations = conversations.map((c) =>
    c.id === conversationId ? { ...c, statusTag: tag } : c,
  );
}
