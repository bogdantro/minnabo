import { CATEGORIES, type CategoryRow } from '@/domain/categories';
import type {
  AgendaItem,
  AgreementSnapshot,
  AgreementTimeProposal,
  GuardianLinks,
  PriceRange,
  AppNotification,
  JobWorkspace,
  CompletionConfirmation,
  Conversation,
  Listing,
  ListingStatus,
  ListingType,
  Message,
  Proposal,
  NoticeboardPost,
  Partner,
  Donation,
  NoticeKind,
  PublicProfile,
  NoticeComment,
  PortfolioItem,
  ReliabilityDetails,
  Review,
  SkillEndorsement,
  VerificationKind,
} from '@/domain/types';
import type { Actor, ProposalEvent } from '@/domain/proposalMachine';
import type { Report } from '@/domain/types';
import { repositories } from '@mocks/data/repositories';
import { chatRepository } from '@mocks/data/chatRepository';
import { profileRepository } from '@mocks/data/profileRepository';
import { savedStore } from '@mocks/data/savedStore';
import { savedSearchStore } from '@mocks/data/savedSearchStore';
import { safetyStore } from '@mocks/data/safetyStore';
import { endorsementsStore } from '@mocks/data/endorsementsStore';
import { followStore } from '@mocks/data/followStore';
import { noticeboardStore } from '@mocks/data/noticeboardStore';
import { neighbourhoodStore } from '@mocks/data/neighbourhoodStore';
import { consentStore } from '@mocks/data/consentStore';
import { settingsStore } from '@mocks/data/settingsStore';
import { businessStore } from '@mocks/data/businessStore';
import { adminStore } from '@mocks/data/adminStore';
import { jobWorkspaceStore } from '@mocks/data/jobWorkspaceStore';
import { partners, documentedDonations } from '@mocks/data/seedCommunity';
import type {
  ApiClient,
  ListConversationsParams,
  AccountStatus,
  EditProposalPatch,
  ListingEditData,
  ListingExtras,
  BusinessProfile,
  ConsentRecord,
  MySettings,
  NotificationPrefs,
  ListListingsParams,
  NeighbourhoodInfo,
  ReviseProposalPatch,
  RespondToProposalResult,
  OfferCount,
  MyAccount,
  SavedSearchRecord,
  SendProposalInput,
  AppSettings,
  SharedContact,
  SubmitReportInput,
  SubmitReviewInput,
  UpdateProfilePatch,
} from '@/api/ApiClient';
import { DEFAULT_APP_SETTINGS } from '@/api/ApiClient';

const IS_TEST = process.env.NODE_ENV === 'test';
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, IS_TEST ? 0 : ms));

/**
 * In-memory API client backed by `src/data/*` repositories. Used by Jest only —
 * the runtime app uses `SupabaseApiClient`. Its method surface is the source of
 * truth for the `ApiClient` interface.
 */
/** State for the newer features, kept here so tests can read and reset it. */
export const extras = {
  time: [] as AgreementTimeProposal[],
  again: [] as { proposalId: string; when?: string; note?: string }[],
  price: {} as Record<string, PriceRange>,
  guardian: { youth: false, guardians: [], youths: [] } as GuardianLinks,
  waitlist: [] as string[],
  settings: { ...DEFAULT_APP_SETTINGS } as AppSettings,
  partnerEvents: [] as { partnerId: string; kind: 'impression' | 'click'; kommune?: string }[],
  /** report id → when a moderator on the website picked it up ("Under behandling") */
  claimedReports: {} as Record<string, string>,
  /** null = the database has the same list as the app's built-in one */
  categories: null as CategoryRow[] | null,
  reset() {
    this.categories = null;
    this.claimedReports = {};
    this.partnerEvents = [];
    this.settings = { ...DEFAULT_APP_SETTINGS };
    this.time = [];
    this.again = [];
    this.price = {};
    this.guardian = { youth: false, guardians: [], youths: [] };
    this.waitlist = [];
  },
};

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

  async createListing(listing: Listing, extras?: ListingExtras): Promise<Listing> {
    await delay(300);
    const full: Listing = {
      ...listing,
      offerAudience: extras?.offerAudience ?? 'ALL',
      maxDistanceKm: extras?.maxDistanceKm,
      estimatedMinutes: extras?.estimatedMinutes,
    };
    repositories.listings.add(full);
    repositories.listings.setEditData(full.id, {
      wizard: extras?.wizard ?? null,
      privateEstimateMinor: extras?.privateEstimateMinor ?? null,
    });
    return full;
  }

  async updateListing(listingId: string, listing: Listing, extras: ListingExtras): Promise<Listing> {
    await delay(250);
    const cur = repositories.listings.get(listingId);
    if (!cur || cur.owner.id !== profileRepository.currentUserId) throw new Error('Ikke tilgang.');
    if (!['DRAFT', 'PUBLISHED', 'RECEIVING_OFFERS', 'ACTIVE', 'PAUSED', 'EXPIRED'].includes(cur.status)) {
      throw new Error('Oppdraget kan ikke endres etter at et tilbud er godtatt.');
    }
    const next: Listing = {
      ...cur,
      title: listing.title,
      category: listing.category,
      price: listing.price,
      priceMode: listing.priceMode,
      location: { ...cur.location, municipality: listing.location.municipality, place: listing.location.place },
      images: listing.images,
      task: listing.task,
      status: cur.status === 'EXPIRED' ? 'PUBLISHED' : cur.status,
      offerAudience: extras.offerAudience,
      maxDistanceKm: extras.maxDistanceKm,
      estimatedMinutes: extras.estimatedMinutes,
      editedAt: new Date().toISOString(),
    };
    repositories.listings.replace(next);
    repositories.listings.setEditData(listingId, {
      wizard: extras.wizard ?? null,
      privateEstimateMinor: extras.privateEstimateMinor ?? null,
    });
    return next;
  }

  async getListingEditData(listingId: string): Promise<ListingEditData> {
    await delay(60);
    return repositories.listings.getEditData(listingId);
  }

  async getMyAccount(): Promise<MyAccount> {
    await delay(40);
    return { vipps: false, youth: false };
  }

  async listSentProposals(): Promise<Proposal[]> {
    await delay(100);
    return chatRepository.sentProposals();
  }

  async getMyAccountStatus(): Promise<AccountStatus> {
    await delay(40);
    return { suspended: adminStore.isSuspended(profileRepository.currentUserId), deleted: false };
  }

  async listMyListings(type?: ListingType): Promise<Listing[]> {
    await delay(150);
    return profileRepository.myListings(type);
  }

  async setListingStatus(listingId: string, status: ListingStatus): Promise<void> {
    await delay(150);
    const l = repositories.listings.get(listingId);
    if (!l || l.owner.id !== profileRepository.currentUserId) throw new Error('Fant ikke oppføringen.');
    repositories.listings.setStatus(listingId, status);
  }

  async notifyMatchingHelpers(listingId: string): Promise<number> {
    await delay(400);
    const listing = repositories.listings.get(listingId);
    if (!listing) return 0;
    const offers = repositories.listings.list({ type: 'SERVICE_OFFER' });
    const matches = offers.filter(
      (o) =>
        o.category.slug === listing.category.slug &&
        o.owner.id !== listing.owner.id,
    );
    // A dev build would enqueue a push to each; here we just report the count.
    return matches.length + 2;
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

  async setConversationMuted(): Promise<void> {
    await delay(20);
  }

  async markConversationsRead(conversationIds: string[]): Promise<void> {
    await delay(100);
    conversationIds.forEach((id) => chatRepository.markRead(id));
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

  async markProposalSeen(proposalId: string): Promise<void> {
    await delay(40);
    chatRepository.markProposalSeen(proposalId);
  }

  async editProposal(proposalId: string, patch: EditProposalPatch): Promise<Proposal> {
    await delay(150);
    return chatRepository.editProposal(proposalId, patch);
  }

  async respondToProposal(
    proposalId: string,
    event: ProposalEvent,
    actor: Actor,
  ): Promise<RespondToProposalResult> {
    await delay(150);
    return chatRepository.respondToProposal(proposalId, event, actor);
  }

  async cancelAgreement(proposalId: string, reason?: string): Promise<Proposal> {
    await delay(150);
    return chatRepository.cancelAgreement(proposalId, reason);
  }

  async getAgreement(proposalId: string): Promise<AgreementSnapshot | null> {
    await delay(120);
    return chatRepository.getAgreement(proposalId) ?? null;
  }

  // --- nytt tidspunkt / be om hjelp igjen / prisveiledning / foresatt / venteliste (in memory) ---
  async getAgreementTimeProposal(proposalId: string): Promise<AgreementTimeProposal | null> {
    await delay(40);
    return extras.time.find((t) => t.proposalId === proposalId && t.status === 'PENDING') ?? null;
  }

  async proposeAgreementTime(proposalId: string, scheduledAt: string, scheduledText: string): Promise<AgreementTimeProposal> {
    await delay(60);
    const me = chatRepository.currentUserId;
    if (Date.parse(scheduledAt) <= Date.now()) throw new Error('Velg et tidspunkt fram i tid.');
    extras.time.forEach((t) => {
      if (t.proposalId === proposalId && t.status === 'PENDING') t.status = t.proposedBy === me ? 'WITHDRAWN' : 'DECLINED';
    });
    const row: AgreementTimeProposal = { id: `time-${extras.time.length + 1}`, proposalId, proposedBy: me, scheduledAt, scheduledText, status: 'PENDING' };
    extras.time.push(row);
    return row;
  }

  async respondAgreementTime(id: string, answer: 'ACCEPT' | 'DECLINE' | 'WITHDRAW'): Promise<AgreementTimeProposal> {
    await delay(60);
    const row = extras.time.find((t) => t.id === id);
    if (!row || row.status !== 'PENDING') throw new Error('Forslaget er allerede besvart.');
    const mine = row.proposedBy === chatRepository.currentUserId;
    if (answer === 'WITHDRAW' ? !mine : mine) throw new Error('Den andre må svare på forslaget.');
    row.status = answer === 'ACCEPT' ? 'ACCEPTED' : answer === 'DECLINE' ? 'DECLINED' : 'WITHDRAWN';
    if (answer === 'ACCEPT') {
      const a = chatRepository.getAgreement(row.proposalId);
      if (a) {
        a.scheduledAt = row.scheduledAt;
        a.scheduledText = row.scheduledText;
      }
    }
    return row;
  }

  async requestHelpAgain(proposalId: string, input?: { when?: string; note?: string }): Promise<string> {
    await delay(60);
    extras.again.push({ proposalId, ...input });
    return `again-${extras.again.length}`;
  }

  async getPriceGuidance(categorySlug: string): Promise<PriceRange | null> {
    await delay(20);
    return extras.price[categorySlug] ?? null;
  }

  async getGuardianLinks(): Promise<GuardianLinks> {
    await delay(20);
    return { ...extras.guardian, guardians: [...extras.guardian.guardians], youths: [...extras.guardian.youths] };
  }

  async createGuardianCode(): Promise<string> {
    await delay(20);
    extras.guardian.code = { code: 'ABC234', expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() };
    return 'ABC234';
  }

  async linkGuardian(code: string): Promise<string> {
    await delay(20);
    if (code.replace(/\s/g, '').toUpperCase() !== 'ABC234') throw new Error('Koden er feil eller har utløpt. Be om en ny kode.');
    extras.guardian.youths.push({ id: `link-${extras.guardian.youths.length + 1}`, name: 'Ola N.', age: 16 });
    return 'Ola N.';
  }

  async unlinkGuardian(linkId: string): Promise<void> {
    await delay(20);
    extras.guardian.youths = extras.guardian.youths.filter((y) => y.id !== linkId);
    extras.guardian.guardians = extras.guardian.guardians.filter((g) => g.id !== linkId);
  }

  async joinKommuneWaitlist(kommune: string): Promise<void> {
    await delay(20);
    if (!extras.waitlist.includes(kommune)) extras.waitlist.push(kommune);
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
      myRating: profileRepository
        .reviewsWrittenBy(chatRepository.currentUserId)
        .find((r) => r.agreementProposalId === a.proposalId)?.rating,
    }));
  }

  async instantBook(listingId: string): Promise<{ proposalId: string }> {
    await delay(250);
    return chatRepository.instantBook(listingId);
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
        return jobWorkspaceStore.addChecklistItem(proposalId, action.text, action.who);
      case 'setChecklistWho':
        return jobWorkspaceStore.setChecklistWho(proposalId, action.itemId, action.who);
      case 'toggleChecklist':
        return jobWorkspaceStore.toggleChecklistItem(proposalId, action.itemId);
      case 'removeChecklist':
        return jobWorkspaceStore.removeChecklistItem(proposalId, action.itemId);
      case 'addMaterial':
        return jobWorkspaceStore.addMaterial(proposalId, action.label, action.amountKr, action.payer);
      case 'removeMaterial':
        return jobWorkspaceStore.removeMaterial(proposalId, action.itemId);
      case 'addPhoto':
        return jobWorkspaceStore.addPhoto(proposalId, action.url, action.phase, action.caption);
      case 'removePhoto':
        return jobWorkspaceStore.removePhoto(proposalId, action.itemId);
      case 'toggleTimer':
        return jobWorkspaceStore.toggleTimer(proposalId);
      case 'stopTimer':
        return jobWorkspaceStore.stopTimer(proposalId);
    }
  }

  async getProfile(id: string): Promise<PublicProfile> {
    await delay(150);
    const profile = profileRepository.getProfile(id);
    if (!profile) throw new Error('Fant ikke profilen.');
    // Like the database (0057): phone and home notes are never part of someone else's
    // profile – they come from getSharedContact.
    const own = id === profileRepository.currentUserId;
    return {
      ...profile,
      phone: undefined,
      homeNotes: own ? profile.homeNotes : undefined,
      reliability: profileRepository.reliabilityFor(id),
      endorsements: endorsementsStore.list(id),
    };
  }

  async canEndorse(profileId: string): Promise<boolean> {
    await delay(40);
    if (profileId === profileRepository.currentUserId) return false;
    return chatRepository.listMyAgreements().some((a) => a.counterpartId === profileId && !a.cancelled);
  }

  async logPartnerEvent(partnerId: string, kind: 'impression' | 'click', kommune?: string): Promise<void> {
    extras.partnerEvents.push({ partnerId, kind, kommune });
  }

  async listCategories(): Promise<CategoryRow[]> {
    await delay(20);
    return extras.categories ?? CATEGORIES.map((c, i) => ({ slug: c.slug, label: c.label, active: true, sortOrder: (i + 1) * 10 }));
  }

  async getAppSettings(): Promise<AppSettings> {
    await delay(20);
    return { ...extras.settings };
  }

  async getSharedContact(profileId: string): Promise<SharedContact> {
    await delay(60);
    const profile = profileRepository.getProfile(profileId);
    if (!profile) return {};
    if (profileId === profileRepository.currentUserId) return { phone: profile.phone, homeNotes: profile.homeNotes };
    const deals = chatRepository.listMyAgreements().filter((a) => a.counterpartId === profileId && !a.cancelled);
    if (!deals.length) return {};
    return { phone: profile.phone, homeNotes: profile.homeNotes };
  }

  async getReplyMinutes(profileId: string): Promise<number | null> {
    await delay(60);
    return profileId === profileRepository.currentUserId ? null : 60;
  }

  async getListingOfferCount(listingId: string): Promise<OfferCount> {
    await delay(60);
    const open = chatRepository
      .proposalsForListing(listingId)
      .filter((p) => p.status === 'SENT' || p.status === 'REVISION_PENDING' || p.status === 'ACCEPTED');
    return {
      count: new Set(open.map((p) => p.fromProfileId)).size,
      mine: open.some((p) => p.fromProfileId === profileRepository.currentUserId),
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

  async replyToReview(reviewId: string, reply: string): Promise<Review> {
    await delay(60);
    return profileRepository.replyToReview(reviewId, reply);
  }

  async getReliability(profileId: string): Promise<ReliabilityDetails> {
    await delay(40);
    return profileRepository.reliabilityDetails(profileId);
  }

  async listPortfolio(profileId: string): Promise<PortfolioItem[]> {
    await delay(40);
    return profileRepository.listPortfolio(profileId);
  }

  async addPortfolioItem(input: Parameters<ApiClient['addPortfolioItem']>[0]): Promise<PortfolioItem> {
    await delay(60);
    return profileRepository.addPortfolioItem(input);
  }

  async removePortfolioItem(id: string): Promise<void> {
    await delay(40);
    profileRepository.removePortfolioItem(id);
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

  async listPartners(): Promise<Partner[]> {
    await delay(80);
    return adminStore.visiblePartners(partners);
  }

  async listDonations(): Promise<Donation[]> {
    await delay(80);
    return documentedDonations;
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
    municipality: string;
    /** storage path in `listing-images` */
    imagePath?: string;
  }): Promise<NoticeboardPost> {
    await delay(150);
    return noticeboardStore.create(input);
  }

  async updateNoticeboardPost(id: string, patch: Parameters<ApiClient['updateNoticeboardPost']>[1]): Promise<NoticeboardPost> {
    await delay(60);
    return noticeboardStore.update(id, patch);
  }

  async listNoticeComments(noticeId: string): Promise<NoticeComment[]> {
    await delay(40);
    return noticeboardStore.comments(noticeId);
  }

  async addNoticeComment(noticeId: string, body: string): Promise<NoticeComment> {
    await delay(40);
    return noticeboardStore.addComment(noticeId, body);
  }

  async deleteNoticeComment(id: string): Promise<void> {
    await delay(40);
    noticeboardStore.removeComment(id);
  }

  async listSavedNoticeIds(): Promise<string[]> {
    await delay(40);
    return noticeboardStore.savedIds();
  }

  async toggleSavedNotice(noticeId: string): Promise<string[]> {
    await delay(40);
    return noticeboardStore.toggleSaved(noticeId);
  }

  async deleteNoticeboardPost(id: string): Promise<void> {
    await delay(80);
    noticeboardStore.remove(id);
  }

  // --- konto ---

  async deleteMyAccount(reason?: string): Promise<void> {
    await delay(300);
    profileRepository.deleteAccount(reason);
  }

  // --- innstillinger ---

  async getMySettings(): Promise<MySettings> {
    await delay(60);
    return settingsStore.get();
  }

  async updateNotificationPrefs(prefs: NotificationPrefs): Promise<MySettings> {
    await delay(80);
    return settingsStore.setPrefs(prefs);
  }

  async unregisterPushToken(): Promise<void> {
    await delay(10);
  }

  async registerPushToken(token: string): Promise<void> {
    await delay(20);
    settingsStore.addToken(token);
  }

  // --- personvern ---

  async listConsentRecords(): Promise<ConsentRecord[]> {
    await delay(80);
    return consentStore.list();
  }

  async setTipsConsent(on: boolean): Promise<ConsentRecord> {
    await delay(120);
    return consentStore.setTips(on);
  }

  // --- nabolag ---

  async getNeighbourhood(municipality: string, place: string): Promise<NeighbourhoodInfo> {
    await delay(80);
    return neighbourhoodStore.info(municipality, place, profileRepository.currentUserId);
  }

  async joinNeighbourhood(municipality: string, place: string): Promise<NeighbourhoodInfo> {
    await delay(120);
    neighbourhoodStore.join(municipality, place, profileRepository.currentUserId);
    return neighbourhoodStore.info(municipality, place, profileRepository.currentUserId);
  }

  async leaveNeighbourhood(municipality: string, place: string): Promise<NeighbourhoodInfo> {
    await delay(120);
    neighbourhoodStore.leave(municipality, place, profileRepository.currentUserId);
    return neighbourhoodStore.info(municipality, place, profileRepository.currentUserId);
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

  async setSavedSearchAlert(id: string, alert: boolean): Promise<void> {
    await delay(40);
    savedSearchStore.setAlert(id, alert);
  }

  async markSavedSearchRun(id: string): Promise<void> {
    await delay(40);
    savedSearchStore.markRun(id);
  }

  async removeSavedSearch(id: string): Promise<void> {
    await delay(60);
    savedSearchStore.remove(id);
  }

  // --- safety ---

  async listReports(): Promise<Report[]> {
    await delay(120);
    // like the real client: only what I reported myself
    return safetyStore
      .listReports()
      .filter((r) => r.byProfileId === profileRepository.currentUserId)
      .map((r) => ({ ...r, status: safetyStore.isResolved(r.id) ? 'RESOLVED' : 'OPEN', claimedAt: extras.claimedReports[r.id] }));
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

  async submitBusinessProfile(input: Parameters<ApiClient['submitBusinessProfile']>[0]): Promise<void> {
    await delay(200);
    businessStore.submit(profileRepository.currentUserId, input);
  }

  async getMyBusinessProfile(): Promise<BusinessProfile | null> {
    await delay(60);
    return businessStore.get(profileRepository.currentUserId);
  }
}
