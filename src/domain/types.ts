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
  presentation?: string;
  services?: string[];
  categorySlugs?: string[];
  completedTasks?: number;
  /** ISO timestamp when onboarding was completed; undefined = not yet onboarded */
  onboardedAt?: string;
  /** the user's own search radius preference (own profile only) */
  maxDistanceKm?: number;
  purpose?: Purpose;
};

export type ListingImage = { id: string; url: string };

export type TaskDetails = {
  description: string;
  equipment?: string;
  meetingNote?: string;
  durationText?: string;
  scheduledText?: string;
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
