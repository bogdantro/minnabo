import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import type { Listing, ListingFilter, ListingSort, ListingStatus, Message } from '@/domain/types';
import type { Actor, ProposalEvent } from '@/domain/proposalMachine';
import { DEFAULT_APP_SETTINGS } from './ApiClient';
import type { AppSettings, PartnerThanks, ConsentRecord, MinNaboMessage, MySettings, NabolagSummary, NeighbourhoodInfo, NotificationPrefs } from './ApiClient';
import { apiClient } from './client';

export const listingKeys = {
  all: ['listings'] as const,
  list: (filter?: ListingFilter, sort?: ListingSort) =>
    ['listings', filter ?? null, sort ?? null] as const,
  detail: (id: string) => ['listing', id] as const,
};

export const chatKeys = {
  conversations: (unreadOnly?: boolean, query?: string) =>
    ['conversations', { unreadOnly: !!unreadOnly, query: query ?? '' }] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (id: string) => ['messages', id] as const,
  proposal: (id: string) => ['proposal', id] as const,
  agreement: (conversationId: string) => ['agreement', conversationId] as const,
};

export function useListings(filter?: ListingFilter, sort?: ListingSort) {
  return useQuery({
    queryKey: listingKeys.list(filter, sort),
    queryFn: () => apiClient.listListings({ filter, sort }),
    placeholderData: keepPreviousData,
  });
}

export function useListing(id: string) {
  return useQuery({
    queryKey: listingKeys.detail(id),
    queryFn: () => apiClient.getListing(id),
    enabled: !!id,
  });
}

/** Several listings at once (Profil: reviewer role and job per review). Missing ones resolve to undefined. */
export function useListingsByIds(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: listingKeys.detail(id),
      queryFn: () => apiClient.getListing(id),
      enabled: !!id,
      retry: false,
    })),
    combine: (results) => Object.fromEntries(ids.map((id, i) => [id, results[i]?.data])),
  });
}

export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Parameters<typeof apiClient.createListing>[0] | { listing: Parameters<typeof apiClient.createListing>[0]; extras?: Parameters<typeof apiClient.createListing>[1] }) =>
      'listing' in v && 'extras' in v ? apiClient.createListing(v.listing, v.extras) : apiClient.createListing(v as Parameters<typeof apiClient.createListing>[0]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listingKeys.all });
    },
  });
}

export function useUpdateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; listing: Parameters<typeof apiClient.updateListing>[1]; extras: Parameters<typeof apiClient.updateListing>[2] }) =>
      apiClient.updateListing(v.id, v.listing, v.extras),
    onSuccess: (l) => {
      qc.invalidateQueries({ queryKey: listingKeys.all });
      qc.invalidateQueries({ queryKey: ['listing-edit', l.id] });
      void qc.invalidateQueries({ queryKey: ['myListings'] });
    },
  });
}

export function useListingEditData(id: string | undefined) {
  return useQuery({
    queryKey: ['listing-edit', id],
    queryFn: () => apiClient.getListingEditData(id!),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useMyAccountStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['account-status'],
    queryFn: () => apiClient.getMyAccountStatus(),
    enabled,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });
}

export function useConversations(unreadOnly?: boolean, query?: string) {
  return useQuery({
    queryKey: chatKeys.conversations(unreadOnly, query),
    queryFn: () => apiClient.listConversations({ unreadOnly, query }),
    placeholderData: keepPreviousData,
    // the last message must never be a stale one from the cache
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useMarkConversationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => apiClient.markConversationsRead(ids),
    onSettled: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

/** Count of conversations with unread messages — drives the Innboks tab badge. */
export function useUnreadConversationCount(): number {
  const { data } = useQuery({
    queryKey: chatKeys.conversations(false, ''),
    queryFn: () => apiClient.listConversations({}),
    staleTime: 15_000,
  });
  // the thread with «MinNabo» counts as one conversation
  const minnabo = useMinNaboUnread() > 0 ? 1 : 0;
  return (data ?? []).filter((c) => c.unread).length + minnabo;
}

// --- «MinNabo» in Innboks (0066) ---

export const minnaboKeys = { thread: ['minnabo', 'thread'] as const };

/** My thread with MinNabo. `live` re-reads it every few seconds while the thread is open. */
export function useMinNaboThread(live = false) {
  return useQuery<MinNaboMessage[]>({
    queryKey: minnaboKeys.thread,
    queryFn: () => apiClient.getMinNaboThread(),
    staleTime: 15_000,
    refetchInterval: live ? 10_000 : false,
  });
}

export function useMinNaboUnread(): number {
  return (useMinNaboThread().data ?? []).filter((m) => m.fromAdmin && !m.readAt).length;
}

export function useMinNaboReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => apiClient.replyToMinNabo(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: minnaboKeys.thread }),
  });
}

export function useMinNaboVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ broadcastId, option }: { broadcastId: string; option: number }) => apiClient.voteMinNaboPoll(broadcastId, option),
    onSuccess: () => qc.invalidateQueries({ queryKey: minnaboKeys.thread }),
  });
}

export function useMinNaboMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.markMinNaboRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: minnaboKeys.thread }),
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: chatKeys.conversation(id),
    queryFn: () => apiClient.getConversation(id),
    enabled: !!id,
  });
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: chatKeys.messages(conversationId),
    queryFn: () => apiClient.listMessages(conversationId),
    enabled: !!conversationId,
  });
}

export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: chatKeys.proposal(id ?? ''),
    queryFn: () => apiClient.getProposal(id as string),
    enabled: !!id,
  });
}

export function useReceivedProposals() {
  return useQuery({
    queryKey: ['proposals', 'received'] as const,
    queryFn: () => apiClient.listReceivedProposals(),
  });
}

export function useProposalsForListing(listingId: string) {
  return useQuery({
    queryKey: ['proposals', 'listing', listingId] as const,
    queryFn: () => apiClient.listProposalsForListing(listingId),
    enabled: !!listingId,
  });
}

export function useCancelAgreement(proposalId: string, conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => apiClient.cancelAgreement(proposalId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.proposal(proposalId) });
      qc.invalidateQueries({ queryKey: ['agreement', 'proposal', proposalId] });
      qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: ['proposals'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['my-agreements'] });
    },
  });
}

export function useAgreementByProposal(proposalId: string) {
  return useQuery({
    queryKey: ['agreement', 'proposal', proposalId] as const,
    queryFn: () => apiClient.getAgreement(proposalId),
    enabled: !!proposalId,
  });
}

export function useEditProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { proposalId: string; patch: Parameters<typeof apiClient.editProposal>[1] }) =>
      apiClient.editProposal(v.proposalId, v.patch),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ['proposal', p.id] });
      void qc.invalidateQueries({ queryKey: ['proposals'] });
      void qc.invalidateQueries({ queryKey: ['messages', p.conversationId] });
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useReviseProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { proposalId: string; patch: Parameters<typeof apiClient.reviseProposal>[1] }) =>
      apiClient.reviseProposal(vars.proposalId, vars.patch),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.proposal(vars.proposalId) });
      qc.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

function optimisticMessage(
  conversationId: string,
  authorProfileId: string,
  patch: Partial<Message>,
): Message {
  return {
    id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    authorProfileId,
    text: '',
    kind: 'TEXT',
    createdAt: new Date().toISOString(),
    delivery: 'SENT',
    pending: true,
    ...patch,
  };
}

/** Adds the optimistic message to the cache; returns a rollback + the temp id. */
function useOptimisticSend(conversationId: string) {
  const qc = useQueryClient();
  return {
    add(msg: Message) {
      qc.setQueryData<Message[]>(chatKeys.messages(conversationId), (old = []) => [...old, msg]);
    },
    markFailed(id: string) {
      qc.setQueryData<Message[]>(chatKeys.messages(conversationId), (old = []) =>
        old.map((m) => (m.id === id ? { ...m, pending: false, failed: true } : m)),
      );
    },
    remove(id: string) {
      qc.setQueryData<Message[]>(chatKeys.messages(conversationId), (old = []) =>
        old.filter((m) => m.id !== id),
      );
    },
    settle() {
      qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  };
}

export function useSendMessage(conversationId: string, meId: string) {
  const opt = useOptimisticSend(conversationId);
  return useMutation({
    mutationFn: async (text: string) => {
      const temp = optimisticMessage(conversationId, meId, { text });
      opt.add(temp);
      try {
        await apiClient.sendMessage(conversationId, text);
        opt.remove(temp.id);
        opt.settle();
      } catch (e) {
        opt.markFailed(temp.id);
        throw e;
      }
    },
  });
}

export function useSendAttachment(conversationId: string, meId: string) {
  const opt = useOptimisticSend(conversationId);
  return useMutation({
    // `path` in the private bucket; `preview` (the photo on the phone) shows while sending
    mutationFn: async ({ path, preview }: { path: string; preview?: string }) => {
      const temp = optimisticMessage(conversationId, meId, { kind: 'IMAGE', attachmentUrl: preview ?? path, attachmentPath: path });
      opt.add(temp);
      try {
        await apiClient.sendAttachment(conversationId, path);
        opt.remove(temp.id);
        opt.settle();
      } catch (e) {
        opt.markFailed(temp.id);
        throw e;
      }
    },
  });
}

export function useToggleReaction(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      apiClient.toggleReaction(conversationId, messageId, emoji),
    onSuccess: (messages) => {
      qc.setQueryData<Message[]>(chatKeys.messages(conversationId), messages);
    },
  });
}

export function useSetPinnedMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string | null) =>
      apiClient.setPinnedMessage(conversationId, messageId),
    onSuccess: (messages) => {
      qc.setQueryData<Message[]>(chatKeys.messages(conversationId), messages);
    },
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => apiClient.startConversationForListing(listingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useSendProposal(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof apiClient.sendProposal>[0]) =>
      apiClient.sendProposal(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['offer-count'] });
    },
  });
}

/** Tilbud I have sent (youth app "Mine tilbud"). */
export function useSentProposals(enabled = true) {
  return useQuery({
    queryKey: ['proposals', 'sent'],
    queryFn: () => apiClient.listSentProposals(),
    enabled,
  });
}

export function useRespondToProposal(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { proposalId: string; event: ProposalEvent; actor: Actor }) =>
      apiClient.respondToProposal(vars.proposalId, vars.event, vars.actor),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.proposal(vars.proposalId) });
      qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: chatKeys.agreement(conversationId) });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useJobWorkspace(proposalId: string) {
  return useQuery({
    queryKey: ['job-workspace', proposalId],
    queryFn: () => apiClient.getJobWorkspace(proposalId),
    enabled: !!proposalId,
  });
}

export function useUpdateJobWorkspace(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: Parameters<typeof apiClient.updateJobWorkspace>[1]) =>
      apiClient.updateJobWorkspace(proposalId, action),
    onSuccess: (ws) => qc.setQueryData(['job-workspace', proposalId], ws),
  });
}

export function useInstantBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => apiClient.instantBook(listingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['my-agreements'] });
    },
  });
}

export function useNotifyMatchingHelpers() {
  return useMutation({
    mutationFn: (listingId: string) => apiClient.notifyMatchingHelpers(listingId),
  });
}

export function useMyAgreements() {
  return useQuery({
    queryKey: ['my-agreements'],
    queryFn: () => apiClient.listMyAgreements(),
  });
}

export function useAgreement(conversationId: string) {
  return useQuery({
    queryKey: chatKeys.agreement(conversationId),
    queryFn: () => apiClient.getAgreementForConversation(conversationId),
    enabled: !!conversationId,
  });
}

export const profileKeys = {
  profile: (id: string) => ['profile', id] as const,
  notifications: ['notifications'] as const,
  reviews: (id: string) => ['reviews', id] as const,
  myListings: (type?: string) => ['myListings', type ?? 'all'] as const,
  completion: (id: string) => ['completion', id] as const,
};

export function useProfile(id: string) {
  return useQuery({
    queryKey: profileKeys.profile(id),
    queryFn: () => apiClient.getProfile(id),
    enabled: !!id,
  });
}

/** Whether "Anbefal" is allowed on this profile (a completed avtale together). */
export function useCanEndorse(profileId: string | undefined) {
  return useQuery({
    queryKey: ['can-endorse', profileId],
    queryFn: () => apiClient.canEndorse(profileId!),
    enabled: !!profileId,
    staleTime: 5 * 60_000,
  });
}

/** Phone + home notes of yourself or a counterpart on an accepted tilbud (shared_contact). */
export function useSharedContact(profileId: string | undefined) {
  return useQuery({
    queryKey: ['shared-contact', profileId],
    queryFn: () => apiClient.getSharedContact(profileId!),
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

/** Pålitelighet (last 12 months). */
export function useReliability(profileId: string | undefined) {
  return useQuery({
    queryKey: ['reliability', profileId],
    queryFn: () => apiClient.getReliability(profileId!),
    enabled: !!profileId,
    staleTime: 10 * 60_000,
  });
}

export function usePortfolio(profileId: string | undefined) {
  return useQuery({
    queryKey: ['portfolio', profileId],
    queryFn: () => apiClient.listPortfolio(profileId!),
    enabled: !!profileId,
  });
}

export function useAddPortfolioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof apiClient.addPortfolioItem>[0]) => apiClient.addPortfolioItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  });
}

export function useRemovePortfolioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.removePortfolioItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  });
}

export function useReplyToReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { reviewId: string; reply: string }) => apiClient.replyToReview(v.reviewId, v.reply),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews'] }),
  });
}

/** "Svarer vanligvis innen …" – median reply minutes, null until there is enough history. */
export function useReplyMinutes(profileId: string | undefined) {
  return useQuery({
    queryKey: ['reply-minutes', profileId],
    queryFn: () => apiClient.getReplyMinutes(profileId!),
    enabled: !!profileId,
    staleTime: 10 * 60_000,
  });
}

/** Public offer count on an oppdrag (a number only). */
export function useListingOfferCount(listingId: string | undefined) {
  return useQuery({
    queryKey: ['offer-count', listingId],
    queryFn: () => apiClient.getListingOfferCount(listingId!),
    enabled: !!listingId,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof apiClient.updateProfile>[0]) =>
      apiClient.updateProfile(patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: profileKeys.profile(data.id) });
    },
  });
}

export function useVerify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: 'PHONE' | 'EMAIL' | 'BUSINESS') => apiClient.verify(kind),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: profileKeys.profile(data.id) });
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: profileKeys.notifications,
    queryFn: () => apiClient.listNotifications(),
  });
}

/** Count of unread notifications — drives the bell dot in every header. */
export function useUnreadNotificationCount(): number {
  const { data } = useQuery({
    queryKey: profileKeys.notifications,
    queryFn: () => apiClient.listNotifications(),
    staleTime: 15_000,
  });
  return (data ?? []).filter((n) => !n.read).length;
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.notifications }),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.notifications }),
  });
}

export function useReviews(profileId: string) {
  return useQuery({
    queryKey: profileKeys.reviews(profileId),
    queryFn: () => apiClient.listReviews(profileId),
    enabled: !!profileId,
  });
}

export function useMyListings(type?: 'TASK_REQUEST' | 'SERVICE_OFFER') {
  return useQuery({
    queryKey: profileKeys.myListings(type),
    queryFn: () => apiClient.listMyListings(type),
  });
}

/** Mine oppføringer: pause / activate / archive / soft delete. Optimistic on the owner's list. */
export function useSetListingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ListingStatus }) => apiClient.setListingStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['myListings'] });
      qc.setQueriesData<Listing[]>({ queryKey: ['myListings'] }, (old) =>
        old?.flatMap((l) => (l.id !== id ? [l] : status === 'REMOVED' ? [] : [{ ...l, status }])),
      );
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ['myListings'] });
      qc.invalidateQueries({ queryKey: listingKeys.all });
      qc.invalidateQueries({ queryKey: listingKeys.detail(id) });
    },
  });
}

export function useCompletion(agreementProposalId: string) {
  return useQuery({
    queryKey: profileKeys.completion(agreementProposalId),
    queryFn: () => apiClient.getCompletion(agreementProposalId),
    enabled: !!agreementProposalId,
  });
}

export function useConfirmCompletion(agreementProposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (byProfileId: string) =>
      apiClient.confirmCompletion(agreementProposalId, byProfileId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: profileKeys.completion(agreementProposalId) }),
  });
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof apiClient.submitReview>[0]) =>
      apiClient.submitReview(input),
    onSuccess: (review) => {
      qc.invalidateQueries({ queryKey: profileKeys.reviews(review.toProfileId) });
    },
  });
}

export function useEndorsements(profileId: string) {
  return useQuery({
    queryKey: [...profileKeys.profile(profileId), 'endorsements'],
    queryFn: () => apiClient.listEndorsements(profileId),
    enabled: !!profileId,
  });
}

export function useToggleEndorsement(profileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (skill: string) => apiClient.toggleEndorsement(profileId, skill),
    onSuccess: (endorsements) => {
      qc.setQueryData([...profileKeys.profile(profileId), 'endorsements'], endorsements);
    },
  });
}

export function useFollowedProfileIds() {
  return useQuery({
    queryKey: ['follows'],
    queryFn: () => apiClient.listFollowedProfileIds(),
  });
}

export function useToggleFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) => apiClient.toggleFollow(profileId),
    onSuccess: (ids) => qc.setQueryData(['follows'], ids),
  });
}

export const appSettingsKeys = { app: ['app-settings'] as const };
/** The category catalogue from the database (order, colours, on/off set on the website). */
export const categoryKeys = { all: ['categories'] as const };

/**
 * Platform settings from the website's admin. Falls back to the defaults (nothing closed)
 * while loading or when they can't be read, so a hiccup never locks anyone out.
 */
export function useAppSettings(): AppSettings {
  const { data } = useQuery({ queryKey: appSettingsKeys.app, queryFn: () => apiClient.getAppSettings(), staleTime: 60_000 });
  return data ?? DEFAULT_APP_SETTINGS;
}

export const communityKeys = {
  partners: ['partners'] as const,
  thanks: ['partner-thanks'] as const,
  donations: ['donations'] as const,
};

/** "N naboer har takket" per partner (+ whether I have). */
export function usePartnerThanks() {
  return useQuery({ queryKey: communityKeys.thanks, queryFn: () => apiClient.getPartnerThanks(), staleTime: 60_000 });
}

/** "Takk for støtten" – counted once per person; the number updates at once. */
export function useThankPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partnerId: string) => apiClient.thankPartner(partnerId),
    onSuccess: (count, partnerId) => {
      qc.setQueryData<PartnerThanks>(communityKeys.thanks, (old) => ({ ...(old ?? {}), [partnerId]: { count, mine: true } }));
    },
  });
}

export function usePartners() {
  return useQuery({ queryKey: communityKeys.partners, queryFn: () => apiClient.listPartners() });
}

export function useDonations() {
  return useQuery({ queryKey: communityKeys.donations, queryFn: () => apiClient.listDonations() });
}

/** Slett konto – anonymise, clean up and close the login. */
export function useDeleteMyAccount() {
  return useMutation({ mutationFn: (reason?: string) => apiClient.deleteMyAccount(reason) });
}

export const settingsKeys = { mine: ['my-settings'] as const };

export function useMySettings() {
  return useQuery({ queryKey: settingsKeys.mine, queryFn: () => apiClient.getMySettings() });
}

/** Varslinger / Innstillinger: save the whole prefs object (optimistic). */
export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPrefs) => apiClient.updateNotificationPrefs(prefs),
    onMutate: async (prefs) => {
      await qc.cancelQueries({ queryKey: settingsKeys.mine });
      const prev = qc.getQueryData<MySettings>(settingsKeys.mine);
      if (prev) qc.setQueryData<MySettings>(settingsKeys.mine, { ...prev, notificationPrefs: prefs });
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(settingsKeys.mine, ctx.prev);
    },
    onSuccess: (data) => qc.setQueryData(settingsKeys.mine, data),
  });
}

export const consentKeys = { log: ['consents'] as const };

export function useConsentRecords(enabled = true) {
  return useQuery({ queryKey: consentKeys.log, queryFn: () => apiClient.listConsentRecords(), enabled });
}

/** Personvern tips toggle: a new row in the consent log. */
export function useSetTipsConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => apiClient.setTipsConsent(on),
    onSuccess: (row) => qc.setQueryData<ConsentRecord[]>(consentKeys.log, (old) => [row, ...(old ?? [])]),
  });
}

export const neighbourhoodKeys = {
  all: ['neighbourhood'] as const,
  info: (municipality: string, place: string) => ['neighbourhood', municipality, place] as const,
  list: (municipality: string) => ['neighbourhood', 'list', municipality] as const,
  mine: ['neighbourhood', 'mine'] as const,
};

/** The nabolag MinNabo has set up in a kommune (empty for kommuner without any yet). */
export function useNabolagList(municipality?: string | null) {
  return useQuery({
    queryKey: neighbourhoodKeys.list(municipality ?? ''),
    queryFn: () => apiClient.listNabolag(municipality ?? ''),
    enabled: !!municipality,
  });
}

/** The nabolag I am in (at most 3). */
export function useMyNabolag(enabled = true) {
  return useQuery<NabolagSummary[]>({ queryKey: neighbourhoodKeys.mine, queryFn: () => apiClient.listNabolag(), enabled });
}

/** Bli med / Forlat from the list. Oppslag are refetched: what I may read follows my nabolag. */
export function useNabolagMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, join }: { id: string; join: boolean }) => (join ? apiClient.joinNabolag(id) : apiClient.leaveNabolag(id)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: neighbourhoodKeys.all });
      void qc.invalidateQueries({ queryKey: noticeboardKeys.all });
    },
  });
}

/** Nabolag for one area. Disabled until the area is known. */
export function useNeighbourhoodInfo(municipality?: string | null, place?: string | null) {
  return useQuery({
    queryKey: neighbourhoodKeys.info(municipality ?? '', place ?? ''),
    queryFn: () => apiClient.getNeighbourhood(municipality ?? '', place ?? ''),
    enabled: !!municipality && !!place,
  });
}

/** Bli med / Forlat – optimistic count ±1, reconciled with the server. */
export function useToggleNeighbourhood(municipality: string, place: string, myId: string) {
  const qc = useQueryClient();
  const key = neighbourhoodKeys.info(municipality, place);
  return useMutation({
    mutationFn: (join: boolean) =>
      join ? apiClient.joinNeighbourhood(municipality, place) : apiClient.leaveNeighbourhood(municipality, place),
    onMutate: async (join) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<NeighbourhoodInfo>(key);
      if (prev) {
        qc.setQueryData<NeighbourhoodInfo>(key, {
          ...prev,
          isMember: join,
          memberCount: Math.max(0, prev.memberCount + (join ? 1 : -1)),
          memberIds: join ? [myId, ...prev.memberIds.filter((id) => id !== myId)] : prev.memberIds.filter((id) => id !== myId),
        });
      }
      return { prev };
    },
    onError: (_e, _join, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (data) => qc.setQueryData(key, data),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: neighbourhoodKeys.mine });
      void qc.invalidateQueries({ queryKey: ['neighbourhood', 'list'] });
      void qc.invalidateQueries({ queryKey: noticeboardKeys.all });
    },
  });
}

export const noticeboardKeys = {
  all: ['noticeboard'] as const,
  list: (kind?: string) => ['noticeboard', kind ?? 'all'] as const,
};

export function useNoticeboard(kind?: import('@/domain/types').NoticeKind) {
  return useQuery({
    queryKey: noticeboardKeys.list(kind),
    queryFn: () => apiClient.listNoticeboard(kind),
  });
}

export function useSavedNoticeIds() {
  return useQuery({ queryKey: ['saved-notices'], queryFn: () => apiClient.listSavedNoticeIds() });
}

export function useToggleSavedNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noticeId: string) => apiClient.toggleSavedNotice(noticeId),
    onSuccess: (ids) => qc.setQueryData(['saved-notices'], ids),
  });
}

export function useUpdateNoticeboardPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; patch: Parameters<typeof apiClient.updateNoticeboardPost>[1] }) =>
      apiClient.updateNoticeboardPost(v.id, v.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: noticeboardKeys.all }),
  });
}

/** Oppslagstavle "Svar": the comments under one oppslag. */
export function useNoticeComments(noticeId: string | null) {
  return useQuery({
    queryKey: ['notice-comments', noticeId],
    queryFn: () => apiClient.listNoticeComments(noticeId!),
    enabled: !!noticeId,
  });
}

export function useAddNoticeComment(noticeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => apiClient.addNoticeComment(noticeId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notice-comments', noticeId] });
      void qc.invalidateQueries({ queryKey: noticeboardKeys.all });
    },
  });
}

export function useDeleteNoticeComment(noticeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteNoticeComment(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notice-comments', noticeId] });
      void qc.invalidateQueries({ queryKey: noticeboardKeys.all });
    },
  });
}

export function useCreateNoticeboardPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof apiClient.createNoticeboardPost>[0]) =>
      apiClient.createNoticeboardPost(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: noticeboardKeys.all }),
  });
}

export function useDeleteNoticeboardPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteNoticeboardPost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: noticeboardKeys.all }),
  });
}

export function useReportNoShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agreementProposalId, profileId }: { agreementProposalId: string; profileId: string }) =>
      apiClient.reportNoShow(agreementProposalId, profileId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: profileKeys.profile(vars.profileId) });
    },
  });
}

// --- saved listings & searches ---------------------------------------------

export const savedKeys = {
  listings: ['saved', 'listings'] as const,
  searches: ['saved', 'searches'] as const,
};

export function useSavedListingIds() {
  return useQuery({ queryKey: savedKeys.listings, queryFn: () => apiClient.listSavedListingIds() });
}

export function useToggleSavedListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => apiClient.toggleSavedListing(listingId),
    onSuccess: (ids) => qc.setQueryData(savedKeys.listings, ids),
  });
}

/** [isSaved, toggle] for one listing — drop-in for the old savedStore hook. */
export function useIsSaved(listingId: string): [boolean, () => void] {
  const { data } = useSavedListingIds();
  const toggle = useToggleSavedListing();
  const isSaved = (data ?? []).includes(listingId);
  return [isSaved, () => toggle.mutate(listingId)];
}

export function useSavedSearches() {
  return useQuery({ queryKey: savedKeys.searches, queryFn: () => apiClient.listSavedSearches() });
}

export function useAddSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof apiClient.addSavedSearch>[0]) =>
      apiClient.addSavedSearch(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedKeys.searches }),
  });
}

export function useSetSavedSearchAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; alert: boolean }) => apiClient.setSavedSearchAlert(v.id, v.alert),
    onSettled: () => qc.invalidateQueries({ queryKey: savedKeys.searches }),
  });
}

export function useMarkSavedSearchRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.markSavedSearchRun(id),
    onSettled: () => qc.invalidateQueries({ queryKey: savedKeys.searches }),
  });
}

export function useRemoveSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.removeSavedSearch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedKeys.searches }),
  });
}

// --- safety ---------------------------------------------------------------

export const safetyKeys = {
  reports: ['reports'] as const,
  blocked: ['blocked'] as const,
};

// --- reports ---------------------------------------------------------------

export function useReports() {
  return useQuery({ queryKey: safetyKeys.reports, queryFn: () => apiClient.listReports() });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.resolveReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: safetyKeys.reports }),
  });
}

export function useSubmitReport() {
  return useMutation({
    mutationFn: (input: Parameters<typeof apiClient.submitReport>[0]) =>
      apiClient.submitReport(input),
  });
}

export function useMyBusinessProfile() {
  return useQuery({ queryKey: ['my-business'], queryFn: () => apiClient.getMyBusinessProfile() });
}

export function useSubmitBusinessProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof apiClient.submitBusinessProfile>[0]) =>
      apiClient.submitBusinessProfile(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['my-business'] });
    },
  });
}

export function useBlockedProfileIds() {
  return useQuery({ queryKey: safetyKeys.blocked, queryFn: () => apiClient.listBlockedProfileIds() });
}

export function useToggleBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) => apiClient.toggleBlock(profileId),
    onSuccess: (ids) => qc.setQueryData(safetyKeys.blocked, ids),
  });
}

// --- avtale: nytt tidspunkt, be om hjelp igjen --------------------------------
export function useAgreementTimeProposal(proposalId: string) {
  return useQuery({
    queryKey: ['agreement', 'time', proposalId] as const,
    queryFn: () => apiClient.getAgreementTimeProposal(proposalId),
    enabled: !!proposalId,
    // the other person may have proposed or answered since this was last open
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

function useTimeProposalDone(proposalId: string, conversationId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['agreement', 'time', proposalId] });
    qc.invalidateQueries({ queryKey: ['agreement', 'proposal', proposalId] });
    qc.invalidateQueries({ queryKey: chatKeys.agreement(conversationId) });
    qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
    qc.invalidateQueries({ queryKey: ['my-agreements'] });
  };
}

export function useProposeAgreementTime(proposalId: string, conversationId: string) {
  const done = useTimeProposalDone(proposalId, conversationId);
  return useMutation({
    mutationFn: (v: { scheduledAt: string; scheduledText: string }) =>
      apiClient.proposeAgreementTime(proposalId, v.scheduledAt, v.scheduledText),
    onSuccess: done,
  });
}

export function useRespondAgreementTime(proposalId: string, conversationId: string) {
  const done = useTimeProposalDone(proposalId, conversationId);
  return useMutation({
    mutationFn: (v: { id: string; answer: 'ACCEPT' | 'DECLINE' | 'WITHDRAW' }) => apiClient.respondAgreementTime(v.id, v.answer),
    onSuccess: done,
  });
}

export function useRequestHelpAgain(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input?: { when?: string; note?: string }) => apiClient.requestHelpAgain(proposalId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['my-listings'] });
    },
  });
}

// --- prisveiledning ------------------------------------------------------------
export function usePriceGuidance(categorySlug: string | undefined) {
  return useQuery({
    queryKey: ['price-guidance', categorySlug] as const,
    queryFn: () => apiClient.getPriceGuidance(categorySlug as string),
    enabled: !!categorySlug,
    staleTime: 60 * 60 * 1000,
  });
}

// --- foresatt --------------------------------------------------------------------
export function useGuardianLinks(enabled = true) {
  return useQuery({ queryKey: ['guardian-links'] as const, queryFn: () => apiClient.getGuardianLinks(), enabled });
}

export function useGuardianActions() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: ['guardian-links'] });
  return {
    createCode: useMutation({ mutationFn: () => apiClient.createGuardianCode(), onSuccess }),
    link: useMutation({ mutationFn: (code: string) => apiClient.linkGuardian(code), onSuccess }),
    unlink: useMutation({ mutationFn: (id: string) => apiClient.unlinkGuardian(id), onSuccess }),
  };
}

// --- venteliste for andre kommuner -----------------------------------------------
export function useJoinKommuneWaitlist() {
  return useMutation({ mutationFn: (kommune: string) => apiClient.joinKommuneWaitlist(kommune) });
}

