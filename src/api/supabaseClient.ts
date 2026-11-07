import type { CategoryRow } from '@/domain/categories';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/reporting';
import { backendError } from '@/lib/errors';
import type {
  AgendaItem,
  AgreementSnapshot,
  AgreementTimeProposal,
  HelperStatus,
  NoShowReason,
  NoShowReport,
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
  PublicProfile,
  NoticeboardPost,
  NoticeComment,
  Partner,
  Donation,
  NoticeKind,
  PortfolioItem,
  ReliabilityDetails,
  Report,
  Review,
  SkillEndorsement,
  VerificationKind,
  AgreedSum,
  ListingQuestion,
  PoliceCertificate,
  ThankCard,
  ThankCardKind,
  ToolBooking,
  YearRecap,
} from '@/domain/types';
import type { Actor, ProposalEvent } from '@/domain/proposalMachine';
import type {
  ApiClient,
  AppSettings,
  PartnerThanks,
  SharedContact,
  ListConversationsParams,
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
  OfferCount,
  RespondToProposalResult,
  SavedSearchRecord,
  SendProposalInput,
  SubmitReportInput,
  SubmitReviewInput,
  UpdateProfilePatch,

  MyAccount,
  AccountStatus,
  EditProposalPatch,
  ListingEditData,
  ListingExtras,
  PendingReview,
  RescueResult,
  HelperSlots} from './ApiClient';
import { DEFAULT_APP_SETTINGS, withDefaultPrefs } from './ApiClient';

import { OPEN_LISTING_STATUSES } from '@/domain/editing';
import {
  toAgreement,
  toTimeProposal,
  type TimeProposalRow,
  toConversation,
  toListing,
  toMessage,
  toNotification,
  toNoticeboardPost,
  toPartner,
  toDonation,
  toProfile,
  toProposal,
  toReview,
  withReadState,
  toPortfolioItem,
  type PortfolioRow,
  type AgreementRow,
  type ConversationMetaRow,
  type ConversationRow,
  type ListingRow,
  type MessageRow,
  type NoticeRow,
  type PartnerRow,
  type DonationRow,
  type NotificationRow,
  type ProfileRow,
  type ProposalRow,
  type ReviewRow,
} from './mappers';

const PROFILE_SELECT = '*, verifications(*), profile_ratings(*)';
const LISTING_SELECT = `
  *,
  owner:profiles!listings_owner_id_fkey(${PROFILE_SELECT}),
  task_details(*),
  service_offer_details(*),
  listing_images(*)
`;
const CONVERSATION_SELECT = `
  *,
  listing:listings(id,title,type,place,owner_id,listing_images(storage_path,ord)),
  conversation_participants(*,profile:profiles(${PROFILE_SELECT})),
  message_reads(profile_id,last_read_at),
  proposals(status,created_at),
  messages(author_id,kind,created_at,text,deleted_at)
`;
/** Only the newest message per conversation is embedded (who wrote last). */
const LAST_MESSAGE = { referencedTable: 'messages' } as const;

type QuestionRow = { id: string; listing_id: string; author_id: string; body: string; answer: string | null; answered_at: string | null; created_at: string };
const toQuestion = (r: QuestionRow): ListingQuestion => ({
  id: r.id,
  listingId: r.listing_id,
  authorId: r.author_id,
  body: r.body,
  answer: r.answer ?? undefined,
  answeredAt: r.answered_at ?? undefined,
  createdAt: r.created_at,
});

type BookingRow = { id: string; notice_id: string; borrower_id: string; from_date: string; to_date: string; note: string | null; status: ToolBooking['status'] };
const toBooking = (r: BookingRow): ToolBooking => ({
  id: r.id,
  noticeId: r.notice_id,
  borrowerId: r.borrower_id,
  from: r.from_date,
  to: r.to_date,
  note: r.note ?? undefined,
  status: r.status,
});

type ThankRow = { id: string; proposal_id: string; from_profile_id: string; to_profile_id: string; card: ThankCardKind; message: string | null; created_at: string };
const toThank = (r: ThankRow): ThankCard => ({
  id: r.id,
  proposalId: r.proposal_id,
  fromProfileId: r.from_profile_id,
  toProfileId: r.to_profile_id,
  card: r.card,
  message: r.message ?? undefined,
  createdAt: r.created_at,
});

/** "klipp plen" → "klipp:* & plen:*": what you have typed so far finds «klippe plenen». */
export function prefixQuery(q: string): string {
  return (q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map((w) => `${w}:*`).join(' & ');
}

type CommentRow = { id: string; notice_id: string; author_id: string; body: string; created_at: string };
const toComment = (r: CommentRow): NoticeComment => ({
  id: r.id,
  noticeId: r.notice_id,
  authorProfileId: r.author_id,
  body: r.body,
  createdAt: r.created_at,
});

/**
 * Throws the backend's error. A plain string is a message we wrote ourselves; an error
 * object keeps its Postgres code, so our own Norwegian messages can be shown and technical
 * ones can't (lib/errors.ts).
 */
function fail(err: { message?: string; code?: string } | string | null | undefined): never {
  throw backendError(err ?? undefined);
}

const token = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/** Signed-in user id, or null – for reads that also work for other people's data. */
async function sessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// Chat photos are private (0058): shown through signed links, reused until shortly
// before they expire so the same photo is not downloaded again on every refresh.
const SIGNED_TTL = 7 * 24 * 3600;
const signed = new Map<string, { url: string; until: number }>();
const CHAT_PREFIX = '/storage/v1/object/public/chat-attachments/';

function chatPath(v: string): string {
  const i = v.indexOf(CHAT_PREFIX);
  return i >= 0 ? v.slice(i + CHAT_PREFIX.length) : v;
}

async function withSignedPhotos(messages: Message[]): Promise<Message[]> {
  const now = Date.now();
  const paths = [
    ...new Set(
      messages
        .filter((m) => (m.kind === 'IMAGE' || m.kind === 'AUDIO') && m.attachmentUrl && !/^(file|content|data|blob):/i.test(m.attachmentUrl))
        .map((m) => chatPath(m.attachmentUrl!)),
    ),
  ];
  const missing = paths.filter((p) => (signed.get(p)?.until ?? 0) <= now);
  if (missing.length) {
    const { data } = await supabase.storage.from('chat-attachments').createSignedUrls(missing, SIGNED_TTL);
    for (const r of data ?? []) {
      if (r.path && r.signedUrl) signed.set(r.path, { url: r.signedUrl, until: now + (SIGNED_TTL - 3600) * 1000 });
    }
  }
  return messages.map((m) =>
    (m.kind === 'IMAGE' || m.kind === 'AUDIO') && m.attachmentUrl
      ? { ...m, attachmentUrl: signed.get(chatPath(m.attachmentUrl))?.url ?? m.attachmentUrl }
      : m,
  );
}

async function myId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) fail('Ikke innlogget.');
  return data.user.id;
}

export class SupabaseApiClient implements ApiClient {
  // --- listings ---------------------------------------------------------

  async listListings(params: ListListingsParams = {}): Promise<Listing[]> {
    const { filter, sort } = params;
    // Only open oppdrag: one with an accepted tilbud is taken and leaves the feed and searches;
    // paused / archived / removed ones are only visible to their owner (Mine oppføringer).
    let q = supabase.from('listings').select(LISTING_SELECT).in('status', OPEN_LISTING_STATUSES);

    if (filter?.type) q = q.eq('type', filter.type);
    if (filter?.categorySlugs?.length) {
      q = q.in('category_slug', filter.categorySlugs);
    } else if (filter?.categorySlug && filter.categorySlug !== 'alle') {
      q = q.eq('category_slug', filter.categorySlug);
    }
    const tsQuery = prefixQuery(filter?.query ?? '');
    if (tsQuery) q = q.textSearch('search', tsQuery, { config: 'simple' });
    if (filter?.municipalities && filter.municipalities.length > 0) {
      q = q.in('municipality', filter.municipalities);
    }
    if (sort === 'PRICE') q = q.order('price_amount_minor', { ascending: true, nullsFirst: false });
    else q = q.order('created_at', { ascending: false });

    // People I have blocked don't show up in my lists (not fatal when signed out).
    const [{ data, error }, blocked] = await Promise.all([q, this.blockedIds()]);
    if (error) fail(error);
    let listings = (data as unknown as ListingRow[]).map(toListing);
    if (blocked.length) listings = listings.filter((l) => !blocked.includes(l.owner.id));
    if (filter?.verifiedOnly) {
      listings = listings.filter((l) => l.owner.verifications.some((v) => v.verified));
    }
    if (typeof filter?.maxDistanceKm === 'number') {
      const max = filter.maxDistanceKm;
      listings = listings.filter((l) => typeof l.location.distanceKm !== 'number' || l.location.distanceKm <= max);
    }
    return listings;
  }

  async getListing(id: string): Promise<Listing> {
    const { data, error } = await supabase
      .from('listings')
      .select(LISTING_SELECT)
      .eq('id', id)
      .single();
    if (error) fail(error.code === 'PGRST116' ? 'Fant ikke oppføringen.' : error);
    return toListing(data as unknown as ListingRow);
  }

  async createListing(listing: Listing, extras?: ListingExtras): Promise<Listing> {
    const owner = await myId();
    const { data: row, error } = await supabase
      .from('listings')
      .insert({
        type: listing.type,
        owner_id: owner,
        title: listing.title,
        category_slug: listing.category.slug,
        price_amount_minor: listing.price?.amountMinor ?? null,
        price_currency: listing.price?.currency ?? 'NOK',
        price_mode: listing.priceMode,
        municipality: listing.location.municipality,
        place: listing.location.place,
        status: listing.status,
        offer_audience: extras?.offerAudience ?? 'ALL',
        max_distance_km: extras?.maxDistanceKm ?? null,
        estimated_minutes: extras?.estimatedMinutes ?? null,
        // only when it hastes: an app build that reaches people before 0071 is pushed can still publish
        ...(extras?.urgentUntil ? { urgent_until: extras.urgentUntil } : {}),
        ...(extras?.firstToFollowedUntil ? { first_to_followed_until: extras.firstToFollowedUntil } : {}),
      })
      .select('id')
      .single();
    if (error) fail(error);
    const listingId = (row as { id: string }).id;

    // Details + images are separate inserts; on any failure remove the orphan
    // listing row so a half-published draft doesn't linger.
    const rollback = async (err: { message?: string; code?: string }): Promise<never> => {
      await supabase.from('listings').delete().eq('id', listingId);
      return fail(err);
    };

    if (listing.task) {
      const { error: e } = await supabase.from('task_details').insert({
        listing_id: listingId,
        description: listing.task.description,
        equipment: listing.task.equipment ?? null,
        meeting_note: listing.task.meetingNote ?? null,
        duration_text: listing.task.durationText ?? null,
        scheduled_text: listing.task.scheduledText ?? null,
        is_dugnad: listing.task.isDugnad ?? false,
        recurrence: listing.task.recurrence ?? null,
        intake: listing.task.intake ?? [],
        wizard: extras?.wizard ?? null,
      });
      if (e) await rollback(e);
    }
    if (extras?.privateEstimateMinor != null) {
      const { error: e } = await supabase
        .from('listing_private')
        .insert({ listing_id: listingId, private_estimate_minor: extras.privateEstimateMinor });
      if (e) await rollback(e);
    }
    if (listing.offer) {
      const { error: e } = await supabase.from('service_offer_details').insert({
        listing_id: listingId,
        about: listing.offer.about,
        experience_years: listing.offer.experienceMonths != null ? Math.floor(listing.offer.experienceMonths / 12) : (listing.offer.experienceYears ?? null),
        experience_months: listing.offer.experienceMonths ?? null,
        completed_jobs: listing.offer.completedJobs ?? null,
        services: listing.offer.services,
        availability_text: listing.offer.availabilityText ?? null,
        available_weekdays: listing.offer.availableWeekdays ?? [],
        instant_book: listing.offer.instantBook ?? false,
        equipment_text: listing.offer.equipmentText ?? null,
        max_distance_km: listing.offer.maxDistanceKm ?? null,
      });
      if (e) await rollback(e);
    }
    if (listing.images.length) {
      const { error: e } = await supabase.from('listing_images').insert(
        listing.images.map((im, ord) => ({
          listing_id: listingId,
          storage_path: im.url,
          ord,
        })),
      );
      if (e) await rollback(e);
    }
    return this.getListing(listingId);
  }

  async updateListing(listingId: string, listing: Listing, extras: ListingExtras): Promise<Listing> {
    const { error } = await supabase.rpc('update_listing', {
      p_listing_id: listingId,
      p_title: listing.title,
      p_category_slug: listing.category.slug,
      p_price_mode: listing.priceMode,
      p_price_minor: listing.price?.amountMinor ?? null,
      p_municipality: listing.location.municipality,
      p_place: listing.location.place,
      p_description: listing.task?.description ?? '',
      p_equipment: listing.task?.equipment ?? '',
      p_meeting_note: listing.task?.meetingNote ?? '',
      p_duration_text: listing.task?.durationText ?? '',
      p_scheduled_text: listing.task?.scheduledText ?? '',
      p_intake: listing.task?.intake ?? [],
      p_images: listing.images.map((im) => im.url),
      p_offer_audience: extras.offerAudience,
      p_max_distance_km: extras.maxDistanceKm ?? null,
      p_private_estimate_minor: extras.privateEstimateMinor ?? null,
      p_estimated_minutes: extras.estimatedMinutes ?? null,
      p_wizard: extras.wizard ?? null,
      p_urgent_until: extras.urgentUntil ?? null,
    });
    if (error) fail(error);
    return this.getListing(listingId);
  }

  async updateOffer(listingId: string, listing: Listing): Promise<Listing> {
    const o = listing.offer;
    if (!o) fail('Mangler beskrivelse av hjelpen.');
    const { error } = await supabase.rpc('update_offer', {
      p_listing_id: listingId,
      p_title: listing.title,
      p_category_slug: listing.category.slug,
      p_price_mode: listing.priceMode,
      p_price_minor: listing.price?.amountMinor ?? null,
      p_municipality: listing.location.municipality,
      p_place: listing.location.place,
      p_about: o.about,
      p_services: o.services,
      p_availability_text: o.availabilityText ?? '',
      p_available_weekdays: o.availableWeekdays ?? [],
      p_equipment_text: o.equipmentText ?? '',
      p_experience_months: o.experienceMonths ?? null,
      p_max_distance_km: o.maxDistanceKm ?? null,
      p_images: listing.images.map((im) => im.url),
    });
    if (error) fail(error);
    return this.getListing(listingId);
  }

  async getListingEditData(listingId: string): Promise<ListingEditData> {
    const [{ data: td, error: e1 }, { data: priv, error: e2 }] = await Promise.all([
      supabase.from('task_details').select('wizard').eq('listing_id', listingId).maybeSingle(),
      supabase.from('listing_private').select('private_estimate_minor').eq('listing_id', listingId).maybeSingle(),
    ]);
    if (e1) fail(e1);
    if (e2) fail(e2);
    return {
      wizard: (td as { wizard: unknown } | null)?.wizard ?? null,
      privateEstimateMinor: (priv as { private_estimate_minor: number | null } | null)?.private_estimate_minor ?? null,
    };
  }

  async getMyAccountStatus(): Promise<AccountStatus> {
    const { data, error } = await supabase.rpc('my_account_status');
    if (error) fail(error);
    const r = data as { suspended: boolean; deleted: boolean };
    return { suspended: !!r.suspended, deleted: !!r.deleted };
  }

  async getMyAccount(): Promise<MyAccount> {
    const { data, error } = await supabase.rpc('my_account');
    if (error) fail(error);
    const r = (data ?? {}) as Partial<Record<keyof MyAccount, unknown>>;
    return {
      vipps: !!r.vipps,
      youth: !!r.youth,
      age: (r.age as number | null) ?? undefined,
      birthYear: (r.birthYear as number | null) ?? undefined,
      fullName: (r.fullName as string | null) ?? undefined,
      phoneMasked: (r.phoneMasked as string | null) ?? undefined,
      emailMasked: (r.emailMasked as string | null) ?? undefined,
    };
  }

  async listSentProposals(): Promise<Proposal[]> {
    const me = await myId();
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('from_profile_id', me)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as unknown as ProposalRow[]).map(toProposal);
  }

  async listMyListings(type?: ListingType): Promise<Listing[]> {
    const me = await myId();
    let q = supabase.from('listings').select(LISTING_SELECT).eq('owner_id', me).neq('status', 'REMOVED');
    if (type) q = q.eq('type', type);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as unknown as ListingRow[]).map(toListing);
  }

  async setListingStatus(listingId: string, status: ListingStatus): Promise<void> {
    const me = await myId();
    const { error } = await supabase.from('listings').update({ status }).eq('id', listingId).eq('owner_id', me);
    if (error) fail(error);
  }

  // --- conversations & messages ----------------------------------------

  /** Unread counts + last author per conversation. Empty when the RPC isn't there yet (before 0036). */
  private async conversationMeta(): Promise<Map<string, ConversationMetaRow>> {
    const { data, error } = await supabase.rpc('my_conversation_meta');
    if (error) return new Map();
    return new Map((data as ConversationMetaRow[]).map((m) => [m.conversation_id, m]));
  }

  async listConversations(params: ListConversationsParams = {}): Promise<Conversation[]> {
    const me = await myId();
    const [{ data, error }, meta] = await Promise.all([
      supabase
        .from('conversations')
        .select(CONVERSATION_SELECT)
        .order('last_message_at', { ascending: false })
        .order('created_at', { ...LAST_MESSAGE, ascending: false })
        .limit(1, LAST_MESSAGE),
      this.conversationMeta(),
    ]);
    if (error) fail(error);

    // My app now has everything sent to me → the senders see "Levert" (0051). Not awaited.
    void supabase.rpc('mark_conversations_delivered').then(() => undefined);
    // People I have blocked don't show up in Innboks.
    const blocked = await this.blockedIds();
    let convs = (data as unknown as ConversationRow[])
      .map((r) => toConversation(r, me, meta.get(r.id)))
      .filter((c) => !blocked.includes(c.counterpart.id))
      // newest real message first (the row's own timestamp can lag)
      .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
    if (params.unreadOnly) convs = convs.filter((c) => c.unread);
    if (params.query?.trim()) {
      const needle = params.query.trim().toLowerCase();
      convs = convs.filter(
        (c) =>
          c.counterpart.displayName.toLowerCase().includes(needle) ||
          c.listing.title.toLowerCase().includes(needle),
      );
    }
    return convs;
  }

  async setConversationMuted(conversationId: string, muted: boolean): Promise<void> {
    const { error } = await supabase.rpc('set_conversation_muted', { p_conversation_id: conversationId, p_muted: muted });
    if (error) fail(error);
  }

  async markConversationsRead(conversationIds: string[]): Promise<void> {
    const results = await Promise.all(
      conversationIds.map((id) => supabase.rpc('mark_conversation_read', { p_conversation_id: id })),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) fail(failed.error);
  }

  async getConversation(id: string): Promise<Conversation> {
    const me = await myId();
    const { data, error } = await supabase
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .eq('id', id)
      .order('created_at', { ...LAST_MESSAGE, ascending: false })
      .limit(1, LAST_MESSAGE)
      .single();
    if (error) fail(error.code === 'PGRST116' ? 'Fant ikke samtalen.' : error);
    await supabase.rpc('mark_conversation_read', { p_conversation_id: id });
    return toConversation(data as unknown as ConversationRow, me);
  }

  async startConversationForListing(listingId: string): Promise<Conversation> {
    const { data, error } = await supabase.rpc('start_conversation_for_listing', {
      p_listing_id: listingId,
    });
    if (error) fail(error);
    const convId = (data as { id: string }).id;
    return this.getConversation(convId);
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const me = await myId();
    const [{ data, error }, parts] = await Promise.all([
      supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
      // how far the other person has read → "Lest" on my messages
      supabase.from('conversation_participants').select('*').eq('conversation_id', conversationId),
    ]);
    if (error) fail(error);
    const others = ((parts.error ? [] : parts.data) as { profile_id: string; last_read_at: string | null; last_delivered_at?: string | null }[]).filter(
      (p) => p.profile_id !== me,
    );
    const latest = (key: 'last_read_at' | 'last_delivered_at') =>
      others
        .map((p) => p[key])
        .filter((t): t is string => !!t)
        .sort()
        .pop();
    const messages = await withSignedPhotos((data as unknown as MessageRow[]).map(toMessage));
    return withReadState(messages, me, latest('last_read_at'), latest('last_delivered_at'));
  }

  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_my_message', { p_message_id: messageId });
    if (error) fail(error);
  }

  async setConversationArchived(conversationId: string, archived: boolean): Promise<void> {
    const { error } = await supabase.rpc('set_conversation_archived', { p_conversation_id: conversationId, p_archived: archived });
    if (error) fail(error);
  }

  async transcribeMessage(messageId: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('transcribe', { body: { messageId } });
    if (error) fail('Fikk ikke laget tekst av talemeldingen. Prøv igjen.');
    return String((data as { text?: string } | null)?.text ?? '');
  }

  async sendMessage(conversationId: string, text: string, replyToId?: string): Promise<Message> {
    const me = await myId();
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        author_id: me,
        kind: 'TEXT',
        text,
        client_token: token(),
        // only when it is a reply: an app build can reach people before 0089 is pushed
        ...(replyToId ? { reply_to_id: replyToId } : {}),
      })
      .select('*')
      .single();
    if (error) fail(error);
    return toMessage(data as unknown as MessageRow);
  }

  async sendAttachment(conversationId: string, attachmentPath: string): Promise<Message> {
    const me = await myId();
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        author_id: me,
        kind: 'IMAGE',
        text: '',
        attachment_path: chatPath(attachmentPath),
        client_token: token(),
      })
      .select('*')
      .single();
    if (error) fail(error);
    return (await withSignedPhotos([toMessage(data as unknown as MessageRow)]))[0];
  }

  async sendVoice(conversationId: string, attachmentPath: string, durationMs: number): Promise<Message> {
    const me = await myId();
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        author_id: me,
        kind: 'AUDIO',
        text: '',
        attachment_path: chatPath(attachmentPath),
        audio_ms: Math.round(durationMs),
        client_token: token(),
      })
      .select('*')
      .single();
    if (error) fail(error);
    return (await withSignedPhotos([toMessage(data as unknown as MessageRow)]))[0];
  }

  async toggleReaction(conversationId: string, messageId: string, emoji: string): Promise<Message[]> {
    const me = await myId();
    // toggle_message_reaction(message_id, emoji) flips the caller's reaction
    const { error } = await supabase.rpc('toggle_message_reaction', {
      p_message_id: messageId,
      p_emoji: emoji,
      p_profile_id: me,
    });
    if (error) fail(error);
    return this.listMessages(conversationId);
  }

  async setPinnedMessage(conversationId: string, messageId: string | null): Promise<Message[]> {
    // clear any existing pin in the conversation, then set the new one
    const clear = await supabase
      .from('messages')
      .update({ pinned: false })
      .eq('conversation_id', conversationId)
      .eq('pinned', true);
    if (clear.error) fail(clear.error);
    if (messageId) {
      const { error } = await supabase
        .from('messages')
        .update({ pinned: true })
        .eq('id', messageId);
      if (error) fail(error);
    }
    return this.listMessages(conversationId);
  }

  async instantBook(listingId: string): Promise<{ proposalId: string }> {
    const { data, error } = await supabase.rpc('instant_book', { p_listing_id: listingId });
    if (error) fail(error);
    return { proposalId: data as string };
  }

  async getListingOfferCount(listingId: string): Promise<OfferCount> {
    const { data, error } = await supabase.rpc('listing_offer_count', { p_listing_id: listingId });
    if (error) fail(error);
    const r = (data ?? {}) as { count?: number; mine?: boolean };
    return { count: r.count ?? 0, mine: !!r.mine };
  }

  async getHelperSlots(listingId: string): Promise<HelperSlots> {
    const { data, error } = await supabase.rpc('listing_helper_slots', { p_listing_id: listingId });
    // a server without 0086 knows one helper per oppdrag
    if (error) return { needed: 1, taken: 0 };
    const r = (data ?? {}) as Partial<HelperSlots>;
    return { needed: r.needed ?? 1, taken: r.taken ?? 0 };
  }

  async closeHelperSlots(listingId: string): Promise<void> {
    const { error } = await supabase.rpc('close_helper_slots', { p_listing_id: listingId });
    if (error) fail(error);
  }

  async listListingQuestions(listingId: string): Promise<ListingQuestion[]> {
    const { data, error } = await supabase
      .from('listing_questions')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true });
    // a server without 0088 simply has no questions yet
    if (error?.code === '42P01' || error?.code === 'PGRST205') return [];
    if (error) fail(error);
    return (data as QuestionRow[]).map(toQuestion);
  }

  async askListingQuestion(listingId: string, body: string): Promise<ListingQuestion> {
    const { data, error } = await supabase.rpc('ask_listing_question', { p_listing_id: listingId, p_body: body });
    if (error) fail(error);
    return toQuestion(data as unknown as QuestionRow);
  }

  async answerListingQuestion(id: string, answer: string): Promise<ListingQuestion> {
    const { data, error } = await supabase.rpc('answer_listing_question', { p_id: id, p_answer: answer });
    if (error) fail(error);
    return toQuestion(data as unknown as QuestionRow);
  }

  async deleteListingQuestion(id: string): Promise<void> {
    const { error } = await supabase.rpc('delete_listing_question', { p_id: id });
    if (error) fail(error);
  }

  async getReplyMinutes(profileId: string): Promise<number | null> {
    const { data, error } = await supabase.rpc('profile_reply_minutes', { p_profile_id: profileId });
    if (error) fail(error);
    return (data as number | null) ?? null;
  }

  async notifyMatchingHelpers(listingId: string): Promise<number> {
    const { data, error } = await supabase.rpc('notify_matching_helpers', {
      p_listing_id: listingId,
    });
    if (error) fail(error);
    return (data as number) ?? 0;
  }

  // --- proposals & agreements -----------------------------------------

  async getProposal(id: string): Promise<Proposal> {
    const { data, error } = await supabase.from('proposals').select('*').eq('id', id).single();
    if (error) fail(error.code === 'PGRST116' ? 'Fant ikke tilbudet.' : error);
    return toProposal(data as unknown as ProposalRow);
  }

  async listReceivedProposals(): Promise<Proposal[]> {
    const me = await myId();
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('to_profile_id', me)
      .in('status', ['SENT', 'REVISION_PENDING', 'ACCEPTED'])
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as unknown as ProposalRow[]).map(toProposal);
  }

  async listProposalsForListing(listingId: string): Promise<Proposal[]> {
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('listing_id', listingId)
      .order('price_amount_minor', { ascending: true });
    if (error) fail(error);
    return (data as unknown as ProposalRow[]).map(toProposal);
  }

  async sendProposal(input: SendProposalInput): Promise<Proposal> {
    const { data, error } = await supabase.rpc('send_proposal', {
      p_conversation_id: input.conversationId,
      p_listing_id: input.listingId,
      p_price_minor: input.priceAmountMinor,
      p_message: input.message ?? '',
      p_scheduled_text: input.scheduledText ?? '',
      p_caveats: input.caveats ?? '',
      p_client_token: token(),
    });
    if (error) fail(error);
    const sent = toProposal(data as unknown as ProposalRow);
    return this.withExtras(sent, input.scheduledAt, input.durationText);
  }

  /** Store the structured day/time + duration next to a tilbud just sent or edited (0037). */
  private async withExtras(p: Proposal, scheduledAt?: string | null, durationText?: string): Promise<Proposal> {
    if (scheduledAt === undefined && durationText === undefined) return p;
    const { data, error } = await supabase.rpc('set_proposal_extras', {
      p_proposal_id: p.id,
      p_scheduled_at: scheduledAt ?? null,
      p_duration_text: durationText ?? '',
    });
    // The tilbud itself is sent; a missing extra must not turn that into a failure.
    if (error) {
      reportError(error, { scope: 'set_proposal_extras' });
      return p;
    }
    return toProposal(data as unknown as ProposalRow);
  }

  async markProposalSeen(proposalId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_proposal_seen', { p_proposal_id: proposalId });
    if (error) fail(error);
  }

  async reviseProposal(proposalId: string, patch: ReviseProposalPatch): Promise<Proposal> {
    const { data, error } = await supabase.rpc('revise_proposal', {
      p_proposal_id: proposalId,
      p_note: patch.message ?? '',
      p_price_minor: patch.priceAmountMinor ?? null,
      p_scheduled_text: patch.scheduledText ?? '',
      p_caveats: patch.caveats ?? '',
    });
    if (error) fail(error);
    return toProposal(data as unknown as ProposalRow);
  }

  async editProposal(proposalId: string, patch: EditProposalPatch): Promise<Proposal> {
    const { data, error } = await supabase.rpc('edit_proposal', {
      p_proposal_id: proposalId,
      p_price_minor: patch.priceAmountMinor,
      p_scheduled_text: patch.scheduledText ?? '',
      p_message: patch.message ?? '',
      p_caveats: patch.caveats ?? '',
    });
    if (error) fail(error);
    const edited = toProposal(data as unknown as ProposalRow);
    return this.withExtras(edited, patch.scheduledAt, patch.durationText);
  }

  async respondToProposal(
    proposalId: string,
    event: ProposalEvent,
    actor: Actor,
  ): Promise<RespondToProposalResult> {
    const { data, error } = await supabase.rpc('respond_to_proposal', {
      p_proposal_id: proposalId,
      p_event: event,
      p_actor: actor,
    });
    if (error) fail(error);
    const proposal = toProposal(data as unknown as ProposalRow);
    const agreement =
      proposal.status === 'ACCEPTED' ? (await this.getAgreement(proposalId)) ?? undefined : undefined;
    return { proposal, agreement };
  }

  async cancelAgreement(proposalId: string, reason?: string): Promise<Proposal> {
    const { data, error } = await supabase.rpc('cancel_agreement', {
      p_proposal_id: proposalId,
      p_reason: reason ?? null,
    });
    if (error) fail(error);
    return toProposal(data as unknown as ProposalRow);
  }

  async getAgreement(proposalId: string): Promise<AgreementSnapshot | null> {
    const { data, error } = await supabase
      .from('agreement_snapshots')
      .select('*')
      .eq('proposal_id', proposalId)
      .maybeSingle();
    if (error) fail(error);
    return data ? toAgreement(data as unknown as AgreementRow) : null;
  }

  async getAgreementTimeProposal(proposalId: string): Promise<AgreementTimeProposal | null> {
    const { data, error } = await supabase
      .from('agreement_time_proposals')
      .select('*')
      .eq('proposal_id', proposalId)
      .eq('status', 'PENDING')
      .maybeSingle();
    // the table arrives with migration 0053 – until then there is simply nothing proposed
    if (error) return null;
    return data ? toTimeProposal(data as unknown as TimeProposalRow) : null;
  }

  async proposeAgreementTime(proposalId: string, scheduledAt: string, scheduledText: string): Promise<AgreementTimeProposal> {
    const { data, error } = await supabase.rpc('propose_agreement_time', {
      p_proposal_id: proposalId,
      p_scheduled_at: scheduledAt,
      p_scheduled_text: scheduledText,
    });
    if (error) fail(error);
    return toTimeProposal(data as unknown as TimeProposalRow);
  }

  async respondAgreementTime(id: string, answer: 'ACCEPT' | 'DECLINE' | 'WITHDRAW'): Promise<AgreementTimeProposal> {
    const { data, error } = await supabase.rpc('respond_agreement_time', { p_id: id, p_answer: answer });
    if (error) fail(error);
    return toTimeProposal(data as unknown as TimeProposalRow);
  }

  async requestHelpAgain(proposalId: string, input?: { when?: string; note?: string }): Promise<string> {
    const { data, error } = await supabase.rpc('request_help_again', {
      p_proposal_id: proposalId,
      p_when: input?.when ?? null,
      p_note: input?.note ?? null,
    });
    if (error) fail(error);
    return data as unknown as string;
  }

  async getPriceGuidance(categorySlug: string): Promise<PriceRange | null> {
    const { data, error } = await supabase.rpc('price_guidance', { p_category_slug: categorySlug });
    // guidance is a nicety: without it the screens fall back to the fixed range
    if (error || !data) return null;
    const r = data as unknown as PriceRange;
    return r.low > 0 && r.high >= r.low ? r : null;
  }

  async getGuardianLinks(): Promise<GuardianLinks> {
    const { data, error } = await supabase.rpc('my_guardian_links');
    if (error || !data) return { youth: false, guardians: [], youths: [] };
    const d = data as unknown as {
      youth: boolean;
      code: { code: string; expiresAt: string } | null;
      guardians: { id: string; name: string }[];
      youths: { id: string; name: string; age: number | null }[];
    };
    return {
      youth: !!d.youth,
      code: d.code ?? undefined,
      guardians: d.guardians ?? [],
      youths: (d.youths ?? []).map((y) => ({ id: y.id, name: y.name, age: y.age ?? undefined })),
    };
  }

  async createGuardianCode(): Promise<string> {
    const { data, error } = await supabase.rpc('guardian_invite_code');
    if (error) fail(error);
    return data as unknown as string;
  }

  async linkGuardian(code: string): Promise<string> {
    const { data, error } = await supabase.rpc('guardian_link', { p_code: code });
    if (error) fail(error);
    return (data as unknown as string) ?? '';
  }

  async unlinkGuardian(linkId: string): Promise<void> {
    const { error } = await supabase.rpc('guardian_unlink', { p_id: linkId });
    if (error) fail(error);
  }

  async joinKommuneWaitlist(kommune: string): Promise<void> {
    const me = await myId();
    const { error } = await supabase
      .from('kommune_waitlist')
      .upsert({ profile_id: me, kommune: kommune.trim() }, { onConflict: 'profile_id,kommune', ignoreDuplicates: true });
    if (error) fail(error);
  }

  async getAgreementForConversation(conversationId: string): Promise<AgreementSnapshot | null> {
    const { data, error } = await supabase
      .from('agreement_snapshots')
      .select('*, proposals!inner(conversation_id)')
      .eq('proposals.conversation_id', conversationId)
      .maybeSingle();
    if (error) fail(error);
    return data ? toAgreement(data as unknown as AgreementRow) : null;
  }

  async listMyAgreements(): Promise<AgendaItem[]> {
    const me = await myId();
    const { data, error } = await supabase
      .from('agreement_snapshots')
      .select(
        '*, proposals!inner(from_profile_id, to_profile_id, status), listings!inner(title), completion_confirmations(by_profile_id), reviews(from_profile_id, rating)',
      )
      .or(`from_profile_id.eq.${me},to_profile_id.eq.${me}`, { foreignTable: 'proposals' });
    if (error) fail(error);
    type Row = AgreementRow & {
      proposals: { from_profile_id: string; to_profile_id: string; status: string };
      listings: { title: string };
      completion_confirmations: { by_profile_id: string }[];
      reviews: { from_profile_id: string; rating: number }[];
    };
    return (data as unknown as Row[])
      .map((r) => {
        const a = toAgreement(r as unknown as AgreementRow);
        return {
          proposalId: a.proposalId,
          listingId: a.listingId,
          listingTitle: r.listings.title,
          counterpartId:
            r.proposals.from_profile_id === me
              ? r.proposals.to_profile_id
              : r.proposals.from_profile_id,
          price: a.price,
          scheduledText: a.scheduledText,
          scheduledAt: a.scheduledAt,
          durationText: a.durationText,
          agreedAt: a.agreedAt,
          fullyCompleted: (r.completion_confirmations ?? []).length >= 2,
          role: r.proposals.from_profile_id === me ? ('HELPER' as const) : ('CLIENT' as const),
          cancelled: r.proposals.status === 'CANCELLED' || !!a.cancelledAt,
          myRating: (r.reviews ?? []).find((x) => x.from_profile_id === me)?.rating,
        };
      })
      .sort((x, y) => Date.parse(y.agreedAt) - Date.parse(x.agreedAt));
  }

  async getJobWorkspace(proposalId: string): Promise<JobWorkspace> {
    const { data, error } = await supabase
      .from('job_workspaces')
      .select('*')
      .eq('proposal_id', proposalId)
      .maybeSingle();
    if (error) fail(error);
    const row = data as {
      checklist: JobWorkspace['checklist'] | null;
      materials: JobWorkspace['materials'] | null;
      timer_started_at: string | null;
      timer_accum_ms: number | null;
      first_started_at?: string | null;
      paused_at?: string | null;
      paused_ms?: number | null;
      timer_stopped_at?: string | null;
    } | null;
    const ms = (t?: string | null) => (t ? Date.parse(t) : null);
    return {
      proposalId,
      checklist: row?.checklist ?? [],
      materials: row?.materials ?? [],
      photos: (row as { photos?: JobWorkspace['photos'] } | null)?.photos ?? [],
      timerStartedAt: row?.timer_started_at ? Date.parse(row.timer_started_at) : null,
      timerAccumMs: row?.timer_accum_ms ?? 0,
      firstStartedAt: ms(row?.first_started_at),
      pausedMs: row?.paused_ms ?? 0,
      pausedAt: ms(row?.paused_at),
      timerStoppedAt: ms(row?.timer_stopped_at),
    };
  }

  async updateJobWorkspace(
    proposalId: string,
    action: Parameters<ApiClient['updateJobWorkspace']>[1],
  ): Promise<JobWorkspace> {
    const { error } = await supabase.rpc('update_job_workspace', {
      p_proposal_id: proposalId,
      p_action: action,
    });
    if (error) fail(error);
    return this.getJobWorkspace(proposalId);
  }

  // --- profile, verification, notifications, reviews ------------------

  async getProfile(id: string): Promise<PublicProfile> {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', id)
      .single();
    if (error) fail(error.code === 'PGRST116' ? 'Fant ikke profilen.' : error);
    const profile = toProfile(data as unknown as ProfileRow);
    // home notes are private (0057): only your own are part of your profile
    if (id === (await sessionUserId())) profile.homeNotes = await this.myHomeNotes(id);
    return profile;
  }

  private async myHomeNotes(me: string): Promise<string | undefined> {
    const { data, error } = await supabase.from('profile_home_notes').select('notes').eq('profile_id', me).maybeSingle();
    if (error) fail(error);
    return (data as { notes: string } | null)?.notes ?? undefined;
  }

  async canEndorse(profileId: string): Promise<boolean> {
    const me = await sessionUserId();
    if (!me || me === profileId) return false;
    const { data, error } = await supabase.rpc('has_completed_agreement', { p_a: me, p_b: profileId });
    if (error) fail(error);
    return !!data;
  }

  async getSharedContact(profileId: string): Promise<SharedContact> {
    const { data, error } = await supabase.rpc('shared_contact', { p_profile_id: profileId });
    if (error) fail(error);
    const r = (data ?? {}) as { phone?: string | null; homeNotes?: string | null };
    return { phone: r.phone ?? undefined, homeNotes: r.homeNotes ?? undefined };
  }

  async updateProfile(patch: UpdateProfilePatch): Promise<PublicProfile> {
    const me = await myId();
    const row: Record<string, unknown> = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.presentation !== undefined) row.presentation = patch.presentation;
    if (patch.place !== undefined) row.place = patch.place;
    if (patch.municipality !== undefined) row.municipality = patch.municipality;
    if (patch.avatarPath !== undefined) row.avatar_path = patch.avatarPath;
    if (patch.maxDistanceKm !== undefined) row.max_distance_km = patch.maxDistanceKm;
    if (patch.paused !== undefined) row.paused = patch.paused;
    if (patch.availableForJobs !== undefined) row.available_for_jobs = patch.availableForJobs;
    if (patch.categorySlugs !== undefined) row.category_slugs = patch.categorySlugs;
    if (patch.languages !== undefined) row.languages = patch.languages;
    if (patch.hasCar !== undefined) row.has_car = patch.hasCar;
    if (patch.availabilityText !== undefined) row.availability_text = patch.availabilityText.trim() || null;
    if (patch.portfolio !== undefined) row.portfolio = patch.portfolio;
    if (patch.highlightOptIn !== undefined) row.highlight_opt_in = patch.highlightOptIn;
    if (patch.availableWeekdays !== undefined) row.available_weekdays = patch.availableWeekdays.length ? patch.availableWeekdays : null;

    if (patch.homeNotes !== undefined) {
      const notes = patch.homeNotes.trim();
      const { error: notesErr } = notes
        ? await supabase
            .from('profile_home_notes')
            .upsert({ profile_id: me, notes, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' })
        : await supabase.from('profile_home_notes').delete().eq('profile_id', me);
      if (notesErr) fail(notesErr);
    }
    if (Object.keys(row).length === 0) return this.getProfile(me);

    const { data, error } = await supabase
      .from('profiles')
      .update(row)
      .eq('id', me)
      .select(PROFILE_SELECT)
      .single();
    if (error) fail(error);
    const profile = toProfile(data as unknown as ProfileRow);
    profile.homeNotes = await this.myHomeNotes(me);
    return profile;
  }

  async verify(kind: VerificationKind): Promise<PublicProfile> {
    const { error } = await supabase.rpc('request_verification', { p_kind: kind });
    if (error) fail(error);
    return this.getProfile(await myId());
  }

  async listNotifications(): Promise<AppNotification[]> {
    const me = await myId();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', me)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as unknown as NotificationRow[]).map(toNotification);
  }

  async markAllNotificationsRead(): Promise<void> {
    const me = await myId();
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('profile_id', me)
      .eq('read', false);
    if (error) fail(error);
  }

  async markNotificationRead(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) fail(error);
  }

  async listReviews(profileId: string): Promise<Review[]> {
    // only reviews that are visible: both have reviewed, or 10 days have passed (0059)
    const { data, error } = await supabase
      .from('visible_reviews')
      .select('*')
      .eq('to_profile_id', profileId)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as unknown as ReviewRow[]).map(toReview);
  }

  async replyToReview(reviewId: string, reply: string): Promise<Review> {
    const { data, error } = await supabase.rpc('reply_to_review', { p_review_id: reviewId, p_text: reply });
    if (error) fail(error);
    return toReview(data as unknown as ReviewRow);
  }

  async getReliability(profileId: string): Promise<ReliabilityDetails> {
    const { data, error } = await supabase.rpc('profile_reliability', { p_profile_id: profileId });
    if (error) fail(error);
    const r = (data ?? {}) as { completed?: number; showsUp?: number | null; onTime?: number | null; completes?: number | null };
    return {
      completed: r.completed ?? 0,
      showsUp: r.showsUp ?? undefined,
      onTime: r.onTime ?? undefined,
      completes: r.completes ?? undefined,
    };
  }

  async listPortfolio(profileId: string): Promise<PortfolioItem[]> {
    const { data, error } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as PortfolioRow[]).map(toPortfolioItem);
  }

  async addPortfolioItem(input: Parameters<ApiClient['addPortfolioItem']>[0]): Promise<PortfolioItem> {
    const me = await myId();
    const { data, error } = await supabase
      .from('portfolio_items')
      .insert({
        profile_id: me,
        before_path: input.beforePath ?? null,
        after_path: input.afterPath,
        title: input.title.trim(),
        place: input.place?.trim() || null,
        caption: input.caption?.trim() || null,
        category_slug: input.categorySlug ?? null,
        done_at: new Date().toISOString().slice(0, 10),
      })
      .select('*')
      .single();
    if (error) fail(error);
    return toPortfolioItem(data as PortfolioRow);
  }

  async removePortfolioItem(id: string): Promise<void> {
    const me = await myId();
    const { error } = await supabase.from('portfolio_items').delete().eq('id', id).eq('profile_id', me);
    if (error) fail(error);
  }

  // --- completion & review ------------------------------------------

  async sendThankCard(proposalId: string, card: ThankCardKind, message?: string): Promise<ThankCard> {
    const { data, error } = await supabase.rpc('send_thank_card', { p_proposal_id: proposalId, p_card: card, p_message: message ?? '' });
    if (error) fail(error);
    return toThank(data as unknown as ThankRow);
  }

  async listThankCards(profileId: string): Promise<ThankCard[]> {
    const { data, error } = await supabase
      .from('thank_cards')
      .select('*')
      .eq('to_profile_id', profileId)
      .order('created_at', { ascending: false });
    // a server without 0091 has no cards yet – the profile just doesn't show the section
    if (error?.code === '42P01' || error?.code === 'PGRST205') return [];
    if (error) fail(error);
    return (data as ThankRow[]).map(toThank);
  }

  async getYearRecap(year: number): Promise<YearRecap> {
    const { data, error } = await supabase.rpc('my_year_recap', { p_year: year });
    if (error) fail(error);
    const r = (data ?? {}) as Partial<YearRecap> & { topCategory?: string | null; stars?: number | null };
    return {
      year,
      helped: r.helped ?? 0,
      gotHelp: r.gotHelp ?? 0,
      neighbours: r.neighbours ?? 0,
      topCategory: r.topCategory ?? undefined,
      thanks: r.thanks ?? 0,
      stars: r.stars == null ? undefined : Number(r.stars),
    };
  }

  async getAgreedSum(year: number): Promise<AgreedSum> {
    const { data, error } = await supabase.rpc('my_agreed_sum', { p_year: year });
    if (error) fail(error);
    const r = (data ?? {}) as Partial<AgreedSum>;
    return { year, totalMinor: Number(r.totalMinor ?? 0), jobs: Number(r.jobs ?? 0), people: r.people ?? [] };
  }

  async getMyPoliceCertificate(): Promise<PoliceCertificate> {
    const me = await myId();
    const { data, error } = await supabase
      .from('police_certificates')
      .select('status, decided_at, rejection_reason')
      .eq('profile_id', me)
      .maybeSingle();
    if (error || !data) return { status: 'NONE' };
    const r = data as { status: PoliceCertificate['status']; decided_at: string | null; rejection_reason: string | null };
    return { status: r.status, decidedAt: r.decided_at ?? undefined, rejectionReason: r.rejection_reason ?? undefined };
  }

  async submitPoliceCertificate(path: string): Promise<void> {
    const { error } = await supabase.rpc('submit_police_certificate', { p_path: path });
    if (error) fail(error);
  }

  async hasPoliceCertificate(profileId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('has_police_certificate', { p_profile: profileId });
    return !error && !!data;
  }

  async getCompletion(agreementProposalId: string): Promise<CompletionConfirmation[]> {
    const { data, error } = await supabase
      .from('completion_confirmations')
      .select('*')
      .eq('agreement_proposal_id', agreementProposalId);
    if (error) fail(error);
    return (data as { agreement_proposal_id: string; by_profile_id: string; confirmed_at: string }[]).map(
      (r) => ({
        agreementProposalId: r.agreement_proposal_id,
        byProfileId: r.by_profile_id,
        confirmedAt: r.confirmed_at,
      }),
    );
  }

  async confirmCompletion(
    agreementProposalId: string,
    _byProfileId: string,
  ): Promise<CompletionConfirmation[]> {
    const { data, error } = await supabase.rpc('confirm_completion', {
      p_agreement_proposal_id: agreementProposalId,
    });
    if (error) fail(error);
    return (data as { agreement_proposal_id: string; by_profile_id: string; confirmed_at: string }[]).map(
      (r) => ({
        agreementProposalId: r.agreement_proposal_id,
        byProfileId: r.by_profile_id,
        confirmedAt: r.confirmed_at,
      }),
    );
  }

  async submitReview(input: SubmitReviewInput): Promise<Review> {
    const { data, error } = await supabase.rpc('submit_review', {
      p_agreement_proposal_id: input.agreementProposalId,
      p_rating: input.rating,
      p_comment: input.comment ?? '',
      p_tags: input.tags ?? [],
      p_recommends: input.recommends ?? null,
    });
    if (error) fail(error);
    return toReview(data as unknown as ReviewRow);
  }

  async listPendingReviews(): Promise<PendingReview[]> {
    const { data, error } = await supabase.rpc('my_pending_reviews');
    // before 0072 is pushed the function is missing – nothing is owed then, never block the app
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') return [];
      fail(error);
    }
    type Row = { proposal_id: string; listing_id: string; listing_title: string; other_id: string; other_name: string; completed_at: string };
    return ((data ?? []) as Row[]).map((r) => ({
      proposalId: r.proposal_id,
      listingId: r.listing_id,
      listingTitle: r.listing_title,
      otherId: r.other_id,
      otherName: r.other_name,
      completedAt: r.completed_at,
    }));
  }

  // --- no-show rescue (0074) ---

  async reportHelperNoShow(proposalId: string, reason: Exclude<NoShowReason, 'HELPER_CANCELLED'>, makeUrgent: boolean): Promise<RescueResult> {
    const { data, error } = await supabase.rpc('report_helper_no_show', {
      p_proposal_id: proposalId,
      p_reason: reason,
      p_make_urgent: makeUrgent,
    });
    if (error) fail(error);
    const r = (data ?? {}) as { urgent?: boolean; others?: number; reportId?: string | null };
    return { urgent: !!r.urgent, others: r.others ?? 0, reportId: r.reportId ?? undefined };
  }

  async makeRescueUrgent(proposalId: string): Promise<void> {
    const { error } = await supabase.rpc('make_rescue_urgent', { p_proposal_id: proposalId });
    if (error) fail(error);
  }

  async confirmStillAvailable(proposalId: string): Promise<void> {
    const { error } = await supabase.rpc('confirm_still_available', { p_proposal_id: proposalId });
    if (error) fail(error);
  }

  async confirmAttendance(proposalId: string): Promise<void> {
    const { error } = await supabase.rpc('confirm_attendance', { p_proposal_id: proposalId });
    if (error) fail(error);
  }

  async setHelperStatus(proposalId: string, status: HelperStatus, place?: string): Promise<void> {
    const args = { p_proposal_id: proposalId, p_status: status };
    const { error } = await supabase.rpc('set_helper_status', place ? { ...args, p_place: place } : args);
    // a server without 0078 doesn't know p_place yet – the status itself must still get through
    if (error && place && error.code === 'PGRST202') {
      const retry = await supabase.rpc('set_helper_status', args);
      if (retry.error) fail(retry.error);
      return;
    }
    if (error) fail(error);
  }

  async getNoShowReport(id: string): Promise<NoShowReport> {
    const { data, error } = await supabase.rpc('no_show_report', { p_id: id });
    if (error) fail(error);
    if (!data) fail('Fant ikke saken.');
    const r = data as NoShowReport & { explanation?: string | null; explainedAt?: string | null; weight: number | string };
    return { ...r, weight: Number(r.weight), explanation: r.explanation ?? undefined, explainedAt: r.explainedAt ?? undefined };
  }

  async explainNoShow(id: string, text: string): Promise<void> {
    const { error } = await supabase.rpc('explain_no_show', { p_id: id, p_text: text });
    if (error) fail(error);
  }

  async getMyTilbudPause(): Promise<string | null> {
    const { data, error } = await supabase.rpc('my_tilbud_pause');
    // before 0074 is pushed nothing is paused – never block a tilbud on that
    if (error) return null;
    return ((data ?? {}) as { until?: string | null }).until ?? null;
  }

  async reportNoShow(agreementProposalId: string, profileId: string): Promise<void> {
    const { error } = await supabase.rpc('report_no_show', {
      p_agreement_proposal_id: agreementProposalId,
      p_profile_id: profileId,
    });
    if (error) fail(error);
  }

  async listEndorsements(profileId: string): Promise<SkillEndorsement[]> {
    const me = await myId();
    const { data, error } = await supabase
      .from('skill_endorsements')
      .select('skill, endorser_id')
      .eq('target_id', profileId);
    if (error) fail(error);
    const rows = (data as { skill: string; endorser_id: string }[]) ?? [];
    const bySkill = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!bySkill.has(r.skill)) bySkill.set(r.skill, new Set());
      bySkill.get(r.skill)!.add(r.endorser_id);
    }
    return [...bySkill.entries()]
      .map(([skill, people]) => ({ skill, count: people.size, byMe: people.has(me) }))
      .sort((a, b) => b.count - a.count);
  }

  async toggleEndorsement(profileId: string, skill: string): Promise<SkillEndorsement[]> {
    const { error } = await supabase.rpc('toggle_endorsement', {
      p_target_id: profileId,
      p_skill: skill,
    });
    if (error) fail(error);
    return this.listEndorsements(profileId);
  }

  async listFollowedProfileIds(): Promise<string[]> {
    const me = await myId();
    const { data, error } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', me);
    if (error) fail(error);
    return (data as { followed_id: string }[]).map((r) => r.followed_id);
  }

  async toggleFollow(profileId: string): Promise<string[]> {
    const { error } = await supabase.rpc('toggle_follow', { p_followed_id: profileId });
    if (error) fail(error);
    return this.listFollowedProfileIds();
  }

  async signOutEverywhere(): Promise<void> {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) fail(error);
  }

  async listCategories(): Promise<CategoryRow[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('slug, label, tile_bg, icon_color, active, sort_order')
      .order('sort_order');
    if (error) fail(error);
    return ((data ?? []) as { slug: string; label: string; tile_bg: string | null; icon_color: string | null; active: boolean | null; sort_order: number | null }[]).map(
      (r, i) => ({ slug: r.slug, label: r.label, tileBg: r.tile_bg, iconColor: r.icon_color, active: r.active !== false, sortOrder: r.sort_order ?? (i + 1) * 10 }),
    );
  }

  async getAppSettings(): Promise<AppSettings> {
    const keys = [
      'platform.maintenance_mode',
      'platform.registration_open',
      'platform.default_radius_km',
      'partners.version',
      'partners.max_hovedpartnere',
      'platform.min_app_version',
      'platform.transcripts_enabled',
    ];
    const { data, error } = await supabase.from('app_settings').select('key, value').in('key', keys);
    if (error) fail(error);
    const v = Object.fromEntries(((data ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() && Number.isFinite(Number(x)) ? Number(x) : undefined);
    const max = num(v['partners.max_hovedpartnere']);
    const radius = num(v['platform.default_radius_km']);
    return {
      maintenance: v['platform.maintenance_mode'] === true,
      // only an explicit `false` closes sign-ups
      registrationOpen: v['platform.registration_open'] !== false,
      defaultRadiusKm: radius && radius > 0 ? radius : undefined,
      partnersVersion: v['partners.version'] == null ? '' : String(v['partners.version']),
      maxHovedpartnere: max && max > 0 ? Math.round(max) : DEFAULT_APP_SETTINGS.maxHovedpartnere,
      minAppVersion: typeof v['platform.min_app_version'] === 'string' ? v['platform.min_app_version'] : DEFAULT_APP_SETTINGS.minAppVersion,
      transcriptsEnabled: v['platform.transcripts_enabled'] === true,
    };
  }

  async getPartnerThanks(): Promise<PartnerThanks> {
    const { data, error } = await supabase.rpc('partner_thanks_summary');
    if (error) fail(error);
    const out: PartnerThanks = {};
    for (const r of (data ?? []) as { partner_id: string; thanks: number; mine: boolean }[]) {
      out[r.partner_id] = { count: r.thanks, mine: !!r.mine };
    }
    return out;
  }

  async thankPartner(partnerId: string): Promise<number> {
    const { data, error } = await supabase.rpc('thank_partner', { p_partner: partnerId });
    if (error) fail(error);
    return typeof data === 'number' ? data : 0;
  }

  async logPartnerEvent(partnerId: string, kind: 'impression' | 'click', kommune?: string): Promise<void> {
    const { error } = await supabase.rpc('log_partner_event', { p_partner: partnerId, p_kind: kind, p_kommune: kommune ?? null });
    if (error) fail(error);
  }

  async listPartners(): Promise<Partner[]> {
    const { data, error } = await supabase
      .from('partners')
      .select('*, partner_placements(surface, active)')
      .order('name');
    if (error) fail(error);
    return (data as PartnerRow[]).map(toPartner);
  }

  async listDonations(): Promise<Donation[]> {
    const { data, error } = await supabase
      .from('donation_records')
      .select('*')
      .order('transferred_at', { ascending: false });
    if (error) fail(error);
    return (data as DonationRow[]).map(toDonation);
  }

  async listNoticeboard(kind?: NoticeKind): Promise<NoticeboardPost[]> {
    let q = supabase.from('noticeboard_posts').select('*').order('created_at', { ascending: false });
    if (kind) q = q.eq('kind', kind);
    // "N svar" comes from an RPC (0041); without it the posts simply show no count.
    const me = await myId().catch(() => '');
    // likes arrive with 0094; before it is pushed the posts simply show none
    const [{ data, error }, counts, likes] = await Promise.all([
      q,
      supabase.rpc('noticeboard_reply_counts'),
      supabase.from('notice_likes').select('notice_id, profile_id'),
    ]);
    if (error) fail(error);
    const liked = new Map<string, number>();
    const mine = new Set<string>();
    for (const r of (likes.error ? [] : likes.data) as { notice_id: string; profile_id: string }[]) {
      liked.set(r.notice_id, (liked.get(r.notice_id) ?? 0) + 1);
      if (r.profile_id === me) mine.add(r.notice_id);
    }
    const replies = new Map(
      ((counts.error ? [] : counts.data) as { notice_id: string; replies: number }[]).map((r) => [r.notice_id, r.replies]),
    );
    return (data as NoticeRow[]).map((r) => ({
      ...toNoticeboardPost(r),
      replies: replies.get(r.id) ?? 0,
      likes: liked.get(r.id) ?? 0,
      likedByMe: mine.has(r.id),
    }));
  }

  async toggleNoticeLike(noticeId: string, liked: boolean): Promise<void> {
    const me = await myId();
    const { error } = liked
      ? await supabase.from('notice_likes').upsert({ notice_id: noticeId, profile_id: me }, { ignoreDuplicates: true })
      : await supabase.from('notice_likes').delete().eq('notice_id', noticeId).eq('profile_id', me);
    if (error) fail(error);
  }

  async updateNoticeboardPost(
    id: string,
    patch: { kind?: NoticeKind; title?: string; body?: string; imagePath?: string | null; done?: boolean },
  ): Promise<NoticeboardPost> {
    const me = await myId();
    const row: Record<string, unknown> = {};
    if (patch.kind !== undefined) row.kind = patch.kind;
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.body !== undefined) row.body = patch.body;
    if (patch.imagePath !== undefined) row.image_path = patch.imagePath;
    if (patch.done !== undefined) row.done_at = patch.done ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from('noticeboard_posts')
      .update(row)
      .eq('id', id)
      .eq('author_id', me)
      .select('*')
      .single();
    if (error) fail(error);
    return toNoticeboardPost(data as NoticeRow);
  }

  async listNoticeComments(noticeId: string): Promise<NoticeComment[]> {
    const { data, error } = await supabase
      .from('notice_comments')
      .select('*')
      .eq('notice_id', noticeId)
      .order('created_at', { ascending: true });
    if (error) fail(error);
    return (data as CommentRow[]).map(toComment);
  }

  async addNoticeComment(noticeId: string, body: string): Promise<NoticeComment> {
    const me = await myId();
    const { data, error } = await supabase
      .from('notice_comments')
      .insert({ notice_id: noticeId, author_id: me, body: body.trim() })
      .select('*')
      .single();
    if (error) fail(error);
    return toComment(data as CommentRow);
  }

  async deleteNoticeComment(id: string): Promise<void> {
    const { error } = await supabase.from('notice_comments').delete().eq('id', id);
    if (error) fail(error);
  }

  async listDugnadSignups(noticeId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('notice_signups')
      .select('profile_id')
      .eq('notice_id', noticeId)
      .order('created_at', { ascending: true });
    if (error) fail(error);
    return (data as { profile_id: string }[]).map((r) => r.profile_id);
  }

  async setDugnadSignup(noticeId: string, join: boolean): Promise<number> {
    const { data, error } = await supabase.rpc('set_dugnad_signup', { p_notice_id: noticeId, p_join: join });
    if (error) fail(error);
    return Number(data ?? 0);
  }

  async listToolBookedDays(noticeId: string): Promise<{ from: string; to: string }[]> {
    const { data, error } = await supabase.rpc('tool_booked_days', { p_notice_id: noticeId });
    if (error) fail(error);
    return ((data ?? []) as { from_date: string; to_date: string }[]).map((r) => ({ from: r.from_date, to: r.to_date }));
  }

  async listToolBookings(noticeId: string): Promise<ToolBooking[]> {
    const { data, error } = await supabase
      .from('tool_bookings')
      .select('*')
      .eq('notice_id', noticeId)
      .order('from_date', { ascending: true });
    if (error) fail(error);
    return (data as BookingRow[]).map(toBooking);
  }

  async requestToolBooking(noticeId: string, from: string, to: string, note?: string): Promise<ToolBooking> {
    const { data, error } = await supabase.rpc('request_tool_booking', { p_notice_id: noticeId, p_from: from, p_to: to, p_note: note ?? '' });
    if (error) fail(error);
    return toBooking(data as unknown as BookingRow);
  }

  async respondToolBooking(id: string, status: 'APPROVED' | 'DECLINED' | 'RETURNED' | 'CANCELLED'): Promise<ToolBooking> {
    const { data, error } = await supabase.rpc('respond_tool_booking', { p_id: id, p_status: status });
    if (error) fail(error);
    return toBooking(data as unknown as BookingRow);
  }

  async listSavedNoticeIds(): Promise<string[]> {
    const me = await myId();
    const { data, error } = await supabase.from('saved_notices').select('notice_id').eq('profile_id', me);
    if (error) fail(error);
    return (data as { notice_id: string }[]).map((r) => r.notice_id);
  }

  async toggleSavedNotice(noticeId: string): Promise<string[]> {
    const me = await myId();
    const { data: existing } = await supabase
      .from('saved_notices')
      .select('notice_id')
      .eq('profile_id', me)
      .eq('notice_id', noticeId)
      .maybeSingle();
    const { error } = existing
      ? await supabase.from('saved_notices').delete().eq('profile_id', me).eq('notice_id', noticeId)
      : await supabase.from('saved_notices').insert({ profile_id: me, notice_id: noticeId });
    if (error) fail(error);
    return this.listSavedNoticeIds();
  }

  async createNoticeboardPost(input: {
    kind: NoticeKind;
    title: string;
    body: string;
    place: string;
    municipality: string;
    /** storage path in `listing-images` */
    imagePath?: string;
    neighbourhoodId?: string;
    isDugnad?: boolean;
    eventAt?: string;
  }): Promise<NoticeboardPost> {
    const me = await myId();
    const { data, error } = await supabase
      .from('noticeboard_posts')
      .insert({
        author_id: me,
        kind: input.kind,
        title: input.title,
        body: input.body,
        place: input.place,
        municipality: input.municipality,
        ...(input.imagePath ? { image_path: input.imagePath } : {}),
        ...(input.neighbourhoodId ? { neighbourhood_id: input.neighbourhoodId } : {}),
        ...(input.isDugnad ? { is_dugnad: true, event_at: input.eventAt ?? null } : {}),
      })
      .select('*')
      .single();
    if (error) fail(error);
    return toNoticeboardPost(data as NoticeRow);
  }

  async deleteNoticeboardPost(id: string): Promise<void> {
    const { error } = await supabase.from('noticeboard_posts').delete().eq('id', id);
    if (error) fail(error);
  }

  // --- konto ---

  async deleteMyAccount(reason?: string): Promise<void> {
    const { error } = await supabase.rpc('delete_my_account', { p_reason: reason ?? null });
    if (error) fail(error);
    // Closes the login (soft delete). The data is already gone even if this fails.
    const { error: fnErr } = await supabase.functions.invoke('delete-account');
    if (fnErr) reportError(fnErr, { where: 'deleteMyAccount.function' });
  }

  // --- innstillinger ---

  async getMySettings(): Promise<MySettings> {
    const me = await myId();
    const { data, error } = await supabase.from('profile_settings').select('*').eq('profile_id', me).maybeSingle();
    if (error) fail(error);
    const row = data as { email: string | null; notification_prefs: Partial<NotificationPrefs> | null } | null;
    return { email: row?.email ?? undefined, notificationPrefs: withDefaultPrefs(row?.notification_prefs) };
  }

  async updateNotificationPrefs(prefs: NotificationPrefs): Promise<MySettings> {
    const me = await myId();
    const { error } = await supabase
      .from('profile_settings')
      .upsert({ profile_id: me, notification_prefs: prefs, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' });
    if (error) fail(error);
    return this.getMySettings();
  }

  async registerPushToken(token: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
    // The RPC lets this phone's token move to whoever is signed in now (0050).
    const { error: rpcError } = await supabase.rpc('register_push_token', { p_token: token, p_platform: platform });
    if (!rpcError) return;
    // before 0050 is pushed: the old direct write
    const me = await myId();
    const { error } = await supabase
      .from('push_tokens')
      .upsert({ token, profile_id: me, platform, updated_at: new Date().toISOString() }, { onConflict: 'token' });
    if (error) fail(error);
  }

  async unregisterPushToken(token: string): Promise<void> {
    const { error } = await supabase.rpc('unregister_push_token', { p_token: token });
    if (error) fail(error);
  }

  // --- personvern ---

  async listConsentRecords(): Promise<ConsentRecord[]> {
    const me = await myId();
    const { data, error } = await supabase
      .from('consent_records')
      .select('*')
      .eq('profile_id', me)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    type Row = { id: string; terms: boolean; privacy: boolean; age: boolean; tips?: boolean | null; created_at: string };
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      terms: r.terms,
      privacy: r.privacy,
      age: r.age,
      tips: r.tips ?? undefined,
      createdAt: r.created_at,
    }));
  }

  async setTipsConsent(on: boolean): Promise<ConsentRecord> {
    const me = await myId();
    const last = (await this.listConsentRecords())[0];
    const { data, error } = await supabase
      .from('consent_records')
      .insert({ profile_id: me, terms: last?.terms ?? true, privacy: last?.privacy ?? true, age: last?.age ?? true, tips: on })
      .select('*')
      .single();
    if (error) fail(error);
    const r = data as { id: string; terms: boolean; privacy: boolean; age: boolean; tips: boolean; created_at: string };
    return { id: r.id, terms: r.terms, privacy: r.privacy, age: r.age, tips: r.tips, createdAt: r.created_at };
  }

  // --- nabolag ---

  async recordInvite(inviterId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('record_invite', { p_inviter: inviterId });
    if (error) fail(error);
    return !!data;
  }

  async inviteCount(profileId: string): Promise<number> {
    const { data, error } = await supabase.rpc('invite_count', { p_profile: profileId });
    // a server without 0081 has no invites yet
    if (error?.code === 'PGRST202') return 0;
    if (error) fail(error);
    return Number(data ?? 0);
  }

  async neighbourhoodHighlights(municipality: string): Promise<NeighbourhoodHighlight[]> {
    const { data, error } = await supabase.rpc('neighbourhood_highlights', { p_municipality: municipality });
    // a server without 0080 has nothing to highlight yet – Nabolag just shows no card
    if (error?.code === 'PGRST202') return [];
    if (error) fail(error);
    return ((data ?? []) as NeighbourhoodHighlight[]).filter((h) => h.profileId && h.jobs > 0);
  }

  async getNeighbourhood(municipality: string, place: string): Promise<NeighbourhoodInfo> {
    const { data, error } = await supabase.rpc('neighbourhood_info', { p_municipality: municipality, p_place: place });
    if (error) fail(error);
    type Row = { id: string; name: string; created_at: string; member_count: number; is_member: boolean; member_ids: string[] | null };
    const row = ((data ?? []) as Row[])[0];
    return {
      id: row?.id ?? null,
      name: row?.name ?? `${place} nabolag`,
      place,
      municipality,
      createdAt: row?.created_at,
      memberCount: row?.member_count ?? 0,
      isMember: !!row?.is_member,
      memberIds: row?.member_ids ?? [],
    };
  }

  async joinNeighbourhood(municipality: string, place: string): Promise<NeighbourhoodInfo> {
    const { error } = await supabase.rpc('join_neighbourhood', { p_municipality: municipality, p_place: place });
    if (error) fail(error);
    return this.getNeighbourhood(municipality, place);
  }

  async leaveNeighbourhood(municipality: string, place: string): Promise<NeighbourhoodInfo> {
    const current = await this.getNeighbourhood(municipality, place);
    if (current.id) {
      const { error } = await supabase.rpc('leave_neighbourhood', { p_id: current.id });
      if (error) fail(error);
    }
    return this.getNeighbourhood(municipality, place);
  }

  // --- «MinNabo» in Innboks ---

  async getMinNaboThread(): Promise<MinNaboMessage[]> {
    const { data, error } = await supabase.rpc('minnabo_thread');
    if (error) fail(error);
    type Row = Omit<MinNaboMessage, 'readAt' | 'broadcastId' | 'title' | 'pollOptions' | 'myVote' | 'pollCounts'> & {
      readAt: string | null;
      broadcastId: string | null;
      title: string | null;
      pollOptions: string[] | null;
      myVote: number | null;
      pollCounts: number[] | null;
    };
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      fromAdmin: r.fromAdmin,
      body: r.body,
      createdAt: r.createdAt,
      readAt: r.readAt ?? undefined,
      broadcastId: r.broadcastId ?? undefined,
      kind: r.kind,
      title: r.title ?? undefined,
      pollOptions: r.pollOptions ?? undefined,
      pollClosed: !!r.pollClosed,
      myVote: r.myVote ?? undefined,
      pollCounts: r.pollCounts ?? undefined,
    }));
  }

  async replyToMinNabo(body: string): Promise<void> {
    const { error } = await supabase.rpc('minnabo_reply', { p_body: body });
    if (error) fail(error);
  }

  async voteMinNaboPoll(broadcastId: string, option: number): Promise<void> {
    const { error } = await supabase.rpc('minnabo_vote', { p_broadcast: broadcastId, p_option: option });
    if (error) fail(error);
  }

  async markMinNaboRead(): Promise<void> {
    const { error } = await supabase.rpc('minnabo_mark_read');
    if (error) fail(error);
  }

  async listNabolag(municipality?: string): Promise<NabolagSummary[]> {
    const { data, error } = await supabase.rpc('nabolag_list', municipality ? { p_municipality: municipality } : {});
    if (error) fail(error);
    type Row = { id: string; name: string; place: string; municipality: string; member_count: number; is_member: boolean };
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      name: r.name,
      place: r.place,
      municipality: r.municipality,
      memberCount: r.member_count,
      isMember: r.is_member,
    }));
  }

  async joinNabolag(id: string): Promise<void> {
    const { error } = await supabase.rpc('join_nabolag', { p_id: id });
    if (error) fail(error);
  }

  async leaveNabolag(id: string): Promise<void> {
    const { error } = await supabase.rpc('leave_neighbourhood', { p_id: id });
    if (error) fail(error);
  }

  // --- saved listings & searches ---

  async listSavedListingIds(): Promise<string[]> {
    const me = await myId();
    const { data, error } = await supabase
      .from('saved_listings')
      .select('listing_id')
      .eq('profile_id', me);
    if (error) fail(error);
    return (data as { listing_id: string }[]).map((r) => r.listing_id);
  }

  async toggleSavedListing(listingId: string): Promise<string[]> {
    const me = await myId();
    const { data: existing } = await supabase
      .from('saved_listings')
      .select('listing_id')
      .eq('profile_id', me)
      .eq('listing_id', listingId)
      .maybeSingle();
    if (existing) {
      await supabase.from('saved_listings').delete().eq('profile_id', me).eq('listing_id', listingId);
    } else {
      await supabase.from('saved_listings').insert({ profile_id: me, listing_id: listingId });
    }
    return this.listSavedListingIds();
  }

  async listSavedSearches(): Promise<SavedSearchRecord[]> {
    const me = await myId();
    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('profile_id', me)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (
      data as { id: string; name: string; filter: unknown; sort: string; created_at: string; alert?: boolean | null; last_run_at?: string | null }[]
    ).map((r) => ({
      id: r.id,
      name: r.name,
      filter: r.filter as SavedSearchRecord['filter'],
      sort: r.sort as SavedSearchRecord['sort'],
      createdAt: r.created_at,
      alert: r.alert ?? false,
      lastRunAt: r.last_run_at ?? undefined,
    }));
  }

  async setSavedSearchAlert(id: string, alert: boolean): Promise<void> {
    const me = await myId();
    const { error } = await supabase.from('saved_searches').update({ alert }).eq('id', id).eq('profile_id', me);
    if (error) fail(error);
  }

  async markSavedSearchRun(id: string): Promise<void> {
    const { error } = await supabase.rpc('mark_saved_search_run', { p_id: id });
    if (error) fail(error);
  }

  async addSavedSearch(
    input: Omit<SavedSearchRecord, 'id' | 'createdAt'>,
  ): Promise<SavedSearchRecord> {
    const me = await myId();
    const { data, error } = await supabase
      .from('saved_searches')
      .insert({ profile_id: me, name: input.name, filter: input.filter, sort: input.sort, ...(input.alert ? { alert: true } : {}) })
      .select('*')
      .single();
    if (error) fail(error);
    const r = data as { id: string; name: string; filter: unknown; sort: string; created_at: string };
    return {
      id: r.id,
      name: r.name,
      filter: r.filter as SavedSearchRecord['filter'],
      sort: r.sort as SavedSearchRecord['sort'],
      createdAt: r.created_at,
    };
  }

  async removeSavedSearch(id: string): Promise<void> {
    const { error } = await supabase.from('saved_searches').delete().eq('id', id);
    if (error) fail(error);
  }

  // --- safety ---

  async listReports(): Promise<Report[]> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      // "Mine rapporter": only what I reported myself (an admin's row security would return everyone's)
      .eq('by_profile_id', await myId())
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as {
      id: string;
      target_type: Report['targetType'];
      target_id: string;
      reason: string;
      details: string | null;
      by_profile_id: string;
      created_at: string;
      status: 'OPEN' | 'RESOLVED';
      claimed_at?: string | null;
    }[]).map((r) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      details: r.details ?? undefined,
      byProfileId: r.by_profile_id,
      createdAt: r.created_at,
      status: r.status,
      claimedAt: r.claimed_at ?? undefined,
    }));
  }

  async submitReport(input: SubmitReportInput): Promise<Report> {
    const { data, error } = await supabase.rpc('submit_report', {
      p_target_type: input.targetType,
      p_target_id: input.targetId,
      p_reason: input.reason,
      p_details: input.details ?? '',
    });
    if (error) fail(error);
    if (input.attachmentPath) {
      // The report itself is in; a failed attachment must not look like a failed report.
      const { error: attErr } = await supabase.rpc('set_report_attachment', {
        p_report_id: (data as { id: string }).id,
        p_path: input.attachmentPath,
      });
      if (attErr) reportError(attErr, { scope: 'set_report_attachment' });
    }
    const r = data as {
      id: string;
      target_type: Report['targetType'];
      target_id: string;
      reason: string;
      details: string | null;
      by_profile_id: string;
      created_at: string;
      status: 'OPEN' | 'RESOLVED';
    };
    return {
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      details: r.details ?? undefined,
      byProfileId: r.by_profile_id,
      createdAt: r.created_at,
      status: r.status,
    };
  }

  async resolveReport(reportId: string): Promise<Report> {
    const { error } = await supabase.rpc('resolve_report', { p_report_id: reportId });
    if (error) fail(error);
    const all = await this.listReports();
    return all.find((r) => r.id === reportId)!;
  }

  async listBlockedProfileIds(): Promise<string[]> {
    const me = await myId();
    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_profile_id')
      .eq('by_profile_id', me);
    if (error) fail(error);
    const ids = (data as { blocked_profile_id: string }[]).map((r) => r.blocked_profile_id);
    this.blockedCache = { me, ids, at: Date.now() };
    return ids;
  }

  /** My block list for filtering lists: kept for a minute so every list doesn't fetch it again. */
  private blockedCache: { me: string; ids: string[]; at: number } | null = null;
  private async blockedIds(): Promise<string[]> {
    try {
      const me = await myId();
      const c = this.blockedCache;
      if (c && c.me === me && Date.now() - c.at < 60_000) return c.ids;
      return await this.listBlockedProfileIds();
    } catch {
      return [];
    }
  }

  async toggleBlock(profileId: string): Promise<string[]> {
    const me = await myId();
    const { data: existing } = await supabase
      .from('blocks')
      .select('blocked_profile_id')
      .eq('by_profile_id', me)
      .eq('blocked_profile_id', profileId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from('blocks')
        .delete()
        .eq('by_profile_id', me)
        .eq('blocked_profile_id', profileId);
    } else {
      await supabase.from('blocks').insert({ by_profile_id: me, blocked_profile_id: profileId });
    }
    this.blockedCache = null;
    return this.listBlockedProfileIds();
  }

  async getMyBusinessProfile(): Promise<BusinessProfile | null> {
    const me = await myId();
    const { data, error } = await supabase.from('business_profiles').select('*').eq('profile_id', me).maybeSingle();
    if (error) fail(error);
    if (!data) return null;
    const r = data as {
      profile_id: string; org_nr: string; company_name: string; contact_person: string; email: string; phone: string;
      category_slugs: string[] | null; status: BusinessProfile['status']; created_at: string; rejection_reason?: string | null;
    };
    return {
      profileId: r.profile_id,
      orgNr: r.org_nr,
      companyName: r.company_name,
      contactPerson: r.contact_person,
      email: r.email,
      phone: r.phone,
      categorySlugs: r.category_slugs ?? [],
      status: r.status,
      createdAt: r.created_at,
      rejectionReason: r.rejection_reason?.trim() || undefined,
    };
  }

  async submitBusinessProfile(input: {
    orgNr: string;
    companyName: string;
    contactPerson: string;
    email: string;
    phone: string;
    categorySlugs: string[];
  }): Promise<void> {
    const { error } = await supabase.rpc('submit_business_profile', {
      p_org_nr: input.orgNr,
      p_company_name: input.companyName,
      p_contact_person: input.contactPerson,
      p_email: input.email,
      p_phone: input.phone,
      p_category_slugs: input.categorySlugs,
    });
    if (error) fail(error);
  }
}
