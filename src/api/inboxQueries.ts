/** Query hooks for the Innboks features of migration 0109 (see inboxApi.ts). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AttachmentKind, ChatSettingsPatch, ConversationFlags } from '@/domain/inbox';
import { apiClient } from './client';

export const inboxKeys = {
  scheduled: (id: string) => ['scheduled-messages', id] as const,
  settings: ['chat-settings'] as const,
  status: (profileId: string) => ['chat-status', profileId] as const,
  search: (q: string) => ['message-search', q] as const,
  flags: ['inbox-flags'] as const,
  addresses: (id: string) => ['shared-addresses', id] as const,
};

export function useConversationFlags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, flags }: { id: string; flags: ConversationFlags }) => apiClient.setConversationFlags(id, flags),
    onSettled: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useEditMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => apiClient.editMessage(id, text),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['messages', conversationId] }), qc.invalidateQueries({ queryKey: ['conversations'] })]),
  });
}

export function useScheduledMessages(conversationId: string) {
  return useQuery({ queryKey: inboxKeys.scheduled(conversationId), queryFn: () => apiClient.listScheduledMessages(conversationId), enabled: !!conversationId });
}

export function useScheduleMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ text, sendAt }: { text: string; sendAt: string }) => apiClient.scheduleMessage(conversationId, text, sendAt),
    onSettled: () => qc.invalidateQueries({ queryKey: inboxKeys.scheduled(conversationId) }),
  });
}

export function useCancelScheduled(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.cancelScheduledMessage(id),
    onSettled: () => qc.invalidateQueries({ queryKey: inboxKeys.scheduled(conversationId) }),
  });
}

export function useChatSettings(enabled = true) {
  return useQuery({ queryKey: inboxKeys.settings, queryFn: () => apiClient.myChatSettings(), enabled });
}

export function useSetChatSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ChatSettingsPatch) => apiClient.setChatSettings(patch),
    onSettled: () => qc.invalidateQueries({ queryKey: inboxKeys.settings }),
  });
}

export function useChatStatus(profileId: string) {
  return useQuery({ queryKey: inboxKeys.status(profileId), queryFn: () => apiClient.chatStatus(profileId), enabled: !!profileId });
}

export function useMessageSearch(q: string) {
  const query = q.trim();
  return useQuery({ queryKey: inboxKeys.search(query), queryFn: () => apiClient.searchMyMessages(query), enabled: query.length >= 2 });
}

export function useInboxFlags(enabled = true) {
  return useQuery({ queryKey: inboxKeys.flags, queryFn: () => apiClient.inboxFlags(), enabled });
}

export function useSendFile(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, kind, fileName }: { path: string; kind: AttachmentKind; fileName: string }) => apiClient.sendFile(conversationId, path, kind, fileName),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['messages', conversationId] }), qc.invalidateQueries({ queryKey: ['conversations'] })]),
  });
}

export function useAddresses(conversationId: string, enabled = true) {
  return useQuery({ queryKey: inboxKeys.addresses(conversationId), queryFn: () => apiClient.conversationAddresses(conversationId), enabled: enabled && !!conversationId });
}

export function useAddressActions(conversationId: string) {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([qc.invalidateQueries({ queryKey: inboxKeys.addresses(conversationId) }), qc.invalidateQueries({ queryKey: ['messages', conversationId] })]);
  return {
    share: useMutation({ mutationFn: ({ address, note }: { address: string; note?: string }) => apiClient.shareAddress(conversationId, address, note), onSettled: refresh }),
    revoke: useMutation({ mutationFn: () => apiClient.revokeAddress(conversationId), onSettled: refresh }),
  };
}
