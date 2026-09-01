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
  /** "about my home" — pets, stairs, parking; reused across the person's tasks */
  homeNotes?: string;
  /** neighbour endorsements of specific skills */
  endorsements?: SkillEndorsement[];
  /** before/after photos from past jobs (helper profiles) */
  portfolio?: string[];
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
  createdAt: string;
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
};

export type ServiceOfferDetails = {
  about: string;
  experienceYears?: number;
  completedJobs?: number;
  services: string[];
  availabilityText?: string;
  equipmentText?: string;
  maxDistanceKm?: number;
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

export type Listing = {
  id: string;
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
};

export type AgreementSnapshot = {
  proposalId: string;
  listingId: string;
  price: Price;
  scheduledText?: string;
  description: string;
  caveats?: string;
  agreedAt: string;
};

export type ChecklistItem = { id: string; text: string; done: boolean };
export type MaterialItem = { id: string; label: string; amountKr: number };

/** Shared working state for one agreement, on the day the job happens. */
export type JobWorkspace = {
  proposalId: string;
  checklist: ChecklistItem[];
  materials: MaterialItem[];
  /** epoch ms when the timer was last started, or null when paused */
  timerStartedAt: number | null;
  /** accumulated tracked time in ms */
  timerAccumMs: number;
};

/** One row in "Mine avtaler" — an accepted proposal the current user is part of. */
export type AgendaItem = {
  proposalId: string;
  listingId: string;
  listingTitle: string;
  counterpartId: string;
  price: Price;
  scheduledText?: string;
  agreedAt: string;
  fullyCompleted: boolean;
};

// ---------------------------------------------------------------------------
// Conversations and messages
// ---------------------------------------------------------------------------

export type ConversationStatusTag = 'NEW_OFFER' | 'OFFER_ACCEPTED' | null;

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
};

export type ReportTargetType =
  | 'USER'
  | 'LISTING'
  | 'PROPOSAL'
  | 'MESSAGE'
  | 'REVIEW';

export type Report = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
  byProfileId: string;
  createdAt: string;
  status?: 'OPEN' | 'RESOLVED';
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
  | 'MODERATION';

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
  /** the other participant, from the current user's point of view */
  counterpart: PublicProfile & { online?: boolean };
  lastMessagePreview: string;
  lastMessageAt: string;
  unread: boolean;
  statusTag: ConversationStatusTag;
};

export type ListingFilter = {
  type?: ListingType;
  categorySlug?: string;
  maxDistanceKm?: number;
  query?: string;
  verifiedOnly?: boolean;
};

export type ListingSort = 'RELEVANCE' | 'DISTANCE' | 'NEWEST' | 'PRICE';
