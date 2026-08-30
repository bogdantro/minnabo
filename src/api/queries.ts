import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import type { ListingFilter, ListingSort } from '@/domain/types';
import type { Actor, ProposalEvent } from '@/domain/proposalMachine';
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

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => apiClient.sendMessage(conversationId, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useSendAttachment(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => apiClient.sendAttachment(conversationId, url),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: ['conversations'] });
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
