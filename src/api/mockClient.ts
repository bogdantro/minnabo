import type {
  AgendaItem,
  AgreementSnapshot,
  AppNotification,
  JobWorkspace,
  CompletionConfirmation,
  Conversation,
  Listing,
  ListingType,
  Message,
  Proposal,
  NoticeboardPost,
  NoticeKind,
  PublicProfile,
  Review,
  SkillEndorsement,
  VerificationKind,
} from '@/domain/types';
import type { Actor, ProposalEvent } from '@/domain/proposalMachine';
import type { Report } from '@/domain/types';
import { repositories } from '@/data/repositories';
import { chatRepository } from '@/data/chatRepository';
import { profileRepository } from '@/data/profileRepository';
import { savedStore } from '@/data/savedStore';
import { savedSearchStore } from '@/data/savedSearchStore';
import { safetyStore } from '@/data/safetyStore';
import { endorsementsStore } from '@/data/endorsementsStore';
import { followStore } from '@/data/followStore';
import { noticeboardStore } from '@/data/noticeboardStore';
import { jobWorkspaceStore } from '@/data/jobWorkspaceStore';
import type {
  ApiClient,
  ListConversationsParams,
  ListListingsParams,
  ReviseProposalPatch,
  RespondToProposalResult,
  SavedSearchRecord,
  SendProposalInput,
  SubmitReportInput,
  SubmitReviewInput,
  UpdateProfilePatch,
} from './ApiClient';

const IS_TEST = process.env.NODE_ENV === 'test';
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, IS_TEST ? 0 : ms));

/**
 * In-memory API client backed by `src/data/*` repositories. Used by Jest only —
 * the runtime app uses `SupabaseApiClient`. Its method surface is the source of
 * truth for the `ApiClient` interface.
 */
export class MockApiClient implements ApiClient {
  async listListings(params: ListListingsParams = {}): Promise<Listing[]> {
    await delay(250);
    return repositories.listings.list(params.filter, params.sort);
  }

  async getListing(id: string): Promise<Listing> {
    await delay(200);
    const listing = repositories.listings.get(id);
    if (!listing) throw new Error('Fant ikke oppføringen.');
    return listing;
  }

  async createListing(listing: Listing): Promise<Listing> {
    await delay(300);
    repositories.listings.add(listing);
    return listing;
  }

  async listMyListings(type?: ListingType): Promise<Listing[]> {
    await delay(150);
    return profileRepository.myListings(type);
  }

  async listConversations(params: ListConversationsParams = {}): Promise<Conversation[]> {
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

  async sendMessage(conversationId: string, text: string): Promise<Message> {
    await delay(120);
    return chatRepository.sendMessage(conversationId, text);
  }

  async sendAttachment(conversationId: string, attachmentUrl: string): Promise<Message> {
    await delay(150);
    return chatRepository.sendAttachment(conversationId, attachmentUrl);
  }

  async toggleReaction(conversationId: string, messageId: string, emoji: string): Promise<Message[]> {
    await delay(60);
    return chatRepository.toggleReaction(conversationId, messageId, emoji);
  }

  async setPinnedMessage(conversationId: string, messageId: string | null): Promise<Message[]> {
    await delay(60);
    return chatRepository.setPinnedMessage(conversationId, messageId);
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

  async sendProposal(input: SendProposalInput): Promise<Proposal> {
    await delay(150);
    return chatRepository.sendProposal(input);
  }

  async reviseProposal(proposalId: string, patch: ReviseProposalPatch): Promise<Proposal> {
    await delay(150);
    return chatRepository.reviseProposal(proposalId, patch);
  }

  async respondToProposal(
    proposalId: string,
    event: ProposalEvent,
    actor: Actor,
  ): Promise<RespondToProposalResult> {
    await delay(150);
    return chatRepository.respondToProposal(proposalId, event, actor);
  }

  async getAgreement(proposalId: string): Promise<AgreementSnapshot | null> {
    await delay(120);
    return chatRepository.getAgreement(proposalId) ?? null;
  }

  async getAgreementForConversation(conversationId: string): Promise<AgreementSnapshot | null> {
    await delay(100);
    return chatRepository.getAgreementForConversation(conversationId) ?? null;
  }

  async listMyAgreements(): Promise<AgendaItem[]> {
    await delay(150);
    return chatRepository.listMyAgreements().map((a) => ({
      ...a,
      fullyCompleted: profileRepository.isFullyCompleted(a.proposalId),
    }));
  }

  async getJobWorkspace(proposalId: string): Promise<JobWorkspace> {
    await delay(60);
    return jobWorkspaceStore.get(proposalId);
  }

  async updateJobWorkspace(
    proposalId: string,
    action: Parameters<ApiClient['updateJobWorkspace']>[1],
  ): Promise<JobWorkspace> {
    await delay(60);
    switch (action.kind) {
      case 'addChecklist':
        return jobWorkspaceStore.addChecklistItem(proposalId, action.text);
      case 'toggleChecklist':
        return jobWorkspaceStore.toggleChecklistItem(proposalId, action.itemId);
      case 'removeChecklist':
        return jobWorkspaceStore.removeChecklistItem(proposalId, action.itemId);
      case 'addMaterial':
        return jobWorkspaceStore.addMaterial(proposalId, action.label, action.amountKr);
      case 'removeMaterial':
        return jobWorkspaceStore.removeMaterial(proposalId, action.itemId);
      case 'toggleTimer':
        return jobWorkspaceStore.toggleTimer(proposalId);
    }
  }

  async getProfile(id: string): Promise<PublicProfile> {
    await delay(150);
    const profile = profileRepository.getProfile(id);
    if (!profile) throw new Error('Fant ikke profilen.');
    return {
      ...profile,
      reliability: profileRepository.reliabilityFor(id),
      endorsements: endorsementsStore.list(id),
    };
  }

  async updateProfile(patch: UpdateProfilePatch): Promise<PublicProfile> {
    await delay(200);
    return profileRepository.updateProfile(patch);
  }

  async verify(kind: VerificationKind): Promise<PublicProfile> {
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

  async markNotificationRead(id: string): Promise<void> {
    await delay(40);
    profileRepository.markNotificationRead(id);
  }

  async listReviews(profileId: string): Promise<Review[]> {
    await delay(150);
    return profileRepository.listReviewsForProfile(profileId);
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

  async submitReview(input: SubmitReviewInput): Promise<Review> {
    await delay(200);
    return profileRepository.submitReview(input);
  }

  async reportNoShow(_agreementProposalId: string, profileId: string): Promise<void> {
    await delay(120);
    profileRepository.reportNoShow(profileId);
  }

  async listEndorsements(profileId: string): Promise<SkillEndorsement[]> {
    await delay(60);
    return endorsementsStore.list(profileId);
  }

  async toggleEndorsement(profileId: string, skill: string): Promise<SkillEndorsement[]> {
    await delay(80);
    return endorsementsStore.toggle(profileId, skill);
  }

  async listFollowedProfileIds(): Promise<string[]> {
    await delay(50);
    return followStore.list();
  }

  async toggleFollow(profileId: string): Promise<string[]> {
    await delay(70);
    return followStore.toggle(profileId);
  }

  async listNoticeboard(kind?: NoticeKind): Promise<NoticeboardPost[]> {
    await delay(120);
    return noticeboardStore.list(kind);
  }

  async createNoticeboardPost(input: {
    kind: NoticeKind;
    title: string;
    body: string;
    place: string;
  }): Promise<NoticeboardPost> {
    await delay(150);
    return noticeboardStore.create(input);
  }

  async deleteNoticeboardPost(id: string): Promise<void> {
    await delay(80);
    noticeboardStore.remove(id);
  }

  // --- saved listings & searches ---

  async listSavedListingIds(): Promise<string[]> {
    await delay(60);
    return savedStore.list();
  }

  async toggleSavedListing(listingId: string): Promise<string[]> {
    await delay(60);
    savedStore.toggle(listingId);
    return savedStore.list();
  }

  async listSavedSearches(): Promise<SavedSearchRecord[]> {
    await delay(60);
    return savedSearchStore.list();
  }

  async addSavedSearch(
    input: Omit<SavedSearchRecord, 'id' | 'createdAt'>,
  ): Promise<SavedSearchRecord> {
    await delay(60);
    return savedSearchStore.add(input.name, input.filter, input.sort);
  }

  async removeSavedSearch(id: string): Promise<void> {
    await delay(60);
    savedSearchStore.remove(id);
  }

  // --- safety ---

  async listReports(): Promise<Report[]> {
    await delay(120);
    return safetyStore
      .listReports()
      .map((r) => ({ ...r, status: safetyStore.isResolved(r.id) ? 'RESOLVED' : 'OPEN' }));
  }

  async submitReport(input: SubmitReportInput): Promise<Report> {
    await delay(150);
    return safetyStore.submitReport({
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details,
      byProfileId: profileRepository.currentUserId,
    });
  }

  async resolveReport(reportId: string): Promise<Report> {
    await delay(120);
    safetyStore.resolveReport(reportId);
    const r = safetyStore.listReports().find((x) => x.id === reportId)!;
    return { ...r, status: 'RESOLVED' };
  }

  async listBlockedProfileIds(): Promise<string[]> {
    await delay(60);
    return safetyStore.listBlocked();
  }

  async toggleBlock(profileId: string): Promise<string[]> {
    await delay(60);
    safetyStore.toggleBlock(profileId);
    return safetyStore.listBlocked();
  }

  async submitBusinessProfile(): Promise<void> {
    await delay(200);
    profileRepository.markVerified('BUSINESS');
  }
}
