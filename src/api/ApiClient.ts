import type {
  AgreementSnapshot,
  AppNotification,
  CompletionConfirmation,
  Conversation,
  Listing,
  ListingFilter,
  ListingSort,
  ListingType,
  Message,
  Proposal,
  PublicProfile,
  Report,
  ReportTargetType,
  Review,
  VerificationKind,
} from '@/domain/types';
import type { Actor, ProposalEvent } from '@/domain/proposalMachine';

export type SavedSearchRecord = {
  id: string;
  name: string;
  filter: ListingFilter;
  sort: ListingSort;
  createdAt: string;
};

export type SubmitReportInput = {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
};

export type ListListingsParams = {
  filter?: ListingFilter;
  sort?: ListingSort;
};

export type ListConversationsParams = {
  unreadOnly?: boolean;
  query?: string;
};

export type ReviseProposalPatch = {
  priceAmountMinor?: number;
  scheduledText?: string;
  message?: string;
  caveats?: string;
};

export type SendProposalInput = {
  conversationId: string;
  listingId: string;
  priceAmountMinor: number;
  message?: string;
  scheduledText?: string;
  caveats?: string;
};

export type UpdateProfilePatch = {
  displayName?: string;
  presentation?: string;
  place?: string;
  avatarPath?: string;
  maxDistanceKm?: number;
};

export type SubmitReviewInput = {
  agreementProposalId: string;
  listingId: string;
  fromProfileId: string;
  toProfileId: string;
  rating: number;
  comment?: string;
};

export type RespondToProposalResult = {
  proposal: Proposal;
  agreement?: AgreementSnapshot;
};

/**
 * The data contract every screen depends on. `MockApiClient` (Jest) and
 * `SupabaseApiClient` (runtime) both implement it. Adding a method here means
 * adding it to both implementations.
 */
export interface ApiClient {
  // listings
  listListings(params?: ListListingsParams): Promise<Listing[]>;
  getListing(id: string): Promise<Listing>;
  createListing(listing: Listing): Promise<Listing>;
  listMyListings(type?: ListingType): Promise<Listing[]>;

  // conversations & messages
  listConversations(params?: ListConversationsParams): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation>;
  startConversationForListing(listingId: string): Promise<Conversation>;
  listMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, text: string): Promise<Message>;
  sendAttachment(conversationId: string, attachmentUrl: string): Promise<Message>;
  toggleReaction(conversationId: string, messageId: string, emoji: string): Promise<Message[]>;
  setPinnedMessage(conversationId: string, messageId: string | null): Promise<Message[]>;

  // proposals & agreements
  getProposal(id: string): Promise<Proposal>;
  listReceivedProposals(): Promise<Proposal[]>;
  listProposalsForListing(listingId: string): Promise<Proposal[]>;
  sendProposal(input: SendProposalInput): Promise<Proposal>;
  reviseProposal(proposalId: string, patch: ReviseProposalPatch): Promise<Proposal>;
  respondToProposal(
    proposalId: string,
    event: ProposalEvent,
    actor: Actor,
  ): Promise<RespondToProposalResult>;
  getAgreement(proposalId: string): Promise<AgreementSnapshot | null>;
  getAgreementForConversation(conversationId: string): Promise<AgreementSnapshot | null>;

  // profile, verification, notifications, reviews
  getProfile(id: string): Promise<PublicProfile>;
  updateProfile(patch: UpdateProfilePatch): Promise<PublicProfile>;
  verify(kind: VerificationKind): Promise<PublicProfile>;
  listNotifications(): Promise<AppNotification[]>;
  markAllNotificationsRead(): Promise<void>;
  markNotificationRead(id: string): Promise<void>;
  listReviews(profileId: string): Promise<Review[]>;

  // completion & review
  getCompletion(agreementProposalId: string): Promise<CompletionConfirmation[]>;
  confirmCompletion(
    agreementProposalId: string,
    byProfileId: string,
  ): Promise<CompletionConfirmation[]>;
  submitReview(input: SubmitReviewInput): Promise<Review>;

  // saved listings & searches
  listSavedListingIds(): Promise<string[]>;
  toggleSavedListing(listingId: string): Promise<string[]>;
  listSavedSearches(): Promise<SavedSearchRecord[]>;
  addSavedSearch(input: Omit<SavedSearchRecord, 'id' | 'createdAt'>): Promise<SavedSearchRecord>;
  removeSavedSearch(id: string): Promise<void>;

  // safety
  listReports(): Promise<Report[]>;
  submitReport(input: SubmitReportInput): Promise<Report>;
  resolveReport(reportId: string): Promise<Report>;
  listBlockedProfileIds(): Promise<string[]>;
  toggleBlock(profileId: string): Promise<string[]>;
  submitBusinessProfile(input: {
    orgNr: string;
    companyName: string;
    contactPerson: string;
    email: string;
    phone: string;
    categorySlugs: string[];
  }): Promise<void>;
}
