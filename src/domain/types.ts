import type { Price } from './price';

export type { Price } from './price';

/**
 * A listing is always one of two explicit types. The type is a stored field
 * and is NEVER inferred from the listing text (spec §7, §23).
 */
export type ListingType = 'TASK_REQUEST' | 'SERVICE_OFFER';

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

export type ListingFilter = {
  type?: ListingType;
  categorySlug?: string;
  maxDistanceKm?: number;
  query?: string;
  verifiedOnly?: boolean;
};

export type ListingSort = 'RELEVANCE' | 'DISTANCE' | 'NEWEST' | 'PRICE';
