import type {
  AgendaItem,
  AgreementSnapshot,
  AppNotification,
  JobWorkspace,
  CompletionConfirmation,
  Conversation,
  Listing,
  ListingFilter,
  ListingSort,
  ListingStatus,
  ListingType,
  Message,
  Proposal,
  PublicProfile,
  Report,
  ReportTargetType,
  NoticeboardPost,
  Partner,
  Donation,
  NoticeKind,
  Review,
  SkillEndorsement,
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

/** Varslinger: one switch per notification type and channel. */
export type NotifKey = 'msg' | 'offer' | 'changed' | 'decided' | 'time' | 'done' | 'review' | 'match' | 'board' | 'mod';
export type NotificationPrefs = {
  /** "Alle varsler" – off pauses everything except safety/moderation */
  master: boolean;
  /** Innstillinger quick switches: channel on/off */
  channels: { push: boolean; email: boolean };
  push: Record<NotifKey, boolean>;
  email: Record<NotifKey, boolean>;
  quiet: { on: boolean; from: string; to: string };
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  master: true,
  channels: { push: true, email: false },
  push: { msg: true, offer: true, changed: true, decided: true, time: true, done: true, review: true, match: true, board: false, mod: true },
  email: { msg: false, offer: true, changed: false, decided: true, time: true, done: false, review: false, match: false, board: false, mod: true },
  quiet: { on: true, from: '22:00', to: '07:00' },
};

/** Private settings (profile_settings) – only the owner can read them. */
export type MySettings = { email?: string; notificationPrefs: NotificationPrefs };

/** Merge stored (possibly partial / older) prefs over the defaults. */
export function withDefaultPrefs(p: Partial<NotificationPrefs> | null | undefined): NotificationPrefs {
  const d = DEFAULT_NOTIFICATION_PREFS;
  return {
    master: p?.master ?? d.master,
    channels: { ...d.channels, ...(p?.channels ?? {}) },
    push: { ...d.push, ...(p?.push ?? {}) },
    email: { ...d.email, ...(p?.email ?? {}) },
    quiet: { ...d.quiet, ...(p?.quiet ?? {}) },
  };
}

/** Bedrift registration (business_profiles). */
export type BusinessProfile = {
  profileId: string;
  orgNr: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  categorySlugs: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
};

/** One row in the consent log (consent_records). Each change is a new row. */
export type ConsentRecord = {
  id: string;
  terms: boolean;
  privacy: boolean;
  age: boolean;
  /** optional "tips om oppdrag" (0024); undefined on rows from before it existed */
  tips?: boolean;
  createdAt: string;
};

/** Nabolag: the group for one area (sted) in a kommune. `id` is null until someone joins. */
export type NeighbourhoodInfo = {
  id: string | null;
  name: string;
  place: string;
  municipality: string;
  createdAt?: string;
  memberCount: number;
  isMember: boolean;
  /** latest members first, max 5 */
  memberIds: string[];
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
  municipality?: string;
  /** null removes the photo */
  avatarPath?: string | null;
  maxDistanceKm?: number;
  paused?: boolean;
  homeNotes?: string;
  portfolio?: string[];
};

export type SubmitReviewInput = {
  agreementProposalId: string;
  listingId: string;
  fromProfileId: string;
  toProfileId: string;
  rating: number;
  comment?: string;
  tags?: string[];
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
  /** Mine oppføringer: pause / activate / archive, and soft delete (REMOVED keeps chats and offers). Owner only. */
  setListingStatus(listingId: string, status: ListingStatus): Promise<void>;
  /** Notify nearby helpers whose offers match this task; returns how many. */
  notifyMatchingHelpers(listingId: string): Promise<number>;

  // conversations & messages
  listConversations(params?: ListConversationsParams): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation>;
  startConversationForListing(listingId: string): Promise<Conversation>;
  /** Innboks "Merk alle som lest". */
  markConversationsRead(conversationIds: string[]): Promise<void>;
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
  /** Either party calls off an accepted agreement (ACCEPTED → CANCELLED). */
  cancelAgreement(proposalId: string, reason?: string): Promise<Proposal>;
  getAgreementForConversation(conversationId: string): Promise<AgreementSnapshot | null>;
  listMyAgreements(): Promise<AgendaItem[]>;
  instantBook(listingId: string): Promise<{ proposalId: string }>;
  getJobWorkspace(proposalId: string): Promise<JobWorkspace>;
  updateJobWorkspace(
    proposalId: string,
    action:
      | { kind: 'addChecklist'; text: string }
      | { kind: 'toggleChecklist'; itemId: string }
      | { kind: 'removeChecklist'; itemId: string }
      | { kind: 'addMaterial'; label: string; amountKr: number }
      | { kind: 'removeMaterial'; itemId: string }
      | { kind: 'addPhoto'; url: string; phase: 'BEFORE' | 'AFTER' }
      | { kind: 'removePhoto'; itemId: string }
      | { kind: 'toggleTimer' },
  ): Promise<JobWorkspace>;

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
  reportNoShow(agreementProposalId: string, profileId: string): Promise<void>;
  listEndorsements(profileId: string): Promise<SkillEndorsement[]>;
  toggleEndorsement(profileId: string, skill: string): Promise<SkillEndorsement[]>;
  listFollowedProfileIds(): Promise<string[]>;
  toggleFollow(profileId: string): Promise<string[]>;
  listNoticeboard(kind?: NoticeKind): Promise<NoticeboardPost[]>;
  createNoticeboardPost(input: {
    kind: NoticeKind;
    title: string;
    body: string;
    place: string;
    municipality: string;
    /** storage path in `listing-images` */
    imagePath?: string;
  }): Promise<NoticeboardPost>;
  deleteNoticeboardPost(id: string): Promise<void>;

  // community
  listPartners(): Promise<Partner[]>;
  listDonations(): Promise<Donation[]>;

  // konto
  /** Slett konto: anonymise + clean up (RPC), then close the login (edge function). */
  deleteMyAccount(reason?: string): Promise<void>;

  // innstillinger
  getMySettings(): Promise<MySettings>;
  updateNotificationPrefs(prefs: NotificationPrefs): Promise<MySettings>;
  /** Store this device's Expo push token. */
  registerPushToken(token: string, platform: 'ios' | 'android' | 'web'): Promise<void>;

  // personvern
  /** My consent log, newest first. */
  listConsentRecords(): Promise<ConsentRecord[]>;
  /** Turn the optional tips consent on/off – stored as a new timestamped row. */
  setTipsConsent(on: boolean): Promise<ConsentRecord>;

  // nabolag
  getNeighbourhood(municipality: string, place: string): Promise<NeighbourhoodInfo>;
  joinNeighbourhood(municipality: string, place: string): Promise<NeighbourhoodInfo>;
  leaveNeighbourhood(municipality: string, place: string): Promise<NeighbourhoodInfo>;

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
  /** My own business registration, or null when I haven't registered. */
  getMyBusinessProfile(): Promise<BusinessProfile | null>;
}
