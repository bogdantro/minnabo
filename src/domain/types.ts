import type { Price } from './price';
import type { ProposalStatus } from './proposalMachine';

export type { Price } from './price';
export type { ProposalStatus } from './proposalMachine';

/**
 * A listing is always one of two explicit types. The type is a stored field
 * and is NEVER inferred from the listing text (spec §7, §23).
 */
export type ListingType = 'TASK_REQUEST' | 'SERVICE_OFFER';

/** What the user wants to use MinNabo for (onboarding + profile). */
export type Purpose = 'NEED_HELP' | 'WANT_JOBS' | 'BOTH';

export type PriceMode = 'FIXED' | 'BUDGET' | 'FROM' | 'BY_AGREEMENT';

export type Category = {
  id: string;
  slug: string;
  label: string;
  /** Feather icon name */
  icon: string;
};

export type LocationInfo = {
  municipality: string;
  place: string;
  /** approximate distance from the current user, in km */
  distanceKm?: number;
};

export type VerificationKind = 'PHONE' | 'EMAIL' | 'BUSINESS';

export type Verification = {
  kind: VerificationKind;
  verified: boolean;
  /** what was actually checked — shown to the user (spec §16) */
  explanation: string;
  /** ISO timestamp when it was confirmed */
  verifiedAt?: string;
};

export type Rating = { average: number; count: number };

export type PublicProfile = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  initials: string;
  rating?: Rating;
  /** e.g. "2026" */
  memberSince: string;
  /** ISO – when the account was created ("Medlem siden mars 2024") */
  memberSinceDate?: string;
  /** presentation pills */
  languages?: string[];
  hasCar?: boolean;
  /** "Kvelder etter kl. 17" */
  availabilityText?: string;
  location: LocationInfo;
  verifications: Verification[];
  isBusiness: boolean;
  /** 'admin' unlocks the moderation panel; server-enforced regardless */
  role?: 'user' | 'admin';
  presentation?: string;
  services?: string[];
  categorySlugs?: string[];
  completedTasks?: number;
  /** ISO timestamp when onboarding was completed; undefined = not yet onboarded */
  onboardedAt?: string;
  /** the user's own search radius preference (own profile only) */
  maxDistanceKm?: number;
  purpose?: Purpose;
  /** holiday mode: listings hidden from others, chat auto-replies you're away */
  paused?: boolean;
  /** set for youth accounts (under 18) – shown as "Ungdomskonto · 16 år" on their offers */
  youthAge?: number;
  /** Meny "Tilgjengelig for småjobber" – off = no match notifications */
  availableForJobs?: boolean;
  /** "about my home" — pets, stairs, parking; reused across the person's tasks */
  homeNotes?: string;
  /** neighbour endorsements of specific skills */
  endorsements?: SkillEndorsement[];
  /** before/after photos from past jobs (helper profiles) */
  portfolio?: string[];
  /** phone number — only shared once you have an agreement together */
  phone?: string;
  /** reliability: shows-up / on-time / completes, distinct from the star rating */
  reliability?: ReliabilityStats;
};

export type NoticeKind = 'GIVEAWAY' | 'LOST_FOUND' | 'TOOL_LEND' | 'GENERAL';

export type NoticeboardPost = {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  authorProfileId: string;
  place: string;
  municipality: string;
  createdAt: string;
  /** optional photo (Oppslagstavle) */
  imageUrl?: string;
  /** "N svar" – comments under the oppslag */
  replies?: number;
  /** ISO – the owner marked it as done ("Avsluttet"); no new comments */
  doneAt?: string;
  /** ISO – set when the owner edited it */
  editedAt?: string;
};

/** A public comment under an oppslag. */
export type NoticeComment = {
  id: string;
  noticeId: string;
  authorProfileId: string;
  body: string;
  createdAt: string;
};

/** A sponsor shown on Fellesskap. Deals and payment are handled outside the app. */
export type Partner = {
  id: string;
  name: string;
  tagline: string;
  url: string | null;
  /** absolute logo URL; null → dashed placeholder */
  logoUrl: string | null;
  municipality: string | null;
  /** has an active placement on Fellesskap → shown as a main partner */
  featured: boolean;
  /** the partner's line of business (categories.slug) – shown under the name */
  categorySlug?: string | null;
  /** "Lokal helt" – the middle level: a card that opens the short information sheet */
  localHero?: boolean;
  // --- shown on a hovedpartner's own page ---
  about?: string;
  /** what they offer the neighbours */
  offer?: string;
  address?: string;
  phone?: string;
  email?: string;
  openingHours?: string;
  coverUrl?: string;
  gallery?: string[];
};

/** A donation that has actually been transferred (only those are shown). */
export type Donation = {
  id: string;
  recipient: string;
  amountKr: number;
  period: string;
  transferredAt: string;
};

export type SkillEndorsement = {
  skill: string;
  count: number;
  /** whether the viewing user has endorsed this skill */
  byMe?: boolean;
};

export type ReliabilityStats = {
  /** completed agreements counted toward the score */
  completed: number;
  /** times the other party reported this person as a no-show */
  noShows: number;
  /** 0–100; undefined when there isn't enough history yet */
  score?: number;
};

/** Pålitelighet over the last 12 months; a percentage is undefined until there is enough history. */
export type ReliabilityDetails = { completed: number; showsUp?: number; onTime?: number; completes?: number };

/** One job in the portfolio: an "after" photo, usually with a "before". */
export type PortfolioItem = {
  id: string;
  profileId: string;
  beforeUrl?: string;
  afterUrl: string;
  title: string;
  place?: string;
  caption?: string;
  categorySlug?: string;
  /** ISO date */
  doneAt?: string;
  createdAt: string;
};

export type ListingImage = { id: string; url: string };

export type TaskRecurrence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export type TaskDetails = {
  description: string;
  equipment?: string;
  meetingNote?: string;
  durationText?: string;
  scheduledText?: string;
  /** unpaid community help — no price, shows a "Dugnad" badge */
  isDugnad?: boolean;
  /** the task repeats on this cadence */
  recurrence?: TaskRecurrence;
  /** category-specific intake answers (floors, rooms, pets …) */
  intake?: { label: string; value: string }[];
};

export type ServiceOfferDetails = {
  about: string;
  experienceYears?: number;
  completedJobs?: number;
  services: string[];
  availabilityText?: string;
  equipmentText?: string;
  maxDistanceKm?: number;
  /** weekday indices the helper is usually available (0 = Sun … 6 = Sat) */
  availableWeekdays?: number[];
  /** helper accepts direct bookings without a proposal round-trip */
  instantBook?: boolean;
};

export type ListingStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'RECEIVING_OFFERS'
  | 'OFFER_ACCEPTED'
  | 'AGREED'
  | 'IN_PROGRESS'
  | 'COMPLETION_SENT'
  | 'COMPLETED'
  | 'REVIEWED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REMOVED'
  // service offer states
  | 'ACTIVE'
  | 'PAUSED'
  | 'ARCHIVED';

/** "Foreslå nytt tidspunkt" on an avtale: one side proposes, the other answers. */
export type AgreementTimeProposal = {
  id: string;
  proposalId: string;
  proposedBy: string;
  /** ISO */
  scheduledAt: string;
  scheduledText: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN';
};

/** What earlier tilbud in a category usually land on, in kroner. */
export type PriceRange = { low: number; high: number; sampleSize: number };

/** Foresatt ↔ ungdomskonto. */
export type GuardianLinks = {
  /** I am a youth account */
  youth: boolean;
  /** my open invitation code (youth) */
  code?: { code: string; expiresAt: string };
  /** my foresatte (youth) */
  guardians: { id: string; name: string }[];
  /** the youths I follow (foresatt) */
  youths: { id: string; name: string; age?: number }[];
};

export type Listing = {
  id: string;
  /** sent to one helper ("Be om hjelp igjen") – only they and the owner see it */
  invitedProfileId?: string;
  type: ListingType;
  title: string;
  category: Category;
  price?: Price;
  priceMode: PriceMode;
  location: LocationInfo;
  images: ListingImage[];
  owner: PublicProfile;
  /** ISO timestamp */
  createdAt: string;
  status: ListingStatus;
  task?: TaskDetails;
  offer?: ServiceOfferDetails;
  saved?: boolean;
  /** "Hvem kan gi tilbud" – everyone, or only Vipps-verified neighbours */
  offerAudience?: 'ALL' | 'VERIFIED';
  /** "Maks avstand" for helpers, km */
  maxDistanceKm?: number;
  /** estimated duration in minutes (from the wizard's hours) */
  estimatedMinutes?: number;
  /** ISO – set when the owner edited it after publishing */
  editedAt?: string;
  /**
   * Set by MinNabo's moderation; only the owner ever receives a hidden oppdrag.
   * `pendingReview`: a first oppdrag waiting for approval (shown as "Venter på godkjenning", not as hidden).
   */
  moderation?: { hidden: boolean; reason?: string; pendingReview: boolean };
};

// ---------------------------------------------------------------------------
// Proposals (tilbud) and agreements
// ---------------------------------------------------------------------------

export type Proposal = {
  id: string;
  listingId: string;
  conversationId: string;
  /** who sent the proposal */
  fromProfileId: string;
  /** who can accept/decline it */
  toProfileId: string;
  price: Price;
  message?: string;
  scheduledText?: string;
  caveats?: string;
  status: ProposalStatus;
  createdAt: string;
  /** ISO – the offered day/time as a real timestamp (scheduledText stays the display text) */
  scheduledAt?: string;
  /** "ca. 5 t" – the helper's own estimate */
  durationText?: string;
  /** ISO – when it was accepted or declined */
  respondedAt?: string;
  /** ISO – when the recipient first opened it */
  seenAt?: string;
  /** ISO – "Tilbudet gjelder til …" */
  expiresAt?: string;
};

export type AgreementSnapshot = {
  proposalId: string;
  listingId: string;
  price: Price;
  scheduledText?: string;
  description: string;
  caveats?: string;
  agreedAt: string;
  scheduledAt?: string;
  durationText?: string;
  /** set when one of the parties called the agreement off */
  cancelledAt?: string;
  cancelReason?: string;
};

/** CLIENT = the one who posted the oppdrag, HELPER = the one who gave the tilbud. */
export type JobParty = 'CLIENT' | 'HELPER';
/** Who sorts out a material: the client buys it, the helper brings it, or the helper pays and is paid back. */
export type MaterialPayer = 'CLIENT' | 'HELPER' | 'HELPER_OUTLAY';
export type JobPhotoPhase = 'BEFORE' | 'AFTER' | 'DURING';
/** `who` undefined = "Felles". */
export type ChecklistItem = { id: string; text: string; done: boolean; who?: JobParty };
export type MaterialItem = { id: string; label: string; amountKr: number; payer?: MaterialPayer };
export type JobPhoto = { id: string; url: string; phase: JobPhotoPhase; caption?: string; /** ISO */ at?: string };

/** Shared working state for one agreement, on the day the job happens. */
export type JobWorkspace = {
  proposalId: string;
  checklist: ChecklistItem[];
  materials: MaterialItem[];
  photos: JobPhoto[];
  /** epoch ms when the timer was last started, or null when paused */
  timerStartedAt: number | null;
  /** accumulated tracked time in ms */
  timerAccumMs: number;
  /** epoch ms of the very first start ("Startet kl."), or null */
  firstStartedAt: number | null;
  /** finished pauses in ms; a running pause is `pausedAt` → now */
  pausedMs: number;
  pausedAt: number | null;
  /** epoch ms when "Stopp" was pressed, or null */
  timerStoppedAt: number | null;
};

/** One row in "Mine avtaler" — an accepted proposal the current user is part of. */
export type AgendaItem = {
  proposalId: string;
  listingId: string;
  listingTitle: string;
  counterpartId: string;
  price: Price;
  scheduledText?: string;
  scheduledAt?: string;
  durationText?: string;
  agreedAt: string;
  fullyCompleted: boolean;
  /** HELPER = I sent the accepted offer ("Du hjelper"); CLIENT = it's my oppdrag ("Du får hjelp") */
  role: 'HELPER' | 'CLIENT';
  cancelled: boolean;
  /** the rating I gave the other party, if I've reviewed */
  myRating?: number;
};

// ---------------------------------------------------------------------------
// Conversations and messages
// ---------------------------------------------------------------------------

export type ConversationStatusTag = 'NEW_OFFER' | 'OFFER_ACCEPTED' | 'REVISION_PENDING' | null;

export type MessageDelivery = 'SENT' | 'DELIVERED' | 'READ';

export type Message = {
  id: string;
  conversationId: string;
  authorProfileId: string;
  /** plain text body; empty when kind !== 'TEXT' */
  text: string;
  kind: 'TEXT' | 'PROPOSAL' | 'SYSTEM' | 'IMAGE';
  proposalId?: string;
  /** image url when kind === 'IMAGE' */
  attachmentUrl?: string;
  /** storage path of a chat photo that is still being sent (retry / outbox) */
  attachmentPath?: string;
  createdAt: string;
  delivery: MessageDelivery;
  /** client-side only: an optimistic message still in flight */
  pending?: boolean;
  /** client-side only: the send failed and can be retried */
  failed?: boolean;
  /** emoji → the profile ids that reacted with it */
  reactions?: Record<string, string[]>;
  /** pinned to the top of the conversation (only one per conversation) */
  pinned?: boolean;
};

// ---------------------------------------------------------------------------
// Reviews, completion, notifications
// ---------------------------------------------------------------------------

export type Review = {
  id: string;
  agreementProposalId: string;
  listingId: string;
  fromProfileId: string;
  toProfileId: string;
  rating: number;
  comment?: string;
  /** structured quick-tags, e.g. "Punktlig", "Ryddig" */
  tags?: string[];
  createdAt: string;
  /** public answer from the person who was reviewed */
  reply?: string;
  repliedAt?: string;
};

export type ReportTargetType =
  | 'USER'
  | 'LISTING'
  | 'PROPOSAL'
  | 'MESSAGE'
  | 'REVIEW'
  /** a comment under an oppslag */
  | 'COMMENT';

export type Report = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
  byProfileId: string;
  createdAt: string;
  status?: 'OPEN' | 'RESOLVED';
  /** ISO – a moderator has picked the report up ("Under behandling") */
  claimedAt?: string;
};

export type Block = {
  byProfileId: string;
  blockedProfileId: string;
  createdAt: string;
};

export type CompletionConfirmation = {
  agreementProposalId: string;
  byProfileId: string;
  confirmedAt: string;
};

export type NotificationKind =
  | 'NEW_MESSAGE'
  | 'NEW_OFFER'
  | 'OFFER_CHANGED'
  | 'OFFER_WITHDRAWN'
  | 'OFFER_ACCEPTED'
  | 'OFFER_DECLINED'
  | 'AGREED_TIME'
  | 'COMPLETION_REQUESTED'
  | 'REVIEW_RECEIVED'
  | 'MODERATION'
  | 'AGREEMENT_CANCELLED'
  | 'NEW_MATCH'
  | 'NOTICE_REPLY';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  /** deep-link target within the app */
  route?: string;
};

export type Conversation = {
  id: string;
  listing: Pick<Listing, 'id' | 'title' | 'type'> & {
    place: string;
    imageUrl?: string;
  };
  /** set when the chat is about an oppslag (Oppslagstavle "Svar") instead of an oppdrag; `listing.id` is then '' */
  notice?: { id?: string; title: string };
  /** the other participant, from the current user's point of view */
  counterpart: PublicProfile & { online?: boolean };
  lastMessagePreview: string;
  lastMessageAt: string;
  unread: boolean;
  /** messages from the other person since I last read; undefined when unknown */
  unreadCount?: number;
  /** I wrote the last message ("Du: …") */
  lastMessageMine?: boolean;
  /** when the last message is mine: sent / delivered / read (the ticks in Innboks) */
  lastMessageDelivery?: MessageDelivery;
  statusTag: ConversationStatusTag;
};

export type ListingFilter = {
  type?: ListingType;
  categorySlug?: string;
  /** several categories (Søk's filter); takes precedence over `categorySlug` */
  categorySlugs?: string[];
  maxDistanceKm?: number;
  /** kommune allow-list; undefined/empty = no location filtering */
  municipalities?: string[];
  query?: string;
  verifiedOnly?: boolean;
};

export type ListingSort = 'RELEVANCE' | 'DISTANCE' | 'NEWEST' | 'PRICE';
