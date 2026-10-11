import type {
  AgendaItem,
  AgreementSnapshot,
  AgreementTimeProposal,
  GuardianLinks,
  PriceRange,
  AppNotification,
  JobWorkspace,
  PortfolioItem,
  ReliabilityDetails,
  JobParty,
  JobPhotoPhase,
  MaterialPayer,
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
  NoticeComment,
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
  /** the bell: notify me about new matches */
  alert?: boolean;
  /** ISO – last time "Kjør søk" was pressed */
  lastRunAt?: string;
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

/** Extra oppdrag settings from the Legg ut wizard (stored next to the listing). */
export type ListingExtras = {
  offerAudience: 'ALL' | 'VERIFIED';
  maxDistanceKm?: number;
  /** "ditt anslag (vises ikke)" – only the owner can read it back */
  privateEstimateMinor?: number | null;
  estimatedMinutes?: number;
  /** the wizard form as entered, so "Rediger" reopens it exactly */
  wizard?: unknown;
};

/** What edit mode needs that isn't on the public listing. */
export type ListingEditData = { wizard: unknown | null; privateEstimateMinor: number | null };

/** Fields the sender can change on an open tilbud. */
export type EditProposalPatch = {
  priceAmountMinor: number;
  scheduledText?: string;
  /** ISO, or null when the offer has no fixed day */
  scheduledAt?: string | null;
  durationText?: string;
  message?: string;
  caveats?: string;
};

export type AccountStatus = { suspended: boolean; deleted: boolean };

/** What Vipps confirmed about the signed-in person (profile_private, owner-only). */
export type MyAccount = {
  /** logged in with Vipps (false for development logins) */
  vipps: boolean;
  /** under 18 → youth account; enforced on the backend */
  youth: boolean;
  age?: number;
  birthYear?: number;
  fullName?: string;
  /** "+47 ••• •• 234" */
  phoneMasked?: string;
  emailMasked?: string;
};

/** Phone and home notes of someone you have an accepted tilbud with (shared_contact, 0057). */
export type SharedContact = { phone?: string; homeNotes?: string };

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

// ---------------------------------------------------------------------------
// Adminpanel (design/screens/Admin.dc.html) — every call is admin-only on the backend.
// ---------------------------------------------------------------------------
export type AdminOverview = {
  openReports: number;
  pendingBusinesses: number;
  newUsersToday: number;
  activeListings: number;
};
export type ReportOutcome = 'dismiss' | 'remove' | 'warn';
export type AdminReport = {
  id: string;
  targetType: 'USER' | 'LISTING' | 'PROPOSAL' | 'MESSAGE' | 'REVIEW' | 'NOTICE' | 'COMMENT';
  targetId: string;
  reason: string;
  details?: string;
  /** what was reported, e.g. «Billig flyttehjelp» – «Vipps 500 kr først» */
  targetText: string;
  byName: string;
  createdAt: string;
  status: 'OPEN' | 'RESOLVED';
  outcome: ReportOutcome | null;
  resolvedAt: string | null;
  /** storage path of the reporter's screenshot (private bucket) */
  attachmentPath?: string;
};
export type AdminBusiness = BusinessProfile & { decidedAt: string | null };
export type AdminUser = {
  id: string;
  displayName: string;
  initials: string;
  avatarUrl?: string;
  place: string | null;
  municipality: string | null;
  memberSince: string;
  rating: number | null;
  ratingCount: number;
  suspended: boolean;
  isAdmin: boolean;
};
export type AdminListing = {
  id: string;
  title: string;
  categorySlug: string;
  reportCount: number;
  lastReason: string | null;
  hidden: boolean;
};
export type AdminPartner = {
  id: string;
  name: string;
  blurb: string;
  municipality: string | null;
  /** one of the (max 2) hovedpartnere on Fellesskap */
  main: boolean;
  /** shown in the supporter carousel */
  active: boolean;
  /** "Lokal helt" */
  hero?: boolean;
};
/** One day (yyyy-mm-dd, Oslo) of the weekly statistics. */
export type AdminDayStat = { day: string; listings: number; offers: number; completed: number };

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
  /** storage path in the private `report-attachments` bucket */
  attachmentPath?: string;
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
  /** ISO, or null when the offer has no fixed day */
  scheduledAt?: string | null;
  durationText?: string;
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
  availableForJobs?: boolean;
  /** the categories I want jobs in (Oppdrag for meg, match notifications) */
  categorySlugs?: string[];
  languages?: string[];
  hasCar?: boolean;
  availabilityText?: string;
  homeNotes?: string;
  portfolio?: string[];
};

/** Public offer count on an oppdrag – a number only, never who. */
export type OfferCount = { count: number; mine: boolean };

export type SubmitReviewInput = {
  agreementProposalId: string;
  listingId: string;
  fromProfileId: string;
  toProfileId: string;
  rating: number;
  comment?: string;
  tags?: string[];
  /** "Vil du anbefale …?" – true / false, undefined when not answered */
  recommends?: boolean;
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
  createListing(listing: Listing, extras?: ListingExtras): Promise<Listing>;
  /** Owner edits an oppdrag (until a tilbud is accepted). Open offers get a notification. */
  updateListing(listingId: string, listing: Listing, extras: ListingExtras): Promise<Listing>;
  getListingEditData(listingId: string): Promise<ListingEditData>;
  /** Signed-in user's account state – suspended accounts are signed out. */
  getMyAccountStatus(): Promise<AccountStatus>;
  getMyAccount(): Promise<MyAccount>;
  /** Tilbud I have sent (youth app "Mine tilbud"), newest first. */
  listSentProposals(): Promise<Proposal[]>;
  listMyListings(type?: ListingType): Promise<Listing[]>;
  /** Mine oppføringer: pause / activate / archive, and soft delete (REMOVED keeps chats and offers). Owner only. */
  setListingStatus(listingId: string, status: ListingStatus): Promise<void>;
  /** Notify nearby helpers whose offers match this task; returns how many. */
  notifyMatchingHelpers(listingId: string): Promise<number>;
  getListingOfferCount(listingId: string): Promise<OfferCount>;

  // conversations & messages
  listConversations(params?: ListConversationsParams): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation>;
  startConversationForListing(listingId: string): Promise<Conversation>;
  /** Chat "Slå av varsler" – no push for this conversation. */
  setConversationMuted(conversationId: string, muted: boolean): Promise<void>;
  /** Innboks "Merk alle som lest". */
  markConversationsRead(conversationIds: string[]): Promise<void>;
  listMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, text: string): Promise<Message>;
  /** `attachmentPath`: the photo's path in the private chat-attachments bucket. */
  sendAttachment(conversationId: string, attachmentPath: string): Promise<Message>;
  toggleReaction(conversationId: string, messageId: string, emoji: string): Promise<Message[]>;
  setPinnedMessage(conversationId: string, messageId: string | null): Promise<Message[]>;

  // proposals & agreements
  getProposal(id: string): Promise<Proposal>;
  listReceivedProposals(): Promise<Proposal[]>;
  listProposalsForListing(listingId: string): Promise<Proposal[]>;
  sendProposal(input: SendProposalInput): Promise<Proposal>;
  reviseProposal(proposalId: string, patch: ReviseProposalPatch): Promise<Proposal>;
  /** Sender edits an open tilbud (SENT / REVISION_PENDING); the recipient is notified. */
  editProposal(proposalId: string, patch: EditProposalPatch): Promise<Proposal>;
  /** The recipient opened the tilbud ("Sett av …"). No-op for everyone else. */
  markProposalSeen(proposalId: string): Promise<void>;
  respondToProposal(
    proposalId: string,
    event: ProposalEvent,
    actor: Actor,
  ): Promise<RespondToProposalResult>;
  getAgreement(proposalId: string): Promise<AgreementSnapshot | null>;
  /** Either party calls off an accepted agreement (ACCEPTED → CANCELLED). */
  cancelAgreement(proposalId: string, reason?: string): Promise<Proposal>;
  getAgreementForConversation(conversationId: string): Promise<AgreementSnapshot | null>;
  /** The open "nytt tidspunkt" proposal on an avtale, if any. */
  getAgreementTimeProposal(proposalId: string): Promise<AgreementTimeProposal | null>;
  proposeAgreementTime(proposalId: string, scheduledAt: string, scheduledText: string): Promise<AgreementTimeProposal>;
  /** ACCEPT / DECLINE by the other person, WITHDRAW by the one who proposed. */
  respondAgreementTime(id: string, answer: 'ACCEPT' | 'DECLINE' | 'WITHDRAW'): Promise<AgreementTimeProposal>;
  /** A finished avtale → a new oppdrag only that helper sees. Returns the new oppdrag's id. */
  requestHelpAgain(proposalId: string, input?: { when?: string; note?: string }): Promise<string>;
  /** Null until there are enough earlier tilbud in the category. */
  getPriceGuidance(categorySlug: string): Promise<PriceRange | null>;
  getGuardianLinks(): Promise<GuardianLinks>;
  /** Youth: a new code to give to a parent. */
  createGuardianCode(): Promise<string>;
  /** Foresatt: link with the youth's code. Returns the youth's name. */
  linkGuardian(code: string): Promise<string>;
  unlinkGuardian(linkId: string): Promise<void>;
  /** "Si fra når MinNabo kommer til min kommune". */
  joinKommuneWaitlist(kommune: string): Promise<void>;
  listMyAgreements(): Promise<AgendaItem[]>;
  instantBook(listingId: string): Promise<{ proposalId: string }>;
  getJobWorkspace(proposalId: string): Promise<JobWorkspace>;
  updateJobWorkspace(
    proposalId: string,
    action:
      | { kind: 'addChecklist'; text: string; who?: JobParty }
      | { kind: 'setChecklistWho'; itemId: string; who?: JobParty }
      | { kind: 'toggleChecklist'; itemId: string }
      | { kind: 'removeChecklist'; itemId: string }
      | { kind: 'addMaterial'; label: string; amountKr: number; payer?: MaterialPayer }
      | { kind: 'removeMaterial'; itemId: string }
      | { kind: 'addPhoto'; url: string; phase: JobPhotoPhase; caption?: string }
      | { kind: 'removePhoto'; itemId: string }
      | { kind: 'toggleTimer' }
      | { kind: 'stopTimer' },
  ): Promise<JobWorkspace>;

  // profile, verification, notifications, reviews
  getProfile(id: string): Promise<PublicProfile>;
  /** Phone (Vipps) and home notes – only for yourself or a counterpart on an accepted tilbud. */
  getSharedContact(profileId: string): Promise<SharedContact>;
  /** "Anbefal" is only for neighbours with a completed avtale together (0060). */
  canEndorse(profileId: string): Promise<boolean>;
  updateProfile(patch: UpdateProfilePatch): Promise<PublicProfile>;
  /** Median reply time in minutes ("Svarer vanligvis innen …"); null until there is enough history. */
  getReplyMinutes(profileId: string): Promise<number | null>;
  verify(kind: VerificationKind): Promise<PublicProfile>;
  listNotifications(): Promise<AppNotification[]>;
  markAllNotificationsRead(): Promise<void>;
  markNotificationRead(id: string): Promise<void>;
  listReviews(profileId: string): Promise<Review[]>;
  /** The reviewed person's public answer ("Svar fra …"). */
  replyToReview(reviewId: string, reply: string): Promise<Review>;
  getReliability(profileId: string): Promise<ReliabilityDetails>;
  listPortfolio(profileId: string): Promise<PortfolioItem[]>;
  /** `beforePath` / `afterPath` are storage paths (or URLs) in `listing-images`. */
  addPortfolioItem(input: {
    beforePath?: string;
    afterPath: string;
    title: string;
    place?: string;
    caption?: string;
    categorySlug?: string;
  }): Promise<PortfolioItem>;
  removePortfolioItem(id: string): Promise<void>;

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
  /** The owner edits an oppslag, or marks it as done / open again. */
  updateNoticeboardPost(
    id: string,
    patch: { kind?: NoticeKind; title?: string; body?: string; imagePath?: string | null; done?: boolean },
  ): Promise<NoticeboardPost>;
  /** Oppslagstavle "Svar": public comments under an oppslag, oldest first. */
  listNoticeComments(noticeId: string): Promise<NoticeComment[]>;
  addNoticeComment(noticeId: string, body: string): Promise<NoticeComment>;
  deleteNoticeComment(id: string): Promise<void>;
  listSavedNoticeIds(): Promise<string[]>;
  toggleSavedNotice(noticeId: string): Promise<string[]>;

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
  /** Sign-out: this phone stops getting the account's push notifications. */
  unregisterPushToken(token: string): Promise<void>;

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
  setSavedSearchAlert(id: string, alert: boolean): Promise<void>;
  /** "Kjør søk" – resets "nye treff" and sets "sist kjørt". */
  markSavedSearchRun(id: string): Promise<void>;
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

  // --- admin (role 'admin' only; the backend refuses everyone else) ---
  getAdminOverview(): Promise<AdminOverview>;
  listAdminReports(): Promise<AdminReport[]>;
  decideReport(reportId: string, outcome: ReportOutcome): Promise<void>;
  /** A short-lived link to a report's screenshot (admins only). */
  getReportAttachmentUrl(path: string): Promise<string>;
  reopenReport(reportId: string): Promise<void>;
  listAdminBusinesses(): Promise<AdminBusiness[]>;
  decideBusiness(profileId: string, approve: boolean): Promise<void>;
  listAdminUsers(query?: string): Promise<AdminUser[]>;
  setUserSuspended(profileId: string, suspended: boolean): Promise<void>;
  listFlaggedListings(): Promise<AdminListing[]>;
  setListingHidden(listingId: string, hidden: boolean): Promise<void>;
  listAdminPartners(): Promise<AdminPartner[]>;
  setMainPartner(partnerId: string, main: boolean): Promise<void>;
  setPartnerActive(partnerId: string, active: boolean): Promise<void>;
  /** Make a partner a "Lokal helt" (or a plain støttespiller again). */
  setPartnerHero(partnerId: string, hero: boolean): Promise<void>;
  /** Mon–Sun of the week containing `day` (default: this week). */
  getWeekStats(day?: string): Promise<AdminDayStat[]>;
  /** Kommuner people are waiting for, most wanted first. */
  listKommuneWaitlist(): Promise<{ kommune: string; count: number }[]>;
}
