import { CATEGORIES, type CategoryRow } from '@/domain/categories';
import { UserError } from '@/lib/errors';
import { isOpenListing } from '@/domain/editing';
import { isUrgent } from '@/domain/urgent';
import type {
  LinkPreview,
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
  AgreedSum,
  ListingQuestion,
  PoliceCertificate,
  ThankCard,
  ThankCardKind,
  YearRecap,
  CategoryJobs,
  EventMessage,
  EventRsvps,
  EventType,
  GuardianYouth,
  Household,
  LendCategory,
  LendItem,
  LendRequest,
  LendBusy,
  NoticePoll,
  NoticeQueue,
  NoticeReaction,
  NoticeReactionEmoji,
  NoticeReservation,
  PhotoDraft,
  RsvpStatus,
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
import { minnaboStore } from '@mocks/data/minnaboStore';
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
  NeighbourhoodHighlight,
  NabolagSummary,
  MinNaboMessage,
  ReviseProposalPatch,
  RespondToProposalResult,
  OfferCount,
  MyAccount,
  SavedSearchRecord,
  SendProposalInput,
  AppSettings,
  PartnerThanks,
  SharedContact,
  SubmitReportInput,
  SubmitReviewInput,
  UpdateProfilePatch,
} from '@/api/ApiClient';
import { DEFAULT_APP_SETTINGS } from '@/api/ApiClient';
import type { LendItemInput, PendingReview } from '@/api/ApiClient';
import { reviewDutyStore } from '@mocks/data/reviewDutyStore';
import { inbox } from './mockInbox';
import { MockOppdrag } from './mockOppdrag';
import type { NoticeTopic } from '@/domain/community';
import { noShowStore } from '@mocks/data/noShowStore';
import { noShowWindowOpen } from '@/domain/noShow';
import type { HelperStatus, NoShowReason, NoShowReport } from '@/domain/types';
import type { HelperSlots, RescueResult } from '@/api/ApiClient';

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
  partnerThanks: {} as PartnerThanks,
  /** report id → when a moderator on the website picked it up ("Under behandling") */
  claimedReports: {} as Record<string, string>,
  /** null = the database has the same list as the app's built-in one */
  categories: null as CategoryRow[] | null,
  deletedMessages: [] as string[],
  archived: {} as Record<string, boolean>,
  transcribed: [] as string[],
  slots: {} as Record<string, HelperSlots>,
  closedSlots: [] as string[],
  questions: [] as ListingQuestion[],
  views: {} as Record<string, number>,
  problemReports: [] as { body: string; imagePath?: string; context?: string }[],
  signedOutEverywhere: false,
  signups: {} as Record<string, string[]>,
  thanks: [] as ThankCard[],
  thankTo: null as string | null,
  recap: null as YearRecap | null,
  agreedSum: null as AgreedSum | null,
  police: { status: 'NONE' } as PoliceCertificate,
  // 0101
  visits: {} as Record<string, string[]>,
  photoDrafts: [] as string[],
  queues: {} as Record<string, NoticeReservation[]>,
  rsvp: {} as Record<string, Record<string, RsvpStatus>>,
  votes: {} as Record<string, Record<string, number>>,
  reactions: {} as Record<string, NoticeReaction[]>,
  eventMessages: [] as EventMessage[],
  translated: [] as string[],
  lendItems: [] as LendItem[],
  lendRequests: [] as LendRequest[],
  categoryJobs: {} as Record<string, CategoryJobs[]>,
  household: { inHousehold: false, listings: [], agreements: [] } as Household,
  partnerCodes: {} as Record<string, string>,
  guardianYouths: [] as GuardianYouth[],
  reset() {
    this.visits = {};
    this.photoDrafts = [];
    this.queues = {};
    this.rsvp = {};
    this.votes = {};
    this.reactions = {};
    this.eventMessages = [];
    this.translated = [];
    this.lendItems = [];
    this.lendRequests = [];
    this.categoryJobs = {};
    this.household = { inHousehold: false, listings: [], agreements: [] };
    this.partnerCodes = {};
    this.guardianYouths = [];
    this.views = {};
    this.problemReports = [];
    this.deletedMessages = [];
    this.archived = {};
    this.transcribed = [];
    this.slots = {};
    this.closedSlots = [];
    this.questions = [];
    this.signedOutEverywhere = false;
    this.signups = {};
    this.thanks = [];
    this.thankTo = null;
    this.recap = null;
    this.agreedSum = null;
    this.police = { status: 'NONE' };
    this.categories = null;
    this.claimedReports = {};
    this.partnerThanks = {};
    this.partnerEvents = [];
    this.settings = { ...DEFAULT_APP_SETTINGS };
    this.time = [];
    this.again = [];
    this.price = {};
    this.guardian = { youth: false, guardians: [], youths: [] };
    this.waitlist = [];
  },
};

export class MockApiClient extends MockOppdrag implements ApiClient {
  async listListings(params: ListListingsParams = {}): Promise<Listing[]> {
    await delay(250);
    return repositories.listings.list(params.filter, params.sort);
  }

  async getListing(id: string): Promise<Listing> {
    await delay(200);
    const listing = repositories.listings.get(id);
    if (!listing) throw new UserError('Fant ikke oppføringen.');
    return listing;
  }

  async createListing(listing: Listing, extras?: ListingExtras): Promise<Listing> {
    await delay(300);
    // like 0072: a finished job must be reviewed before a new oppdrag
    const owed = reviewDutyStore.list();
    if (owed.length) {
      throw new UserError(`Gi en vurdering av ${owed[0].otherName.split(' ')[0]} først. Stjerner er nok – kommentar er valgfritt.`);
    }
    // like 0071: one hasteoppdrag at a time
    if (
      extras?.urgentUntil &&
      repositories.listings.ownedBy(profileRepository.currentUserId).some((l) => isOpenListing(l.status) && isUrgent(l))
    ) {
      throw new UserError('Du har allerede et hasteoppdrag ute. Du kan ha ett om gangen – vent til fristen er ute, eller fjern «Det haster» på det andre oppdraget.');
    }
    const full: Listing = {
      ...listing,
      offerAudience: extras?.offerAudience ?? 'ALL',
      maxDistanceKm: extras?.maxDistanceKm,
      estimatedMinutes: extras?.estimatedMinutes,
      urgentUntil: extras?.urgentUntil ?? undefined,
      sharedStreet: extras?.sharedStreet || undefined,
      fromSenior: extras?.fromSenior || undefined,
    };
    repositories.listings.add(full);
    repositories.listings.setEditData(full.id, {
      wizard: extras?.wizard ?? null,
      privateEstimateMinor: extras?.privateEstimateMinor ?? null,
    });
    return full;
  }

  async updateOffer(listingId: string, listing: Listing): Promise<Listing> {
    await delay(200);
    const cur = repositories.listings.get(listingId);
    if (!cur || cur.owner.id !== profileRepository.currentUserId || cur.type !== 'SERVICE_OFFER') throw new UserError('Ikke tilgang.');
    if (listing.title.trim().length < 5) throw new UserError('Tittelen må ha minst 5 tegn.');
    if ((listing.offer?.about ?? '').trim().length < 20) throw new UserError('Fortell litt mer om hva du kan hjelpe med (minst 20 tegn).');
    const next: Listing = {
      ...cur,
      title: listing.title.trim(),
      category: listing.category,
      price: listing.price,
      priceMode: listing.priceMode,
      location: { ...cur.location, municipality: listing.location.municipality, place: listing.location.place },
      images: listing.images,
      offer: listing.offer,
      editedAt: new Date().toISOString(),
    };
    repositories.listings.replace(next);
    return next;
  }

  async updateListing(listingId: string, listing: Listing, extras: ListingExtras): Promise<Listing> {
    await delay(250);
    const cur = repositories.listings.get(listingId);
    if (!cur || cur.owner.id !== profileRepository.currentUserId) throw new UserError('Ikke tilgang.');
    if (!['DRAFT', 'PUBLISHED', 'RECEIVING_OFFERS', 'ACTIVE', 'PAUSED', 'EXPIRED'].includes(cur.status)) {
      throw new UserError('Oppdraget kan ikke endres etter at et tilbud er godtatt.');
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
      // like 0071: an edit never pushes the deadline later
      urgentUntil:
        extras.urgentUntil && cur.urgentUntil && extras.urgentUntil > cur.urgentUntil ? cur.urgentUntil : (extras.urgentUntil ?? undefined),
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
    if (!l || l.owner.id !== profileRepository.currentUserId) throw new UserError('Fant ikke oppføringen.');
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
    // my own pins, snoozes and timed mutes (0109)
    return chatRepository.listConversations(params).map((c) => ({ ...c, ...(inbox.flags[c.id] ?? {}) }));
  }

  async getConversation(id: string): Promise<Conversation> {
    await delay(150);
    const conv = chatRepository.getConversation(id);
    if (!conv) throw new UserError('Fant ikke samtalen.');
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

  async sendMessage(conversationId: string, text: string, replyToId?: string): Promise<Message> {
    await delay(120);
    const sent = chatRepository.sendMessage(conversationId, text);
    if (replyToId) sent.replyToId = replyToId;
    return sent;
  }

  async deleteMessage(messageId: string): Promise<void> {
    await delay(40);
    extras.deletedMessages.push(messageId);
  }

  async setConversationArchived(conversationId: string, archived: boolean): Promise<void> {
    await delay(40);
    extras.archived[conversationId] = archived;
  }

  async linkPreview(url: string): Promise<LinkPreview | null> {
    await delay(40);
    let host: string;
    try {
      host = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
    // demo pages, so the card can be seen in the test login
    const known: Record<string, Omit<LinkPreview, 'url' | 'host'>> = {
      'yr.no': { title: 'Været for Lillehammer – yr', description: 'Værvarsel for Lillehammer, time for time, de neste ni dagene.', site: 'Yr', image: null },
      'finn.no': { title: 'Hekksaks, nesten ny', description: 'Brukt én sesong. Hentes på Nordre Ål.', site: 'FINN.no', image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800' },
    };
    const hit = known[host];
    return hit ? { url, host, ...hit } : null;
  }

  async transcribeMessage(messageId: string): Promise<string> {
    await delay(40);
    extras.transcribed.push(messageId);
    return 'Hei, jeg er på vei.';
  }

  async getHelperSlots(listingId: string): Promise<HelperSlots> {
    await delay(20);
    return extras.slots[listingId] ?? { needed: repositories.listings.get(listingId)?.helpersNeeded ?? 1, taken: 0 };
  }

  async closeHelperSlots(listingId: string): Promise<void> {
    await delay(20);
    extras.closedSlots.push(listingId);
  }

  async listListingQuestions(listingId: string): Promise<ListingQuestion[]> {
    await delay(20);
    return extras.questions.filter((q) => q.listingId === listingId);
  }

  async askListingQuestion(listingId: string, body: string): Promise<ListingQuestion> {
    await delay(20);
    const q: ListingQuestion = { id: `q-${Date.now()}-${extras.questions.length}`, listingId, authorId: profileRepository.currentUserId, body, createdAt: new Date().toISOString() };
    extras.questions.push(q);
    return q;
  }

  async answerListingQuestion(id: string, answer: string): Promise<ListingQuestion> {
    await delay(20);
    const q = extras.questions.find((x) => x.id === id);
    if (!q) throw new UserError('Fant ikke spørsmålet.');
    q.answer = answer;
    q.answeredAt = new Date().toISOString();
    return q;
  }

  async deleteListingQuestion(id: string): Promise<void> {
    await delay(20);
    extras.questions = extras.questions.filter((q) => q.id !== id);
  }

  async signOutEverywhere(): Promise<void> {
    await delay(20);
    extras.signedOutEverywhere = true;
  }

  async listDugnadSignups(noticeId: string): Promise<string[]> {
    await delay(20);
    return extras.signups[noticeId] ?? [];
  }

  async setDugnadSignup(noticeId: string, join: boolean): Promise<number> {
    await delay(20);
    const me = profileRepository.currentUserId;
    const rest = (extras.signups[noticeId] ?? []).filter((p) => p !== me);
    extras.signups[noticeId] = join ? [...rest, me] : rest;
    return extras.signups[noticeId].length;
  }

  async sendThankCard(proposalId: string, card: ThankCardKind, message?: string): Promise<ThankCard> {
    await delay(20);
    const c: ThankCard = { id: `t-${extras.thanks.length + 1}`, proposalId, fromProfileId: profileRepository.currentUserId, toProfileId: extras.thankTo ?? 'u-other', card, message, createdAt: new Date().toISOString() };
    extras.thanks.push(c);
    return c;
  }

  async listThankCards(profileId: string): Promise<ThankCard[]> {
    await delay(20);
    return extras.thanks.filter((c) => c.toProfileId === profileId);
  }

  async getYearRecap(year: number): Promise<YearRecap> {
    await delay(20);
    return extras.recap ?? { year, helped: 0, gotHelp: 0, neighbours: 0, thanks: 0 };
  }

  async getAgreedSum(year: number): Promise<AgreedSum> {
    await delay(20);
    return extras.agreedSum ?? { year, totalMinor: 0, jobs: 0, people: [] };
  }

  async getMyPoliceCertificate(): Promise<PoliceCertificate> {
    await delay(20);
    return extras.police;
  }

  async submitPoliceCertificate(_path: string): Promise<void> {
    await delay(20);
    extras.police = { status: 'PENDING' };
  }

  async hasPoliceCertificate(_profileId: string): Promise<boolean> {
    await delay(20);
    return extras.police.status === 'APPROVED';
  }

  async sendAttachment(conversationId: string, attachmentUrl: string): Promise<Message> {
    await delay(150);
    return chatRepository.sendAttachment(conversationId, attachmentUrl);
  }

  async sendVoice(conversationId: string, attachmentUrl: string, durationMs: number): Promise<Message> {
    await delay(150);
    // like the 0077 insert rule: a voice message carries its file and length (max 2 min + slack)
    if (!attachmentUrl || !(durationMs >= 0 && durationMs <= 180_000)) throw new UserError('Talemeldingen kunne ikke sendes.');
    return chatRepository.sendVoice(conversationId, attachmentUrl, durationMs);
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
    if (!proposal) throw new UserError('Fant ikke tilbudet.');
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
    // like 0074: two no-shows in 90 days pause new tilbud
    const pause = noShowStore.pauseUntil();
    if (pause && Date.parse(pause) > Date.now()) {
      throw new UserError('Du kan gi tilbud igjen ' + new Date(pause).toLocaleDateString('nb-NO') + '. Du har uteblitt fra to avtaler de siste 90 dagene.');
    }
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
    const before = chatRepository.getProposal(proposalId);
    const a = chatRepository.getAgreement(proposalId);
    const out = chatRepository.cancelAgreement(proposalId, reason);
    // like 0074: the helper calling it off within 24 hours counts half, and the others are asked again
    if (before && before.fromProfileId === profileRepository.currentUserId && a?.scheduledAt && Date.parse(a.scheduledAt) < Date.now() + 24 * 3_600_000) {
      noShowStore.add({
        id: 'ns-' + Date.now(), proposalId, reason: 'HELPER_CANCELLED', status: 'COUNTED', weight: 0.5,
        countsAt: new Date().toISOString(), createdAt: new Date().toISOString(), explanation: reason,
        reporterName: '', reportedName: '', iAmReported: true, listingTitle: repositories.listings.get(before.listingId)?.title ?? '',
      });
      this.askOthers(before.id, before.listingId);
    }
    return out;
  }

  // --- no-show rescue (mirrors 0074) ---

  private askOthers(fromId: string, listingId: string): number {
    const others = chatRepository.proposalsForListing(listingId).filter((p) => p.id !== fromId && (p.status === 'SENT' || p.status === 'REVISION_PENDING'));
    for (const o of others) chatRepository.patchProposal(o.id, { rescueFrom: fromId, availableTodayAt: undefined });
    return others.length;
  }

  private makeUrgentToday(listingId: string): boolean {
    const l = repositories.listings.get(listingId);
    if (!l) return false;
    const mine = repositories.listings.ownedBy(profileRepository.currentUserId);
    if (mine.some((x) => x.id !== listingId && isOpenListing(x.status) && isUrgent(x))) return false;
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    repositories.listings.replace({ ...l, urgentUntil: end.toISOString() });
    repositories.listings.setStatus(listingId, 'RECEIVING_OFFERS');
    return true;
  }

  async reportHelperNoShow(proposalId: string, reason: Exclude<NoShowReason, 'HELPER_CANCELLED'>, makeUrgent: boolean): Promise<RescueResult> {
    await delay(150);
    const p = chatRepository.getProposal(proposalId);
    const a = chatRepository.getAgreement(proposalId);
    if (!p || p.toProfileId !== profileRepository.currentUserId) throw new UserError('Bare den som la ut oppdraget kan melde fra om dette.');
    if (p.status !== 'ACCEPTED' || !a || a.cancelledAt) throw new UserError('Avtalen er ikke aktiv lenger.');
    if (!noShowWindowOpen(a)) throw new UserError('Du kan melde fra fra morgenen på jobbdagen.');
    const label = { NO_SHOW: 'Hjelperen kom ikke', NO_REPLY: 'Hjelperen svarte ikke', LATE: 'Hjelperen kom for sent' }[reason];
    const id = 'ns-' + Date.now();
    noShowStore.add({
      id, proposalId, reason, status: 'PENDING', weight: reason === 'LATE' ? 0.5 : 1,
      countsAt: new Date(Date.now() + 48 * 3_600_000).toISOString(), createdAt: new Date().toISOString(),
      reporterName: profileRepository.getProfile(profileRepository.currentUserId)?.displayName.split(' ')[0] ?? '',
      reportedName: profileRepository.getProfile(p.fromProfileId)?.displayName.split(' ')[0] ?? '',
      iAmReported: false, listingTitle: repositories.listings.get(p.listingId)?.title ?? '',
    });
    chatRepository.cancelAgreement(proposalId, label);
    const urgent = makeUrgent ? this.makeUrgentToday(p.listingId) : false;
    return { urgent, others: this.askOthers(proposalId, p.listingId), reportId: id };
  }

  async makeRescueUrgent(proposalId: string): Promise<void> {
    await delay(100);
    const p = chatRepository.getProposal(proposalId);
    if (!p || p.toProfileId !== profileRepository.currentUserId || p.status !== 'CANCELLED') throw new UserError('Ikke tilgang.');
    if (!this.makeUrgentToday(p.listingId)) throw new UserError('Du har allerede et hasteoppdrag ute. Du kan ha ett om gangen.');
  }

  async confirmStillAvailable(proposalId: string): Promise<void> {
    await delay(100);
    const p = chatRepository.getProposal(proposalId);
    if (!p || p.fromProfileId !== profileRepository.currentUserId) throw new UserError('Ikke tilgang.');
    if (p.status !== 'SENT' && p.status !== 'REVISION_PENDING') throw new UserError('Tilbudet er ikke åpent lenger.');
    chatRepository.patchProposal(proposalId, { availableTodayAt: p.availableTodayAt ?? new Date().toISOString() });
  }

  private helperAgreement(proposalId: string) {
    const p = chatRepository.getProposal(proposalId);
    const a = chatRepository.getAgreement(proposalId);
    if (!p || p.fromProfileId !== profileRepository.currentUserId) throw new UserError('Ikke tilgang.');
    if (p.status !== 'ACCEPTED' || !a || a.cancelledAt) throw new UserError('Avtalen er ikke aktiv lenger.');
    return { p, a };
  }

  async confirmAttendance(proposalId: string): Promise<void> {
    await delay(100);
    const { p, a } = this.helperAgreement(proposalId);
    if (a.helperConfirmedAt) return;
    chatRepository.patchAgreement(proposalId, { helperConfirmedAt: new Date().toISOString() });
    chatRepository.addSystemMessage(p.conversationId, 'Avtalen er bekreftet');
  }

  async setHelperStatus(proposalId: string, status: HelperStatus, place?: string): Promise<void> {
    await delay(100);
    const { p, a } = this.helperAgreement(proposalId);
    const now = new Date().toISOString();
    // like 0078: only «framme» carries a place, clipped to 80 characters
    const helperStatusPlace = status === 'ARRIVED' ? place?.trim().slice(0, 80) || undefined : undefined;
    chatRepository.patchAgreement(proposalId, { helperStatus: status, helperStatusAt: now, helperConfirmedAt: a.helperConfirmedAt ?? now, helperStatusPlace });
    chatRepository.addSystemMessage(p.conversationId, status === 'ON_THE_WAY' ? 'Hjelperen er på vei' : 'Hjelperen er framme');
  }

  async getNoShowReport(id: string): Promise<NoShowReport> {
    await delay(80);
    const r = noShowStore.get(id);
    if (!r) throw new UserError('Fant ikke saken.');
    return r;
  }

  async explainNoShow(id: string, text: string): Promise<void> {
    await delay(100);
    const r = noShowStore.get(id);
    if (!r || !r.iAmReported) throw new UserError('Ikke tilgang.');
    if (r.status !== 'PENDING') throw new UserError('Du har allerede svart på denne.');
    if (Date.parse(r.countsAt) <= Date.now()) throw new UserError('Fristen på 48 timer er ute.');
    if (text.trim().length < 10) throw new UserError('Skriv litt mer om hva som skjedde.');
    noShowStore.patch(id, { status: 'DISPUTED', explanation: text.trim(), explainedAt: new Date().toISOString() });
  }

  async getMyTilbudPause(): Promise<string | null> {
    await delay(40);
    const until = noShowStore.pauseUntil();
    return until && Date.parse(until) > Date.now() ? until : null;
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
    if (Date.parse(scheduledAt) <= Date.now()) throw new UserError('Velg et tidspunkt fram i tid.');
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
    if (!row || row.status !== 'PENDING') throw new UserError('Forslaget er allerede besvart.');
    const mine = row.proposedBy === chatRepository.currentUserId;
    if (answer === 'WITHDRAW' ? !mine : mine) throw new UserError('Den andre må svare på forslaget.');
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
    if (code.replace(/\s/g, '').toUpperCase() !== 'ABC234') throw new UserError('Koden er feil eller har utløpt. Be om en ny kode.');
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
    if (!profile) throw new UserError('Fant ikke profilen.');
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

  async getPartnerThanks(): Promise<PartnerThanks> {
    await delay(20);
    return { ...extras.partnerThanks };
  }

  async thankPartner(partnerId: string): Promise<number> {
    await delay(40);
    const cur = extras.partnerThanks[partnerId] ?? { count: 0, mine: false };
    // once per person per partner
    const next = cur.mine ? cur : { count: cur.count + 1, mine: true };
    extras.partnerThanks = { ...extras.partnerThanks, [partnerId]: next };
    return next.count;
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
    // like submit_review (0060): stars are required, the text is not
    if (!input.rating || input.rating < 1 || input.rating > 5) throw new UserError('Velg mellom 1 og 5 stjerner.');
    reviewDutyStore.done(input.agreementProposalId);
    return profileRepository.submitReview(input);
  }

  async listPendingReviews(): Promise<PendingReview[]> {
    await delay(60);
    return reviewDutyStore.list();
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
    linkLend();
    return noticeboardStore.list(kind).map((p) => ({ ...p, lendItemId: extras.lendItems.find((i) => i.noticeId === p.id)?.id }));
  }

  async createNoticeboardPost(input: {
    kind: NoticeKind;
    title: string;
    body: string;
    place: string;
    municipality: string;
    /** storage path in `listing-images` */
    imagePath?: string;
    imagePaths?: string[];
    neighbourhoodId?: string;
    isDugnad?: boolean;
    eventAt?: string;
    /** an arrangement (0101); DUGNAD also sets isDugnad */
    eventType?: EventType;
    /** «Avstemning»: 2–6 choices (0101) */
    pollOptions?: string[];
    topic?: NoticeTopic;
    organisationId?: string;
    repeatWeekly?: boolean;
  }): Promise<NoticeboardPost> {
    await delay(150);
    const hood = input.neighbourhoodId ? neighbourhoodStore.byId(input.neighbourhoodId) : undefined;
    if (input.neighbourhoodId && !neighbourhoodStore.isMember(input.neighbourhoodId, profileRepository.currentUserId)) {
      throw new Error('new row violates row-level security policy');
    }
    const post = noticeboardStore.create(hood ? { ...input, place: hood.place, municipality: hood.municipality } : input);
    if (post.kind === 'TOOL_LEND') extras.lendItems = [itemFromNotice(post), ...extras.lendItems];
    return post;
  }

  async updateNoticeboardPost(id: string, patch: Parameters<ApiClient['updateNoticeboardPost']>[1]): Promise<NoticeboardPost> {
    await delay(60);
    const post = noticeboardStore.update(id, patch);
    const item = extras.lendItems.find((i) => i.noticeId === id);
    if (item && post.kind !== 'TOOL_LEND') Object.assign(item, { active: false, noticeId: undefined });
    else if (item) {
      Object.assign(item, {
        title: post.title.slice(0, 60),
        note: post.body.slice(0, 300) || undefined,
        active: !post.doneAt,
        ...(patch.imagePaths !== undefined || patch.imagePath !== undefined ? { imagePath: post.imageUrls?.[0], imageUrl: post.imageUrls?.[0] } : {}),
      });
    } else linkLend();
    return post;
  }

  async listNoticeComments(noticeId: string): Promise<NoticeComment[]> {
    await delay(40);
    return noticeboardStore.comments(noticeId);
  }

  async addNoticeComment(noticeId: string, body: string, parentId?: string): Promise<NoticeComment> {
    await delay(40);
    return noticeboardStore.addComment(noticeId, body, profileRepository.currentUserId, parentId);
  }

  async keepNotice(id: string): Promise<void> {
    await delay(40);
    noticeboardStore.keep(id);
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

  async toggleNoticeLike(noticeId: string, liked: boolean): Promise<void> {
    await delay(40);
    noticeboardStore.setLiked(noticeId, liked);
  }

  async deleteNoticeboardPost(id: string): Promise<void> {
    await delay(80);
    noticeboardStore.remove(id);
    extras.lendItems = extras.lendItems.filter((i) => i.noticeId !== id);
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

  private invites = new Map<string, string>();

  async recordInvite(inviterId: string): Promise<boolean> {
    await delay(40);
    const me = profileRepository.currentUserId;
    // like 0081: not yourself, an existing inviter, and only the first answer counts
    if (inviterId === me || !profileRepository.getProfile(inviterId) || this.invites.has(me)) return false;
    this.invites.set(me, inviterId);
    return true;
  }

  async inviteCount(profileId: string): Promise<number> {
    await delay(30);
    return [...this.invites.values()].filter((id) => id === profileId).length;
  }

  async neighbourhoodHighlights(municipality: string): Promise<NeighbourhoodHighlight[]> {
    await delay(60);
    // stand-in for 0080: opted-in adults in the kommune, most finished jobs first, at most three
    return profileRepository
      .allProfiles()
      .filter((p) => p.highlightOptIn && p.youthAge == null && p.location.municipality === municipality && (p.completedTasks ?? 0) > 0)
      .sort((a, b) => (b.completedTasks ?? 0) - (a.completedTasks ?? 0))
      .slice(0, 3)
      .map((p) => ({ profileId: p.id, jobs: p.completedTasks ?? 0 }));
  }

  async getNeighbourhood(municipality: string, place: string): Promise<NeighbourhoodInfo> {
    await delay(80);
    return neighbourhoodStore.info(municipality, place, profileRepository.currentUserId);
  }

  async joinNeighbourhood(municipality: string, place: string): Promise<NeighbourhoodInfo> {
    await delay(120);
    const me = profileRepository.currentUserId;
    const id = neighbourhoodStore.info(municipality, place, me).id;
    if (!id) throw new UserError('Fant ikke nabolaget.');
    neighbourhoodStore.joinById(id, me);
    return neighbourhoodStore.info(municipality, place, me);
  }

  async leaveNeighbourhood(municipality: string, place: string): Promise<NeighbourhoodInfo> {
    await delay(120);
    const me = profileRepository.currentUserId;
    const id = neighbourhoodStore.info(municipality, place, me).id;
    if (id) neighbourhoodStore.leaveById(id, me);
    return neighbourhoodStore.info(municipality, place, me);
  }

  async getMinNaboThread(): Promise<MinNaboMessage[]> {
    await delay(40);
    return minnaboStore.thread(profileRepository.currentUserId);
  }

  async replyToMinNabo(body: string): Promise<void> {
    await delay(40);
    minnaboStore.reply(body);
  }

  async reportProblem(input: { body: string; imagePath?: string; context?: string }): Promise<void> {
    await delay(60);
    if (input.body.trim().length < 3) throw new UserError('Skriv litt om hva som skjedde.');
    extras.problemReports.push(input);
    minnaboStore.reply(`Feilmelding fra appen${input.context ? ` (${input.context})` : ''}\n${input.body.trim()}`);
  }

  async recordListingView(listingId: string): Promise<void> {
    extras.views[listingId] = (extras.views[listingId] ?? 0) + 1;
  }

  async listingViewCount(listingId: string): Promise<number | null> {
    await delay(20);
    const l = repositories.listings.get(listingId);
    if (!l || l.owner.id !== profileRepository.currentUserId) return null;
    return extras.views[listingId] ?? 0;
  }

  async voteMinNaboPoll(broadcastId: string, option: number): Promise<void> {
    await delay(40);
    minnaboStore.vote(broadcastId, option, profileRepository.currentUserId);
  }

  async markMinNaboRead(): Promise<void> {
    await delay(20);
    minnaboStore.markRead();
  }

  async listNabolag(municipality?: string): Promise<NabolagSummary[]> {
    await delay(60);
    return neighbourhoodStore.list(municipality, profileRepository.currentUserId);
  }

  async joinNabolag(id: string): Promise<void> {
    await delay(80);
    neighbourhoodStore.joinById(id, profileRepository.currentUserId);
  }

  async leaveNabolag(id: string): Promise<void> {
    await delay(80);
    neighbourhoodStore.leaveById(id, profileRepository.currentUserId);
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

  // --- 0101: utvidelse ---

  async setAgreementRepeat(proposalId: string, everyDays: 7 | 14 | 28, until?: string | null): Promise<void> {
    await delay(40);
    const a = chatRepository.getAgreement(proposalId);
    if (!a || a.cancelledAt) throw new UserError('Avtalen er ikke aktiv.');
    if (!a.scheduledAt) throw new UserError('Avtal første gang først, så kan den gjentas.');
    chatRepository.patchAgreement(proposalId, { repeatEveryDays: everyDays, repeatUntil: until ?? undefined, repeatEndedAt: undefined });
  }

  async endAgreementRepeat(proposalId: string): Promise<void> {
    await delay(40);
    chatRepository.patchAgreement(proposalId, { repeatEndedAt: new Date().toISOString() });
  }

  async markAgreementVisit(proposalId: string, visitAt: string): Promise<void> {
    await delay(30);
    const list = extras.visits[proposalId] ?? [];
    if (!list.includes(visitAt)) extras.visits[proposalId] = [visitAt, ...list];
  }

  async listAgreementVisits(proposalId: string): Promise<string[]> {
    await delay(20);
    return [...(extras.visits[proposalId] ?? [])].sort((x, y) => Date.parse(y) - Date.parse(x));
  }

  async draftFromPhoto(imagePath: string): Promise<PhotoDraft> {
    await delay(300);
    extras.photoDrafts.push(imagePath);
    return { categorySlug: 'hage', title: 'Rydde i hagen', description: 'Hagen trenger en runde: klippe plenen, rake løv og fylle sekker. Utstyr finnes.' };
  }

  async reserveNotice(noticeId: string, join: boolean): Promise<number> {
    await delay(30);
    const me = profileRepository.currentUserId;
    const post = notice(noticeId);
    if (!post || post.kind !== 'GIVEAWAY') throw new UserError('Fant ikke oppslaget.');
    if (post.authorProfileId === me) throw new UserError('Dette er ditt eget oppslag.');
    const queue = extras.queues[noticeId] ?? [];
    if (join) {
      if (post.doneAt) throw new UserError('Den er allerede gitt bort.');
      if (!queue.some((r) => r.profileId === me)) queue.push({ profileId: me, status: 'QUEUED', createdAt: new Date().toISOString() });
    } else {
      const mine = queue.find((r) => r.profileId === me);
      if (mine && (mine.status === 'QUEUED' || mine.status === 'OFFERED')) queue.splice(queue.indexOf(mine), 1);
    }
    extras.queues[noticeId] = queue;
    offerNext(noticeId);
    const waiting = queue.filter((r) => r.status === 'QUEUED' || r.status === 'OFFERED');
    return waiting.findIndex((r) => r.profileId === me) + 1;
  }

  async noticeQueue(noticeId: string): Promise<NoticeQueue> {
    await delay(20);
    const me = profileRepository.currentUserId;
    const queue = extras.queues[noticeId] ?? [];
    const waiting = queue.filter((r) => r.status === 'QUEUED' || r.status === 'OFFERED');
    return { waiting: waiting.length, mine: queue.find((r) => r.profileId === me)?.status ?? '', position: waiting.findIndex((r) => r.profileId === me) + 1 };
  }

  async listNoticeReservations(noticeId: string): Promise<NoticeReservation[]> {
    await delay(20);
    return [...(extras.queues[noticeId] ?? [])];
  }

  async settleReservation(noticeId: string, taken: boolean): Promise<void> {
    await delay(30);
    if (notice(noticeId)?.authorProfileId !== profileRepository.currentUserId) throw new UserError('Ikke tilgang.');
    const queue = extras.queues[noticeId] ?? [];
    const cur = queue.find((r) => r.status === 'OFFERED');
    if (!cur) throw new UserError('Ingen står først i køen.');
    cur.status = taken ? 'TAKEN' : 'SKIPPED';
    if (taken) noticeboardStore.update(noticeId, { done: true });
    else offerNext(noticeId);
  }

  async setEventRsvp(noticeId: string, status: RsvpStatus | null): Promise<void> {
    await delay(30);
    const me = profileRepository.currentUserId;
    const all = { ...(extras.rsvp[noticeId] ?? {}) };
    if (status) all[me] = status;
    else delete all[me];
    extras.rsvp[noticeId] = all;
    // a dugnad keeps its old list of who comes
    const rest = (extras.signups[noticeId] ?? []).filter((p) => p !== me);
    extras.signups[noticeId] = status ? [...rest, me] : rest;
  }

  async eventRsvps(noticeId: string): Promise<EventRsvps> {
    await delay(20);
    const me = profileRepository.currentUserId;
    const statuses: Record<string, RsvpStatus> = {};
    for (const id of extras.signups[noticeId] ?? []) statuses[id] = 'GOING';
    Object.assign(statuses, extras.rsvp[noticeId] ?? {});
    const entries = Object.entries(statuses);
    return {
      going: entries.filter(([, s]) => s === 'GOING').length,
      maybe: entries.filter(([, s]) => s === 'MAYBE').length,
      mine: statuses[me] ?? null,
      goingIds: entries.filter(([, s]) => s === 'GOING').map(([id]) => id),
    };
  }

  async voteNoticePoll(noticeId: string, option: number | null): Promise<void> {
    await delay(30);
    const post = notice(noticeId);
    if (!post?.pollOptions) throw new UserError('Fant ikke avstemningen.');
    if (option !== null && (option < 0 || option >= post.pollOptions.length)) throw new UserError('Ugyldig valg.');
    const votes = { ...(extras.votes[noticeId] ?? {}) };
    if (option === null) delete votes[profileRepository.currentUserId];
    else votes[profileRepository.currentUserId] = option;
    extras.votes[noticeId] = votes;
  }

  async noticePoll(noticeId: string): Promise<NoticePoll | null> {
    await delay(20);
    const post = notice(noticeId);
    if (!post?.pollOptions) return null;
    const votes = extras.votes[noticeId] ?? {};
    const counts = post.pollOptions.map((_, i) => Object.values(votes).filter((v) => v === i).length);
    return { counts, total: Object.keys(votes).length, mine: votes[profileRepository.currentUserId] ?? null };
  }

  async listNoticeReactions(noticeId: string): Promise<NoticeReaction[]> {
    await delay(15);
    return [...(extras.reactions[noticeId] ?? [])];
  }

  async setNoticeReaction(noticeId: string, emoji: NoticeReactionEmoji, on: boolean): Promise<void> {
    await delay(20);
    const me = profileRepository.currentUserId;
    const rest = (extras.reactions[noticeId] ?? []).filter((r) => !(r.profileId === me && r.emoji === emoji));
    extras.reactions[noticeId] = on ? [...rest, { profileId: me, emoji }] : rest;
  }

  async canUseEventChat(noticeId: string): Promise<boolean> {
    await delay(15);
    const me = profileRepository.currentUserId;
    const post = notice(noticeId);
    if (!post || extras.guardian.youth) return false;
    if (post.eventAt && Date.parse(post.eventAt) < Date.now() - 7 * 86_400_000) return false;
    const rsvp = await this.eventRsvps(noticeId);
    return post.authorProfileId === me || rsvp.mine !== null;
  }

  async listEventMessages(noticeId: string): Promise<EventMessage[]> {
    await delay(20);
    if (!(await this.canUseEventChat(noticeId))) return [];
    return extras.eventMessages.filter((m) => m.noticeId === noticeId);
  }

  async postEventMessage(noticeId: string, body: string): Promise<EventMessage> {
    await delay(30);
    if (!(await this.canUseEventChat(noticeId))) throw new UserError('Chatten er stengt.');
    const m: EventMessage = { id: `em-${extras.eventMessages.length + 1}`, noticeId, authorProfileId: profileRepository.currentUserId, body: body.trim(), createdAt: new Date().toISOString() };
    extras.eventMessages.push(m);
    return m;
  }

  async translateMessage(messageId: string): Promise<string> {
    await delay(200);
    extras.translated.push(messageId);
    return 'Hei! Jeg kan hjelpe deg med dette på lørdag.';
  }

  async getLendItem(id: string): Promise<LendItem | null> {
    await delay(20);
    linkLend();
    const me = profileRepository.currentUserId;
    return extras.lendItems.find((i) => i.id === id && (i.active || i.ownerId === me)) ?? null;
  }

  async listLendItems(filter: { ownerId?: string; municipality?: string }): Promise<LendItem[]> {
    await delay(20);
    linkLend();
    return extras.lendItems.filter((i) => (!filter.ownerId || i.ownerId === filter.ownerId) && (!filter.municipality || (i.municipality === filter.municipality && i.active)));
  }

  async saveLendItem(input: LendItemInput): Promise<LendItem> {
    await delay(30);
    const me = profileRepository.currentUserId;
    const existing = input.id ? extras.lendItems.find((i) => i.id === input.id && i.ownerId === me) : undefined;
    const hood = !existing && input.neighbourhoodId ? neighbourhoodStore.byId(input.neighbourhoodId) : undefined;
    if (hood && !neighbourhoodStore.isMember(hood.id, me)) throw new UserError('Du er ikke med i det nabolaget.');
    const item: LendItem = {
      id: existing?.id ?? `li-${extras.lendItems.length + 1}-${Date.now()}`,
      ownerId: me,
      title: input.title.trim(),
      category: input.category,
      note: input.note?.trim() || undefined,
      imagePath: input.imagePath === undefined ? existing?.imagePath : input.imagePath ?? undefined,
      imageUrl: input.imagePath === undefined ? existing?.imageUrl : input.imagePath ?? undefined,
      municipality: existing?.municipality ?? hood?.municipality ?? profileRepository.getProfile(me)?.location.municipality ?? '',
      active: input.active ?? existing?.active ?? true,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      noticeId: existing?.noticeId,
      neighbourhoodId: existing?.neighbourhoodId ?? hood?.id,
    };
    extras.lendItems = [item, ...extras.lendItems.filter((i) => i.id !== item.id)];
    // its «Lån ut» oppslag, like the database (0107)
    if (item.noticeId && noticeboardStore.get(item.noticeId)) {
      const n = noticeboardStore.get(item.noticeId)!;
      noticeboardStore._patch(item.noticeId, {
        title: item.title,
        body: item.note ?? '',
        imageUrl: item.imageUrl,
        imageUrls: item.imageUrl ? [item.imageUrl] : [],
        imagePaths: item.imagePath ? [item.imagePath] : [],
        doneAt: item.active ? undefined : (n.doneAt ?? new Date().toISOString()),
      });
    } else linkLend();
    return item;
  }

  async deleteLendItem(id: string): Promise<void> {
    await delay(20);
    const item = extras.lendItems.find((i) => i.id === id && i.ownerId === profileRepository.currentUserId);
    if (!item) return;
    extras.lendItems = extras.lendItems.filter((i) => i.id !== id);
    if (item.noticeId) noticeboardStore.remove(item.noticeId);
  }

  async requestLend(itemId: string, fromDate: string, toDate: string, note?: string): Promise<void> {
    await delay(30);
    const me = profileRepository.currentUserId;
    const item = extras.lendItems.find((i) => i.id === itemId && i.active);
    if (!item) throw new UserError('Fant ikke tingen.');
    if (item.ownerId === me) throw new UserError('Dette er din egen ting.');
    if (toDate < fromDate) throw new UserError('Velg opptil 30 dager, fra i dag.');
    const clash = extras.lendRequests.some((r) => r.itemId === itemId && r.status === 'ACCEPTED' && !(toDate < r.fromDate || fromDate > r.toDate));
    if (clash) throw new UserError('Den er lånt ut da. Velg andre dager.');
    extras.lendRequests.push({
      id: `lr-${extras.lendRequests.length + 1}`,
      itemId,
      itemTitle: item.title,
      ownerId: item.ownerId,
      borrowerId: me,
      fromDate,
      toDate,
      note: note?.trim() || undefined,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });
  }

  async listLendRequests(): Promise<LendRequest[]> {
    await delay(20);
    const me = profileRepository.currentUserId;
    return extras.lendRequests.filter((r) => r.borrowerId === me || r.ownerId === me);
  }

  async lendBusyDays(itemId: string): Promise<LendBusy[]> {
    await delay(15);
    const today = new Date().toISOString().slice(0, 10);
    return extras.lendRequests
      .filter((r) => r.itemId === itemId && r.status === 'ACCEPTED' && r.toDate >= today)
      .sort((a, b) => a.fromDate.localeCompare(b.fromDate))
      .map((r) => ({ fromDate: r.fromDate, toDate: r.toDate }));
  }

  async respondLend(id: string, status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED', reply?: string): Promise<void> {
    await delay(30);
    const me = profileRepository.currentUserId;
    const r = extras.lendRequests.find((x) => x.id === id);
    if (!r) throw new UserError('Fant ikke forespørselen.');
    if (status === 'CANCELLED' ? r.borrowerId !== me : r.ownerId !== me) throw new UserError('Ikke tilgang.');
    if (status !== 'CANCELLED' && r.status !== 'PENDING') throw new UserError('Forespørselen er allerede besvart.');
    if (status === 'CANCELLED' && r.status !== 'PENDING' && r.status !== 'ACCEPTED') throw new UserError('Forespørselen er allerede avsluttet.');
    r.status = status;
    if (status !== 'CANCELLED' && reply?.trim()) r.reply = reply.trim().slice(0, 300);
  }

  async profileCategoryJobs(profileId: string): Promise<CategoryJobs[]> {
    await delay(20);
    return extras.categoryJobs[profileId] ?? [];
  }

  async myHousehold(): Promise<Household> {
    await delay(20);
    return { ...extras.household, listings: [...extras.household.listings], agreements: [...extras.household.agreements] };
  }

  async householdInviteCode(): Promise<string> {
    await delay(30);
    if (extras.guardian.youth) throw new UserError('Husstand er ikke tilgjengelig for ungdomskontoer.');
    if (extras.household.partner) throw new UserError('Husstanden har allerede to personer.');
    const code = 'K7P2QX';
    extras.household = { ...extras.household, inHousehold: true, code: { code, expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() } };
    return code;
  }

  async householdJoin(code: string): Promise<void> {
    await delay(30);
    if (code.replace(/\s/g, '').toUpperCase() !== 'ABC123') throw new UserError('Koden er feil eller utløpt.');
    if (extras.household.partner) throw new UserError('Du er allerede i en husstand. Forlat den først.');
    const at = (days: number, hour: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    extras.household = {
      inHousehold: true,
      since: new Date().toISOString(),
      partner: { id: 'u-emma', name: 'Emma Larsen' },
      listings: [
        { id: 'l-vaskehjelp', title: 'Vaskehjelp før visning', status: 'RECEIVING_OFFERS', createdAt: new Date().toISOString(), categorySlug: 'rengjoring' },
        { id: 'l-hekk', title: 'Klippe hekken', status: 'PUBLISHED', createdAt: new Date(Date.now() - 86_400_000).toISOString(), categorySlug: 'hage' },
      ],
      agreements: [
        { proposalId: 'p-h1', title: 'Snømåking av oppkjørselen', scheduledAt: at(1, 7), with: 'Jonas Berg', who: 'partner', categorySlug: 'snomaking' },
        { proposalId: 'p-h2', title: 'Montere hyller i boden', scheduledAt: at(1, 17), with: 'Andreas Holm', who: 'me', categorySlug: 'montering' },
        { proposalId: 'p-h3', title: 'Hundelufting', scheduledAt: at(3, 12), with: 'Nora Lie', who: 'both', categorySlug: 'dyrepass' },
        { proposalId: 'p-h4', title: 'Maling av gjerdet', scheduledText: 'En dag i neste uke', with: 'Martin Dahl', who: 'partner', categorySlug: 'maling' },
      ],
    };
  }

  async householdLeave(): Promise<void> {
    await delay(20);
    extras.household = { inHousehold: false, listings: [], agreements: [] };
  }

  async partnerHelperCode(partnerId: string): Promise<string | null> {
    await delay(20);
    const me = profileRepository.getProfile(profileRepository.currentUserId);
    return (me?.completedTasks ?? 0) > 0 ? (extras.partnerCodes[partnerId] ?? null) : null;
  }

  async guardianOverview(): Promise<GuardianYouth[]> {
    await delay(20);
    return extras.guardianYouths.map((y) => ({ ...y, agreements: [...y.agreements] }));
  }
}

/** The first one waiting gets it (like offer_next_reservation in 0101). */
function offerNext(noticeId: string) {
  const queue = extras.queues[noticeId] ?? [];
  if (queue.some((r) => r.status === 'OFFERED' || r.status === 'TAKEN')) return;
  const next = queue.find((r) => r.status === 'QUEUED');
  if (next) next.status = 'OFFERED';
}

// ------------------------------------------------------------
// «Lån ut» and Utlån are one thing (0107): the same two-way link the database keeps
// ------------------------------------------------------------
function itemFromNotice(p: NoticeboardPost): LendItem {
  return {
    id: `li-${p.id}`,
    ownerId: p.authorProfileId,
    title: p.title.slice(0, 60),
    category: 'VERKTOY',
    note: p.body.slice(0, 300) || undefined,
    imagePath: p.imagePaths?.[0] ?? p.imageUrls?.[0],
    imageUrl: p.imageUrls?.[0] ?? p.imageUrl,
    municipality: p.municipality,
    neighbourhoodId: p.neighbourhoodId,
    active: !p.doneAt,
    createdAt: p.createdAt,
    noticeId: p.id,
  };
}

/** Every «Lån ut» oppslag has its thing, and every thing its oppslag – like the backfill in 0107. */
function linkLend(): void {
  for (const p of noticeboardStore.list('TOOL_LEND')) {
    if (!extras.lendItems.some((i) => i.noticeId === p.id)) extras.lendItems = [...extras.lendItems, itemFromNotice(p)];
  }
  for (const i of extras.lendItems) {
    if (i.noticeId && noticeboardStore.get(i.noticeId)) continue;
    const id = `n-${i.id}`;
    noticeboardStore._insert({
      id,
      kind: 'TOOL_LEND',
      title: i.title,
      body: i.note ?? '',
      authorProfileId: i.ownerId,
      place: profileRepository.getProfile(i.ownerId)?.location.place || i.municipality,
      municipality: i.municipality,
      createdAt: i.createdAt,
      imageUrl: i.imageUrl,
      imageUrls: i.imageUrl ? [i.imageUrl] : undefined,
      imagePaths: i.imagePath ? [i.imagePath] : undefined,
      neighbourhoodId: i.neighbourhoodId,
      doneAt: i.active ? undefined : i.createdAt,
    });
    i.noticeId = id;
  }
}

function notice(id: string): NoticeboardPost | undefined {
  return noticeboardStore.list().find((p) => p.id === id);
}
