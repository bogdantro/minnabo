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

export function useConversations(unreadOnly?: boolean, query?: string) {
  return useQuery({
    queryKey: chatKeys.conversations(unreadOnly, query),
    queryFn: () => apiClient.listConversations({ unreadOnly, query }),
    placeholderData: keepPreviousData,
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
