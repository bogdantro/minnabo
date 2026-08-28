import type {
  AgreementSnapshot,
  Conversation,
  Listing,
  ListingFilter,
  ListingSort,
  Message,
  Proposal,
} from '@/domain/types';
import type {
  AppNotification,
  CompletionConfirmation,
  PublicProfile,
  Review,
} from '@/domain/types';
import type { Actor, ProposalEvent } from '@/domain/proposalMachine';
import { repositories } from '@/data/repositories';
import { chatRepository } from '@/data/chatRepository';
import { profileRepository } from '@/data/profileRepository';

const IS_TEST = process.env.NODE_ENV === 'test';
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, IS_TEST ? 0 : ms));

export type ListListingsParams = {
  filter?: ListingFilter;
  sort?: ListingSort;
};

/**
 * Mock API client. The method surface mirrors a future REST API so that
 * swapping in a real backend later means replacing only this file.
 */
export class MockApiClient {
  async listListings(params: ListListingsParams = {}): Promise<Listing[]> {
    await delay(250);
    return repositories.listings.list(params.filter, params.sort);
  }

  async getListing(id: string): Promise<Listing> {
    await delay(200);
    const listing = repositories.listings.get(id);
    if (!listing) {
      throw new Error('Fant ikke oppføringen.');
    }
    return listing;
  }

  async createListing(listing: Listing): Promise<Listing> {
    await delay(300);
    repositories.listings.add(listing);
    return listing;
  }

  // --- conversations & messages ---

  async listConversations(params: { unreadOnly?: boolean; query?: string } = {}): Promise<
    Conversation[]
  > {
    await delay(200);
    return chatRepository.listConversations(params);
  }

  async getConversation(id: string): Promise<Conversation> {
    await delay(150);
    const conv = chatRepository.getConversation(id);
    if (!conv) throw new Error('Fant ikke samtalen.');
    chatRepository.markRead(id);
    return conv;
  }

  async startConversationForListing(listingId: string): Promise<Conversation> {
    await delay(150);
    return chatRepository.findOrCreateConversationForListing(listingId);
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    await delay(150);
    return chatRepository.getMessages(conversationId);
  }

  async getProposal(id: string): Promise<Proposal> {
    await delay(120);
    const proposal = chatRepository.getProposal(id);
    if (!proposal) throw new Error('Fant ikke tilbudet.');
    return proposal;
  }

  async listReceivedProposals(): Promise<Proposal[]> {
    await delay(150);
    return chatRepository.listReceivedProposals();
  }

  async listProposalsForListing(listingId: string): Promise<Proposal[]> {
    await delay(150);
    return chatRepository.proposalsForListing(listingId);
  }

  async reviseProposal(
    proposalId: string,
    patch: Parameters<typeof chatRepository.reviseProposal>[1],
  ): Promise<Proposal> {
    await delay(150);
    return chatRepository.reviseProposal(proposalId, patch);
  }

  async getAgreement(proposalId: string): Promise<AgreementSnapshot | null> {
    await delay(120);
    return chatRepository.getAgreement(proposalId) ?? null;
  }

  async sendMessage(conversationId: string, text: string): Promise<Message> {
    await delay(120);
    return chatRepository.sendMessage(conversationId, text);
  }

  async sendAttachment(conversationId: string, attachmentUrl: string): Promise<Message> {
    await delay(150);
    return chatRepository.sendAttachment(conversationId, attachmentUrl);
  }

  async sendProposal(input: {
    conversationId: string;
    listingId: string;
    priceAmountMinor: number;
    message?: string;
    scheduledText?: string;
    caveats?: string;
  }): Promise<Proposal> {
    await delay(150);
    return chatRepository.sendProposal(input);
  }

  async respondToProposal(
    proposalId: string,
    event: ProposalEvent,
    actor: Actor,
  ): Promise<{ proposal: Proposal; agreement?: AgreementSnapshot }> {
    await delay(150);
    return chatRepository.respondToProposal(proposalId, event, actor);
  }

  async getAgreementForConversation(
    conversationId: string,
  ): Promise<AgreementSnapshot | null> {
    await delay(100);
    return chatRepository.getAgreementForConversation(conversationId) ?? null;
  }

  // --- profile, notifications, reviews, completion ---

  async getProfile(id: string): Promise<PublicProfile> {
    await delay(150);
    const profile = profileRepository.getProfile(id);
    if (!profile) throw new Error('Fant ikke profilen.');
    return profile;
  }

  async updateProfile(
    patch: Parameters<typeof profileRepository.updateProfile>[0],
  ): Promise<PublicProfile> {
    await delay(200);
    return profileRepository.updateProfile(patch);
  }

  async verify(kind: 'PHONE' | 'EMAIL' | 'BUSINESS'): Promise<PublicProfile> {
    await delay(400);
    return profileRepository.markVerified(kind);
  }

  async listNotifications(): Promise<AppNotification[]> {
    await delay(150);
    return profileRepository.listNotifications();
  }

  async markAllNotificationsRead(): Promise<void> {
    await delay(120);
    profileRepository.markAllNotificationsRead();
  }

  async listReviews(profileId: string): Promise<Review[]> {
    await delay(150);
    return profileRepository.listReviewsForProfile(profileId);
  }

  async listMyListings(type?: 'TASK_REQUEST' | 'SERVICE_OFFER'): Promise<Listing[]> {
    await delay(150);
    return profileRepository.myListings(type);
  }

  async getCompletion(agreementProposalId: string): Promise<CompletionConfirmation[]> {
    await delay(120);
    return profileRepository.completionsFor(agreementProposalId);
  }

  async confirmCompletion(
    agreementProposalId: string,
    byProfileId: string,
  ): Promise<CompletionConfirmation[]> {
    await delay(150);
    return profileRepository.confirmCompletion(agreementProposalId, byProfileId);
  }

  async submitReview(
    input: Parameters<typeof profileRepository.submitReview>[0],
  ): Promise<Review> {
    await delay(200);
    return profileRepository.submitReview(input);
  }
}

export const apiClient = new MockApiClient();
