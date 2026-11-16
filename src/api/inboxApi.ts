import type {
  AttachmentKind,
  ChatSettings,
  ChatSettingsPatch,
  ChatStatus,
  ConversationFlags,
  InboxFlags,
  MessageHit,
  ScheduledMessage,
  SharedAddress,
} from '@/domain/inbox';
import type { CommunityApi } from './communityApi';

/** The Innboks part of the API (migration 0109). ApiClient extends it through CommunityApi's chain. */
export interface InboxApi extends CommunityApi {
  /** Pin, snooze or mute for a while – for me only. */
  setConversationFlags(conversationId: string, flags: ConversationFlags): Promise<void>;
  /** My own text message, within 15 minutes. */
  editMessage(messageId: string, text: string): Promise<void>;
  scheduleMessage(conversationId: string, text: string, sendAt: string): Promise<void>;
  listScheduledMessages(conversationId: string): Promise<ScheduledMessage[]>;
  cancelScheduledMessage(id: string): Promise<void>;
  myChatSettings(): Promise<ChatSettings>;
  setChatSettings(patch: ChatSettingsPatch): Promise<void>;
  chatStatus(profileId: string): Promise<ChatStatus>;
  /** Across all my conversations, voice message transcripts too. */
  searchMyMessages(query: string): Promise<MessageHit[]>;
  inboxFlags(): Promise<InboxFlags>;
  /** A short video or a PDF (`path` in chat-attachments). */
  sendFile(conversationId: string, path: string, kind: AttachmentKind, fileName: string): Promise<void>;
  shareAddress(conversationId: string, address: string, note?: string): Promise<void>;
  revokeAddress(conversationId: string): Promise<void>;
  conversationAddresses(conversationId: string): Promise<SharedAddress[]>;
}
