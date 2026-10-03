import type {
  AgreementSnapshot,
  AppNotification,
  Conversation,
  ConversationStatusTag,
  Listing,
  Message,
  Proposal,
  PublicProfile,
  NoticeboardPost,
  Partner,
  Donation,
  NoticeKind,
  Rating,
  Review,
  TaskDetails,
  Verification,
} from '@/domain/types';
import { categoryBySlug } from '@/domain/categories';
import { publicUrl } from '@/lib/storage';

// ---------------------------------------------------------------------------
// row shapes (a subset of the generated DB types — the columns the app reads)
// ---------------------------------------------------------------------------

export type RatingsRow = { average: number | string; count: number } | null;

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_path: string | null;
  initials: string;
  presentation: string | null;
  member_since: string;
  municipality: string | null;
  place: string | null;
  is_business: boolean;
  role?: string | null;
  onboarded_at?: string | null;
  max_distance_km?: number | null;
  purpose?: string | null;
  paused?: boolean | null;
  home_notes?: string | null;
  portfolio?: string[] | null;
  phone?: string | null;
  reliability_completed?: number | null;
  reliability_no_shows?: number | null;
  verifications?: { kind: string; verified: boolean; explanation: string }[] | null;
  profile_ratings?: RatingsRow;
};

export type ListingRow = {
  id: string;
  type: 'TASK_REQUEST' | 'SERVICE_OFFER';
  title: string;
  category_slug: string;
  price_amount_minor: number | null;
  price_currency: string;
  price_mode: Listing['priceMode'];
  municipality: string;
  place: string;
  status: Listing['status'];
  created_at: string;
  owner: ProfileRow;
  task_details?: {
    description: string;
    equipment: string | null;
    meeting_note: string | null;
    duration_text: string | null;
    scheduled_text: string | null;
    is_dugnad?: boolean | null;
    recurrence?: string | null;
    intake?: { label: string; value: string }[] | null;
  } | null;
  service_offer_details?: {
    about: string;
    experience_years: number | null;
    completed_jobs: number | null;
    services: string[];
    availability_text: string | null;
    equipment_text: string | null;
    max_distance_km: number | null;
    available_weekdays?: number[] | null;
    instant_book?: boolean | null;
  } | null;
  listing_images?: { id: string; storage_path: string; ord: number }[] | null;
};

export type ProposalRow = {
  id: string;
  listing_id: string;
  conversation_id: string;
  from_profile_id: string;
  to_profile_id: string;
  price_amount_minor: number;
  price_currency: string;
  message: string | null;
  scheduled_text: string | null;
  caveats: string | null;
  status: Proposal['status'];
  created_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  author_id: string;
  kind: Message['kind'];
  text: string;
  proposal_id: string | null;
  attachment_path: string | null;
  created_at: string;
  reactions?: Record<string, string[]> | null;
  pinned?: boolean | null;
};

export type AgreementRow = {
  proposal_id: string;
  listing_id: string;
  price_amount_minor: number;
  price_currency: string;
  scheduled_text: string | null;
  description: string;
  caveats: string | null;
  agreed_at: string;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
};

export type ReviewRow = {
  id: string;
  agreement_proposal_id: string;
  listing_id: string;
  from_profile_id: string;
  to_profile_id: string;
  rating: number;
  comment: string | null;
  tags?: string[] | null;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  kind: AppNotification['kind'];
  title: string;
  body: string;
  route: string | null;
  read: boolean;
  created_at: string;
};

export type ConversationRow = {
  id: string;
  listing: Pick<ListingRow, 'id' | 'title' | 'type' | 'place'> & {
    listing_images?: { storage_path: string; ord: number }[] | null;
  };
  last_message_preview: string;
  last_message_at: string;
  conversation_participants: { profile: ProfileRow }[];
  message_reads?: { profile_id: string; last_read_at: string }[] | null;
  proposals?: { status: Proposal['status']; created_at: string }[] | null;
};

// ---------------------------------------------------------------------------
// mappers
// ---------------------------------------------------------------------------

const toRating = (r: RatingsRow): Rating | undefined =>
  r && r.count > 0 ? { average: Number(r.average), count: r.count } : undefined;

function toReliability(row: ProfileRow): PublicProfile['reliability'] {
  const completed = row.reliability_completed ?? 0;
  const noShows = row.reliability_no_shows ?? 0;
  const total = completed + noShows;
  if (total === 0) return undefined;
  return {
    completed,
    noShows,
    score: total >= 3 ? Math.round((completed / total) * 100) : undefined,
  };
}

export function toProfile(row: ProfileRow): PublicProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: publicUrl('avatars', row.avatar_path),
    initials: row.initials,
    presentation: row.presentation ?? undefined,
    memberSince: row.member_since,
    location: {
      municipality: row.municipality ?? '',
      place: row.place ?? '',
    },
    isBusiness: row.is_business,
    role: row.role === 'admin' ? 'admin' : 'user',
    onboardedAt: row.onboarded_at ?? undefined,
    maxDistanceKm: row.max_distance_km ?? undefined,
    purpose: (row.purpose as PublicProfile['purpose']) ?? undefined,
    paused: row.paused ?? undefined,
    homeNotes: row.home_notes ?? undefined,
    portfolio: row.portfolio ?? undefined,
    phone: row.phone ?? undefined,
    reliability: toReliability(row),
    verifications: (row.verifications ?? []).map(
      (v): Verification => ({
        kind: v.kind as Verification['kind'],
        verified: v.verified,
        explanation: v.explanation,
      }),
    ),
    rating: toRating(row.profile_ratings ?? null),
  };
}

export function toListing(row: ListingRow): Listing {
  const images = (row.listing_images ?? [])
    .slice()
    .sort((a, b) => a.ord - b.ord)
    .map((im) => ({ id: im.id, url: publicUrl('listing-images', im.storage_path)! }));

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    category: categoryBySlug(row.category_slug),
    price:
      row.price_amount_minor != null
        ? { amountMinor: row.price_amount_minor, currency: row.price_currency as 'NOK' }
        : undefined,
    priceMode: row.price_mode,
    location: { municipality: row.municipality, place: row.place },
    images,
    owner: toProfile(row.owner),
    createdAt: row.created_at,
    status: row.status,
    task: row.task_details
      ? {
          description: row.task_details.description,
          equipment: row.task_details.equipment ?? undefined,
          meetingNote: row.task_details.meeting_note ?? undefined,
          durationText: row.task_details.duration_text ?? undefined,
          scheduledText: row.task_details.scheduled_text ?? undefined,
          isDugnad: row.task_details.is_dugnad ?? undefined,
          recurrence: (row.task_details.recurrence as TaskDetails['recurrence']) ?? undefined,
          intake: row.task_details.intake ?? undefined,
        }
      : undefined,
    offer: row.service_offer_details
      ? {
          about: row.service_offer_details.about,
          experienceYears: row.service_offer_details.experience_years ?? undefined,
          completedJobs: row.service_offer_details.completed_jobs ?? undefined,
          services: row.service_offer_details.services ?? [],
          availabilityText: row.service_offer_details.availability_text ?? undefined,
          availableWeekdays: row.service_offer_details.available_weekdays ?? undefined,
          instantBook: row.service_offer_details.instant_book ?? undefined,
          equipmentText: row.service_offer_details.equipment_text ?? undefined,
          maxDistanceKm: row.service_offer_details.max_distance_km ?? undefined,
        }
      : undefined,
  };
}

export function toProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    listingId: row.listing_id,
    conversationId: row.conversation_id,
    fromProfileId: row.from_profile_id,
    toProfileId: row.to_profile_id,
    price: { amountMinor: row.price_amount_minor, currency: row.price_currency as 'NOK' },
    message: row.message ?? undefined,
    scheduledText: row.scheduled_text ?? undefined,
    caveats: row.caveats ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    authorProfileId: row.author_id,
    text: row.text,
    kind: row.kind,
    proposalId: row.proposal_id ?? undefined,
    attachmentUrl:
      row.kind === 'IMAGE'
        ? publicUrl('chat-attachments', row.attachment_path) ?? undefined
        : undefined,
    createdAt: row.created_at,
    delivery: 'DELIVERED',
    reactions: row.reactions ?? undefined,
    pinned: row.pinned ?? undefined,
  };
}

export function toAgreement(row: AgreementRow): AgreementSnapshot {
  return {
    proposalId: row.proposal_id,
    listingId: row.listing_id,
    price: { amountMinor: row.price_amount_minor, currency: row.price_currency as 'NOK' },
    scheduledText: row.scheduled_text ?? undefined,
    description: row.description,
    caveats: row.caveats ?? undefined,
    agreedAt: row.agreed_at,
    cancelledAt: row.cancelled_at ?? undefined,
    cancelReason: row.cancel_reason ?? undefined,
  };
}

export type PartnerRow = {
  id: string;
  name: string;
  blurb: string;
  url: string | null;
  municipality: string | null;
  partner_placements: { surface: string; active: boolean }[] | null;
};

export function toPartner(row: PartnerRow): Partner {
  return {
    id: row.id,
    name: row.name,
    tagline: row.blurb,
    url: row.url,
    municipality: row.municipality,
    featured: (row.partner_placements ?? []).some((p) => p.active && p.surface === 'fellesskap'),
  };
}

export type DonationRow = {
  id: string;
  recipient: string;
  amount_kr: number;
  period: string;
  transferred_at: string;
};

export function toDonation(row: DonationRow): Donation {
  return {
    id: row.id,
    recipient: row.recipient,
    amountKr: row.amount_kr,
    period: row.period,
    transferredAt: row.transferred_at,
  };
}

export type NoticeRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  author_id: string;
  place: string;
  municipality: string;
  created_at: string;
  image_path?: string | null;
};

export function toNoticeboardPost(row: NoticeRow): NoticeboardPost {
  return {
    id: row.id,
    kind: row.kind as NoticeKind,
    title: row.title,
    body: row.body,
    authorProfileId: row.author_id,
    place: row.place,
    // Coalesce guards the deploy window before migration 0021 adds the column —
    // `.select('*')` returns no `municipality` until then.
    municipality: row.municipality ?? '',
    createdAt: row.created_at,
    imageUrl: publicUrl('listing-images', row.image_path ?? null),
  };
}

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    agreementProposalId: row.agreement_proposal_id,
    listingId: row.listing_id,
    fromProfileId: row.from_profile_id,
    toProfileId: row.to_profile_id,
    rating: row.rating,
    comment: row.comment ?? undefined,
    tags: row.tags ?? undefined,
    createdAt: row.created_at,
  };
}

export function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    route: row.route ?? undefined,
    read: row.read,
    createdAt: row.created_at,
  };
}

const statusTag = (status?: Proposal['status']): ConversationStatusTag => {
  if (status === 'SENT' || status === 'REVISION_PENDING') return 'NEW_OFFER';
  if (status === 'ACCEPTED') return 'OFFER_ACCEPTED';
  return null;
};

export function toConversation(row: ConversationRow, meId: string): Conversation {
  const other = row.conversation_participants
    .map((p) => p.profile)
    .find((p) => p.id !== meId);
  const myRead = (row.message_reads ?? []).find((r) => r.profile_id === meId);
  const latestProposal = (row.proposals ?? [])
    .slice()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  const thumb = (row.listing.listing_images ?? [])
    .slice()
    .sort((a, b) => a.ord - b.ord)[0];

  return {
    id: row.id,
    listing: {
      id: row.listing.id,
      title: row.listing.title,
      type: row.listing.type,
      place: row.listing.place,
      imageUrl: publicUrl('listing-images', thumb?.storage_path ?? null) ?? undefined,
    },
    counterpart: {
      ...(other ? toProfile(other) : placeholderProfile()),
      online: false,
    },
    lastMessagePreview: row.last_message_preview,
    lastMessageAt: row.last_message_at,
    unread: myRead ? Date.parse(row.last_message_at) > Date.parse(myRead.last_read_at) : true,
    statusTag: statusTag(latestProposal?.status),
  };
}

function placeholderProfile(): PublicProfile {
  return {
    id: 'unknown',
    displayName: 'Nabo',
    initials: 'N',
    memberSince: '',
    location: { municipality: '', place: '' },
    isBusiness: false,
    verifications: [],
  };
}
