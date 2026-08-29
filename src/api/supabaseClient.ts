import { supabase } from '@/lib/supabase';
import type {
  AgreementSnapshot,
  AppNotification,
  CompletionConfirmation,
  Conversation,
  Listing,
  ListingType,
  Message,
  Proposal,
  PublicProfile,
  Review,
  VerificationKind,
} from '@/domain/types';
import type { Actor, ProposalEvent } from '@/domain/proposalMachine';
import type {
  ApiClient,
  ListConversationsParams,
  ListListingsParams,
  ReviseProposalPatch,
  RespondToProposalResult,
  SendProposalInput,
  SubmitReviewInput,
  UpdateProfilePatch,
} from './ApiClient';
import {
  toAgreement,
  toConversation,
  toListing,
  toMessage,
  toNotification,
  toProfile,
  toProposal,
  toReview,
  type AgreementRow,
  type ConversationRow,
  type ListingRow,
  type MessageRow,
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
  listing:listings(id,title,type,place,listing_images(storage_path,ord)),
  conversation_participants(profile:profiles(${PROFILE_SELECT})),
  message_reads(profile_id,last_read_at),
  proposals(status,created_at)
`;

function fail(message: string | undefined): never {
  throw new Error(message || 'Noe gikk galt. Prøv igjen.');
}

const token = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

async function myId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) fail('Ikke innlogget.');
  return data.user.id;
}

export class SupabaseApiClient implements ApiClient {
  // --- listings ---------------------------------------------------------

  async listListings(params: ListListingsParams = {}): Promise<Listing[]> {
    const { filter, sort } = params;
    let q = supabase.from('listings').select(LISTING_SELECT).neq('status', 'REMOVED');

    if (filter?.type) q = q.eq('type', filter.type);
    if (filter?.categorySlug && filter.categorySlug !== 'alle') {
      q = q.eq('category_slug', filter.categorySlug);
    }
    if (filter?.query?.trim()) {
      q = q.textSearch('search', filter.query.trim(), { type: 'websearch', config: 'simple' });
    }
    if (sort === 'PRICE') q = q.order('price_amount_minor', { ascending: true, nullsFirst: false });
    else q = q.order('created_at', { ascending: false });

    const { data, error } = await q;
    if (error) fail(error.message);
    let listings = (data as unknown as ListingRow[]).map(toListing);
    if (filter?.verifiedOnly) {
      listings = listings.filter((l) => l.owner.verifications.some((v) => v.verified));
    }
    return listings;
  }

  async getListing(id: string): Promise<Listing> {
    const { data, error } = await supabase
      .from('listings')
      .select(LISTING_SELECT)
      .eq('id', id)
      .single();
    if (error) fail(error.code === 'PGRST116' ? 'Fant ikke oppføringen.' : error.message);
    return toListing(data as unknown as ListingRow);
  }

  async createListing(listing: Listing): Promise<Listing> {
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
      })
      .select('id')
      .single();
    if (error) fail(error.message);
    const listingId = (row as { id: string }).id;

    if (listing.task) {
      const { error: e } = await supabase.from('task_details').insert({
        listing_id: listingId,
        description: listing.task.description,
        equipment: listing.task.equipment ?? null,
        meeting_note: listing.task.meetingNote ?? null,
        duration_text: listing.task.durationText ?? null,
        scheduled_text: listing.task.scheduledText ?? null,
      });
      if (e) fail(e.message);
    }
    if (listing.offer) {
      const { error: e } = await supabase.from('service_offer_details').insert({
        listing_id: listingId,
        about: listing.offer.about,
        experience_years: listing.offer.experienceYears ?? null,
        completed_jobs: listing.offer.completedJobs ?? null,
        services: listing.offer.services,
        availability_text: listing.offer.availabilityText ?? null,
        equipment_text: listing.offer.equipmentText ?? null,
        max_distance_km: listing.offer.maxDistanceKm ?? null,
      });
      if (e) fail(e.message);
    }
    if (listing.images.length) {
      const { error: e } = await supabase.from('listing_images').insert(
        listing.images.map((im, ord) => ({
          listing_id: listingId,
          storage_path: im.url,
          ord,
        })),
      );
      if (e) fail(e.message);
    }
    return this.getListing(listingId);
  }

  async listMyListings(type?: ListingType): Promise<Listing[]> {
    const me = await myId();
    let q = supabase.from('listings').select(LISTING_SELECT).eq('owner_id', me);
    if (type) q = q.eq('type', type);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) fail(error.message);
    return (data as unknown as ListingRow[]).map(toListing);
  }

  // --- conversations & messages ----------------------------------------

  async listConversations(params: ListConversationsParams = {}): Promise<Conversation[]> {
    const me = await myId();
    const { data, error } = await supabase
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .order('last_message_at', { ascending: false });
    if (error) fail(error.message);

    let convs = (data as unknown as ConversationRow[]).map((r) => toConversation(r, me));
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

  async getConversation(id: string): Promise<Conversation> {
    const me = await myId();
    const { data, error } = await supabase
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .eq('id', id)
      .single();
    if (error) fail(error.code === 'PGRST116' ? 'Fant ikke samtalen.' : error.message);
    await supabase.rpc('mark_conversation_read', { p_conversation_id: id });
    return toConversation(data as unknown as ConversationRow, me);
  }

  async startConversationForListing(listingId: string): Promise<Conversation> {
    const { data, error } = await supabase.rpc('start_conversation_for_listing', {
      p_listing_id: listingId,
    });
    if (error) fail(error.message);
    const convId = (data as { id: string }).id;
    return this.getConversation(convId);
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) fail(error.message);
    return (data as unknown as MessageRow[]).map(toMessage);
  }

  async sendMessage(conversationId: string, text: string): Promise<Message> {
    const me = await myId();
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        author_id: me,
        kind: 'TEXT',
        text,
        client_token: token(),
      })
      .select('*')
      .single();
    if (error) fail(error.message);
    return toMessage(data as unknown as MessageRow);
  }

  async sendAttachment(conversationId: string, attachmentUrl: string): Promise<Message> {
    const me = await myId();
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        author_id: me,
        kind: 'IMAGE',
        text: '',
        attachment_path: attachmentUrl,
        client_token: token(),
      })
      .select('*')
      .single();
    if (error) fail(error.message);
    return toMessage(data as unknown as MessageRow);
  }

  // --- proposals & agreements -----------------------------------------

  async getProposal(id: string): Promise<Proposal> {
    const { data, error } = await supabase.from('proposals').select('*').eq('id', id).single();
    if (error) fail(error.code === 'PGRST116' ? 'Fant ikke tilbudet.' : error.message);
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
    if (error) fail(error.message);
    return (data as unknown as ProposalRow[]).map(toProposal);
  }

  async listProposalsForListing(listingId: string): Promise<Proposal[]> {
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('listing_id', listingId)
      .order('price_amount_minor', { ascending: true });
    if (error) fail(error.message);
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
    if (error) fail(error.message);
    return toProposal(data as unknown as ProposalRow);
  }

  async reviseProposal(proposalId: string, patch: ReviseProposalPatch): Promise<Proposal> {
    const { data, error } = await supabase.rpc('revise_proposal', {
      p_proposal_id: proposalId,
      p_note: patch.message ?? '',
      p_price_minor: patch.priceAmountMinor ?? null,
      p_scheduled_text: patch.scheduledText ?? '',
      p_caveats: patch.caveats ?? '',
    });
    if (error) fail(error.message);
    return toProposal(data as unknown as ProposalRow);
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
    if (error) fail(error.message);
    const proposal = toProposal(data as unknown as ProposalRow);
    const agreement =
      proposal.status === 'ACCEPTED' ? (await this.getAgreement(proposalId)) ?? undefined : undefined;
    return { proposal, agreement };
  }

  async getAgreement(proposalId: string): Promise<AgreementSnapshot | null> {
    const { data, error } = await supabase
      .from('agreement_snapshots')
      .select('*')
      .eq('proposal_id', proposalId)
      .maybeSingle();
    if (error) fail(error.message);
    return data ? toAgreement(data as unknown as AgreementRow) : null;
  }

  async getAgreementForConversation(conversationId: string): Promise<AgreementSnapshot | null> {
    const { data, error } = await supabase
      .from('agreement_snapshots')
      .select('*, proposals!inner(conversation_id)')
      .eq('proposals.conversation_id', conversationId)
      .maybeSingle();
    if (error) fail(error.message);
    return data ? toAgreement(data as unknown as AgreementRow) : null;
  }

  // --- profile, verification, notifications, reviews ------------------

  async getProfile(id: string): Promise<PublicProfile> {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', id)
      .single();
    if (error) fail(error.code === 'PGRST116' ? 'Fant ikke profilen.' : error.message);
    return toProfile(data as unknown as ProfileRow);
  }

  async updateProfile(patch: UpdateProfilePatch): Promise<PublicProfile> {
    const me = await myId();
    const row: Record<string, unknown> = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.presentation !== undefined) row.presentation = patch.presentation;
    if (patch.place !== undefined) {
      row.place = patch.place;
      row.municipality = patch.place;
    }
    if (patch.avatarPath !== undefined) row.avatar_path = patch.avatarPath;
    if (patch.maxDistanceKm !== undefined) row.max_distance_km = patch.maxDistanceKm;

    const { data, error } = await supabase
      .from('profiles')
      .update(row)
      .eq('id', me)
      .select(PROFILE_SELECT)
      .single();
    if (error) fail(error.message);
    return toProfile(data as unknown as ProfileRow);
  }

  async verify(kind: VerificationKind): Promise<PublicProfile> {
    const { error } = await supabase.rpc('request_verification', { p_kind: kind });
    if (error) fail(error.message);
    return this.getProfile(await myId());
  }

  async listNotifications(): Promise<AppNotification[]> {
    const me = await myId();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', me)
      .order('created_at', { ascending: false });
    if (error) fail(error.message);
    return (data as unknown as NotificationRow[]).map(toNotification);
  }

  async markAllNotificationsRead(): Promise<void> {
    const me = await myId();
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('profile_id', me)
      .eq('read', false);
    if (error) fail(error.message);
  }

  async listReviews(profileId: string): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('to_profile_id', profileId)
      .order('created_at', { ascending: false });
    if (error) fail(error.message);
    return (data as unknown as ReviewRow[]).map(toReview);
  }

  // --- completion & review ------------------------------------------

  async getCompletion(agreementProposalId: string): Promise<CompletionConfirmation[]> {
    const { data, error } = await supabase
      .from('completion_confirmations')
      .select('*')
      .eq('agreement_proposal_id', agreementProposalId);
    if (error) fail(error.message);
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
    if (error) fail(error.message);
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
    });
    if (error) fail(error.message);
    return toReview(data as unknown as ReviewRow);
  }
}
