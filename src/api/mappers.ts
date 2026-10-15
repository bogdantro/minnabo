import type {
  AgreementSnapshot,
  AgreementTimeProposal,
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
  PortfolioItem,
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
  available_for_jobs?: boolean | null;
  created_at?: string | null;
  languages?: string[] | null;
  has_car?: boolean | null;
  availability_text?: string | null;
  youth_age?: number | null;
  category_slugs?: string[] | null;
  home_notes?: string | null;
  portfolio?: string[] | null;
  phone?: string | null;
  reliability_completed?: number | null;
  reliability_no_shows?: number | null;
  verifications?: { kind: string; verified: boolean; explanation: string; verified_at?: string | null }[] | null;
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
  offer_audience?: 'ALL' | 'VERIFIED' | null;
  max_distance_km?: number | null;
  estimated_minutes?: number | null;
  edited_at?: string | null;
  invited_profile_id?: string | null;
  admin_hidden?: boolean | null;
  hidden_reason?: string | null;
  pending_review?: boolean | null;
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
  scheduled_at?: string | null;
  duration_text?: string | null;
  responded_at?: string | null;
  seen_at?: string | null;
  expires_at?: string | null;
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
  scheduled_at?: string | null;
  duration_text?: string | null;
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
  reply?: string | null;
  replied_at?: string | null;
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
  /** null when the conversation is about an oppslag (0041) */
  listing: (Pick<ListingRow, 'id' | 'title' | 'type' | 'place'> & {
    listing_images?: { storage_path: string; ord: number }[] | null;
  }) | null;
  notice_id?: string | null;
  notice_title?: string | null;
  notice_place?: string | null;
  last_message_preview: string;
  last_message_at: string;
  conversation_participants: { profile: ProfileRow; profile_id?: string; last_read_at?: string | null; last_delivered_at?: string | null }[];
  message_reads?: { profile_id: string; last_read_at: string }[] | null;
  /** newest message only (embedded with order + limit 1) */
  messages?: { author_id: string; kind: string; created_at: string; text?: string | null }[] | null;
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
    availableForJobs: row.available_for_jobs ?? undefined,
    memberSinceDate: row.created_at ?? undefined,
    languages: row.languages?.length ? row.languages : undefined,
    hasCar: row.has_car ?? undefined,
    availabilityText: row.availability_text ?? undefined,
    youthAge: row.youth_age ?? undefined,
    categorySlugs: row.category_slugs ?? undefined,
    portfolio: row.portfolio ?? undefined,
    // fully confirmed agreements, counted by the database (0055_jobs_and_reviews)
    completedTasks: row.reliability_completed ?? 0,
    reliability: toReliability(row),
    verifications: (row.verifications ?? []).map(
      (v): Verification => ({
        kind: v.kind as Verification['kind'],
        verified: v.verified,
        explanation: v.explanation,
        verifiedAt: v.verified_at ?? undefined,
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
    offerAudience: row.offer_audience ?? undefined,
    maxDistanceKm: row.max_distance_km ?? undefined,
    estimatedMinutes: row.estimated_minutes ?? undefined,
    editedAt: row.edited_at ?? undefined,
    invitedProfileId: row.invited_profile_id ?? undefined,
    moderation:
      row.admin_hidden || row.pending_review
        ? { hidden: !!row.admin_hidden, reason: row.hidden_reason?.trim() || undefined, pendingReview: !!row.pending_review }
        : undefined,
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
    scheduledAt: row.scheduled_at ?? undefined,
    durationText: row.duration_text ?? undefined,
    respondedAt: row.responded_at ?? undefined,
    seenAt: row.seen_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
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
    // the path in the private bucket – SupabaseApiClient swaps it for a signed link
    attachmentUrl: row.kind === 'IMAGE' ? row.attachment_path ?? undefined : undefined,
    createdAt: row.created_at,
    // stored on the server = "Sendt"; "Levert" / "Lest" are added by withReadState
    delivery: 'SENT',
    reactions: row.reactions ?? undefined,
    pinned: row.pinned ?? undefined,
  };
}

/**
 * Receipts on my own messages: "Lest" when the other person has read that far,
 * "Levert" when their app has fetched it, otherwise whatever it already was ("Sendt").
 */
export function withReadState(
  messages: Message[],
  meId: string,
  otherReadAt: string | null | undefined,
  otherDeliveredAt?: string | null,
): Message[] {
  const ms = (t: string | null | undefined) => {
    const v = t ? Date.parse(t) : NaN;
    return Number.isNaN(v) || v <= 0 ? null : v;
  };
  const readAt = ms(otherReadAt);
  const deliveredAt = ms(otherDeliveredAt);
  if (readAt == null && deliveredAt == null) return messages;
  return messages.map((m) => {
    if (m.authorProfileId !== meId || m.kind === 'SYSTEM') return m;
    const at = Date.parse(m.createdAt);
    if (readAt != null && at <= readAt) return { ...m, delivery: 'READ' as const };
    if (deliveredAt != null && at <= deliveredAt) return { ...m, delivery: 'DELIVERED' as const };
    return m;
  });
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
    scheduledAt: row.scheduled_at ?? undefined,
    durationText: row.duration_text ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    cancelReason: row.cancel_reason ?? undefined,
  };
}

export type PartnerRow = {
  id: string;
  name: string;
  blurb: string;
  url: string | null;
  logo_path: string | null;
  municipality: string | null;
  partner_placements: { surface: string; active: boolean }[] | null;
  local_hero?: boolean | null;
  category_slug?: string | null;
  about?: string | null;
  offer?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  opening_hours?: string | null;
  cover_path?: string | null;
  gallery?: string[] | null;
};

/** Partner images are full URLs, or paths in the public `listing-images` bucket. */
const partnerImage = (p?: string | null) => (p ? publicUrl('listing-images', p) : undefined);

export function toPartner(row: PartnerRow): Partner {
  return {
    id: row.id,
    name: row.name,
    tagline: row.blurb,
    url: row.url,
    logoUrl: row.logo_path && /^https?:\/\//i.test(row.logo_path) ? row.logo_path : null,
    municipality: row.municipality,
    featured: (row.partner_placements ?? []).some((p) => p.active && p.surface === 'fellesskap'),
    localHero: !!row.local_hero,
    categorySlug: row.category_slug ?? null,
    about: row.about ?? undefined,
    offer: row.offer ?? undefined,
    address: row.address ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    openingHours: row.opening_hours ?? undefined,
    coverUrl: partnerImage(row.cover_path),
    gallery: (row.gallery ?? []).map((g) => partnerImage(g)!).filter(Boolean),
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
  done_at?: string | null;
  edited_at?: string | null;
  neighbourhood_id?: string | null;
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
    doneAt: row.done_at ?? undefined,
    editedAt: row.edited_at ?? undefined,
    neighbourhoodId: row.neighbourhood_id ?? undefined,
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
    reply: row.reply ?? undefined,
    repliedAt: row.replied_at ?? undefined,
  };
}

export type PortfolioRow = {
  id: string;
  profile_id: string;
  before_path: string | null;
  after_path: string;
  title: string;
  place: string | null;
  caption: string | null;
  category_slug: string | null;
  done_at: string | null;
  created_at: string;
};

export function toPortfolioItem(row: PortfolioRow): PortfolioItem {
  return {
    id: row.id,
    profileId: row.profile_id,
    beforeUrl: publicUrl('listing-images', row.before_path),
    afterUrl: publicUrl('listing-images', row.after_path)!,
    title: row.title,
    place: row.place ?? undefined,
    caption: row.caption ?? undefined,
    categorySlug: row.category_slug ?? undefined,
    doneAt: row.done_at ?? undefined,
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
  if (status === 'REVISION_PENDING') return 'REVISION_PENDING';
  if (status === 'SENT') return 'NEW_OFFER';
  if (status === 'ACCEPTED') return 'OFFER_ACCEPTED';
  return null;
};

/** One row of my_conversation_meta() (0036). */
export type ConversationMetaRow = {
  conversation_id: string;
  unread_count: number;
  last_author_id: string | null;
  last_kind: string | null;
};

export function toConversation(row: ConversationRow, meId: string, meta?: ConversationMetaRow): Conversation {
  const other = row.conversation_participants
    .map((p) => p.profile)
    .find((p) => p.id !== meId);
  // Two places have held the read time (message_reads, and the participant row since 0007).
  const readTimes = [
    (row.message_reads ?? []).find((r) => r.profile_id === meId)?.last_read_at,
    row.conversation_participants.find((p) => (p.profile_id ?? p.profile?.id) === meId)?.last_read_at,
  ]
    .map((t) => (t ? Date.parse(t) : NaN))
    .filter((t) => !Number.isNaN(t) && t > 0);
  const readAt = readTimes.length ? Math.max(...readTimes) : null;
  // My own message is never "unread", and it is what "Du: …" hangs on.
  const last = (row.messages ?? [])[0];
  const lastByMe = meta ? meta.last_author_id === meId : last ? last.author_id === meId : undefined;
  const lastKind = meta ? meta.last_kind : last?.kind;
  // Show the real last message. The copy on the conversation row can lag behind
  // (it did for every plain chat message before 0045).
  const preview = last
    ? last.kind === 'IMAGE'
      ? '📷 Bilde'
      : last.kind === 'PROPOSAL'
        ? lastByMe
          ? 'Du sendte et tilbud'
          : 'Sendte et tilbud'
        : (last.text ?? '').slice(0, 120) || row.last_message_preview
    : row.last_message_preview;
  const lastAt = last && Date.parse(last.created_at) > Date.parse(row.last_message_at) ? last.created_at : row.last_message_at;
  // The receipt on my own last message: how far the other person has got.
  const them = row.conversation_participants.filter((p) => (p.profile_id ?? p.profile?.id) !== meId);
  const reached = (key: 'last_read_at' | 'last_delivered_at') =>
    them.some((p) => !!p[key] && Date.parse(p[key] as string) >= Date.parse(lastAt));
  const myDelivery: Conversation['lastMessageDelivery'] =
    lastByMe && lastKind !== 'SYSTEM' ? (reached('last_read_at') ? 'READ' : reached('last_delivered_at') ? 'DELIVERED' : 'SENT') : undefined;
  const latestProposal = (row.proposals ?? [])
    .slice()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  const thumb = (row.listing?.listing_images ?? [])
    .slice()
    .sort((a, b) => a.ord - b.ord)[0];
  const isNotice = !row.listing;

  return {
    id: row.id,
    listing: row.listing
      ? {
          id: row.listing.id,
          title: row.listing.title,
          type: row.listing.type,
          place: row.listing.place,
          imageUrl: publicUrl('listing-images', thumb?.storage_path ?? null) ?? undefined,
        }
      : { id: '', title: row.notice_title ?? 'Oppslag', type: 'TASK_REQUEST', place: row.notice_place ?? '' },
    notice: isNotice ? { id: row.notice_id ?? undefined, title: row.notice_title ?? 'Oppslag' } : undefined,
    counterpart: {
      ...(other ? toProfile(other) : placeholderProfile()),
      online: false,
    },
    lastMessagePreview: preview,
    lastMessageAt: lastAt,
    unread: meta
      ? meta.unread_count > 0
      : lastByMe
        ? false
        : readAt != null
          ? Date.parse(lastAt) > readAt
          : true,
    unreadCount: meta?.unread_count,
    lastMessageDelivery: myDelivery,
    // "Du: …" in front of my own text or photo (a tilbud already says "Du sendte et tilbud")
    lastMessageMine: lastByMe === undefined ? undefined : lastByMe && lastKind !== 'SYSTEM' && lastKind !== 'PROPOSAL',
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

export type TimeProposalRow = {
  id: string;
  proposal_id: string;
  proposed_by: string;
  scheduled_at: string;
  scheduled_text: string;
  status: string;
};

export function toTimeProposal(row: TimeProposalRow): AgreementTimeProposal {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    proposedBy: row.proposed_by,
    scheduledAt: row.scheduled_at,
    scheduledText: row.scheduled_text,
    status: row.status as AgreementTimeProposal['status'],
  };
}
