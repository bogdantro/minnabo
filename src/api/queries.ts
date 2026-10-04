import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import type { Listing, ListingFilter, ListingSort, ListingStatus, Message } from '@/domain/types';
import type { Actor, ProposalEvent } from '@/domain/proposalMachine';
import type { ConsentRecord, MySettings, NeighbourhoodInfo, NotificationPrefs } from './ApiClient';
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
    mutationFn: (listing: Parameters<typeof apiClient.createListing>[0]) =>
      apiClient.createListing(listing),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listingKeys.all });
    },
  });
}

export function useConversations(unreadOnly?: boolean, query?: string) {
  return useQuery({
    queryKey: chatKeys.conversations(unreadOnly, query),
    queryFn: () => apiClient.listConversations({ unreadOnly, query }),
    placeholderData: keepPreviousData,
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
  return (data ?? []).filter((c) => c.unread).length;
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
    mutationFn: async (url: string) => {
      const temp = optimisticMessage(conversationId, meId, { kind: 'IMAGE', attachmentUrl: url });
      opt.add(temp);
      try {
        await apiClient.sendAttachment(conversationId, url);
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
    },
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

export const communityKeys = {
  partners: ['partners'] as const,
  donations: ['donations'] as const,
};

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

export function useConsentRecords() {
  return useQuery({ queryKey: consentKeys.log, queryFn: () => apiClient.listConsentRecords() });
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
  info: (municipality: string, place: string) => ['neighbourhood', municipality, place] as const,
};

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

export function useSubmitBusinessProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof apiClient.submitBusinessProfile>[0]) =>
      apiClient.submitBusinessProfile(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
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
