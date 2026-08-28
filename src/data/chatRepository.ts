import type {
  AgreementSnapshot,
  Conversation,
  Message,
  Proposal,
} from '@/domain/types';
import { transition, type ProposalEvent, type Actor } from '@/domain/proposalMachine';
import nb from '@/i18n/nb';
import { safetyStore } from './safetyStore';
import { repositories } from './repositories';
import {
  conversations as seedConversations,
  messagesByConversation as seedMessages,
  proposals as seedProposals,
  CURRENT_USER_ID,
} from './seedChat';

let conversations: Conversation[] = clone(seedConversations);
let messages: Record<string, Message[]> = clone(seedMessages);
let proposals: Proposal[] = clone(seedProposals);
let agreements: AgreementSnapshot[] = [];

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

let idSeq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idSeq++}`;

export const chatRepository = {
  currentUserId: CURRENT_USER_ID,

  listConversations(opts?: { unreadOnly?: boolean; query?: string }): Conversation[] {
    let result = [...conversations]
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
    if (!listing) throw new Error('Fant ikke oppføringen.');

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

  markRead(conversationId: string): void {
    conversations = conversations.map((c) =>
      c.id === conversationId ? { ...c, unread: false } : c,
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
    touchConversation(conversationId, text);
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
    touchConversation(conversationId, '📷 Bilde');
    return msg;
  },

  sendProposal(input: {
    conversationId: string;
    listingId: string;
    priceAmountMinor: number;
    message?: string;
    scheduledText?: string;
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
      caveats: input.caveats,
      status: 'SENT',
      createdAt: new Date().toISOString(),
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

  respondToProposal(
    proposalId: string,
    event: ProposalEvent,
    actor: Actor,
  ): { proposal: Proposal; agreement?: AgreementSnapshot } {
    const existing = chatRepository.getProposal(proposalId);
    if (!existing) throw new Error('Fant ikke tilbudet.');

    const nextStatus = transition(existing.status, event, actor);
    const updated: Proposal = { ...existing, status: nextStatus };
    proposals = proposals.map((p) => (p.id === proposalId ? updated : p));

    let systemText: string | null = null;
    let agreement: AgreementSnapshot | undefined;

    if (nextStatus === 'ACCEPTED') {
      systemText = nb.chat.offerAccepted;
      agreement = {
        proposalId,
        listingId: updated.listingId,
        price: updated.price,
        scheduledText: updated.scheduledText,
        description: updated.message ?? '',
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
    const convProposals = proposals.filter((p) => p.conversationId === conversationId);
    const accepted = convProposals.find((p) => p.status === 'ACCEPTED');
    return accepted ? agreements.find((a) => a.proposalId === accepted.id) : undefined;
  },

  _reset(): void {
    conversations = clone(seedConversations);
    messages = clone(seedMessages);
    proposals = clone(seedProposals);
    agreements = [];
  },
};

function touchConversation(conversationId: string, preview: string): void {
  conversations = conversations.map((c) =>
    c.id === conversationId
      ? { ...c, lastMessagePreview: preview, lastMessageAt: new Date().toISOString() }
      : c,
  );
}

function setStatusTag(
  conversationId: string,
  tag: Conversation['statusTag'],
): void {
  conversations = conversations.map((c) =>
    c.id === conversationId ? { ...c, statusTag: tag } : c,
  );
}
