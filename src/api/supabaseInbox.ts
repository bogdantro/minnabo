import { supabase } from '@/lib/supabase';
import { backendError } from '@/lib/errors';
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
import type { InboxApi } from './inboxApi';
import { SupabaseCommunity } from './supabaseCommunity';

/** The Innboks part of the Supabase client (0109). SupabaseApiClient extends it. */

function fail(err: { message?: string; code?: string } | string | null | undefined): never {
  throw backendError(err ?? undefined);
}

async function myId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) fail('Ikke innlogget.');
  return data.user.id;
}

const DEFAULT_SETTINGS: ChatSettings = { awayUntil: null, awayMessage: null, readReceipts: true, hideOnline: false, autoArchive: true };

export class SupabaseInbox extends SupabaseCommunity implements InboxApi {
  async setConversationFlags(conversationId: string, flags: ConversationFlags): Promise<void> {
    const { error } = await supabase.rpc('set_conversation_flags', {
      p_conversation: conversationId,
      p_pinned: flags.pinned ?? null,
      p_snooze_until: flags.snoozeUntil ?? null,
      p_clear_snooze: flags.snoozeUntil === null,
      p_muted_until: flags.mutedUntil ?? null,
      p_clear_mute: flags.mutedUntil === null,
    });
    if (error) fail(error);
  }

  async editMessage(messageId: string, text: string): Promise<void> {
    const { error } = await supabase.rpc('edit_message', { p_message: messageId, p_text: text });
    if (error) fail(error);
  }

  async scheduleMessage(conversationId: string, text: string, sendAt: string): Promise<void> {
    const { error } = await supabase.rpc('schedule_message', { p_conversation: conversationId, p_text: text, p_send_at: sendAt });
    if (error) fail(error);
  }

  async listScheduledMessages(conversationId: string): Promise<ScheduledMessage[]> {
    const { data, error } = await supabase
      .from('scheduled_messages')
      .select('id, conversation_id, text, send_at')
      .eq('conversation_id', conversationId)
      .is('sent_at', null)
      .is('cancelled_at', null)
      .order('send_at');
    if (error) return [];
    return ((data ?? []) as { id: string; conversation_id: string; text: string; send_at: string }[]).map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      text: r.text,
      sendAt: r.send_at,
    }));
  }

  async cancelScheduledMessage(id: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_scheduled_message', { p_id: id });
    if (error) fail(error);
  }

  async myChatSettings(): Promise<ChatSettings> {
    const { data, error } = await supabase.rpc('my_chat_settings');
    if (error || !data) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(data as Partial<ChatSettings>) };
  }

  async setChatSettings(patch: ChatSettingsPatch): Promise<void> {
    const { error } = await supabase.rpc('set_chat_settings', {
      p_away_until: patch.awayUntil ?? null,
      p_away_message: patch.awayMessage ?? null,
      p_clear_away: !!patch.clearAway,
      p_read_receipts: patch.readReceipts ?? null,
      p_hide_online: patch.hideOnline ?? null,
      p_auto_archive: patch.autoArchive ?? null,
    });
    if (error) fail(error);
  }

  async chatStatus(profileId: string): Promise<ChatStatus> {
    const { data, error } = await supabase.rpc('chat_status', { p_profile: profileId });
    if (error || !data) return { awayUntil: null, hideOnline: false, readReceipts: true };
    const d = data as Partial<ChatStatus>;
    return { awayUntil: d.awayUntil ?? null, hideOnline: !!d.hideOnline, readReceipts: d.readReceipts !== false };
  }

  async searchMyMessages(query: string): Promise<MessageHit[]> {
    const { data, error } = await supabase.rpc('search_my_messages', { p_query: query });
    if (error) return [];
    return (data ?? []) as MessageHit[];
  }

  async inboxFlags(): Promise<InboxFlags> {
    const { data, error } = await supabase.rpc('inbox_flags');
    if (error || !data) return { written: [], media: [] };
    const d = data as Partial<InboxFlags>;
    return { written: d.written ?? [], media: d.media ?? [] };
  }

  async sendFile(conversationId: string, path: string, kind: AttachmentKind, fileName: string): Promise<void> {
    const me = await myId();
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      author_id: me,
      kind: 'TEXT',
      // older apps show this line
      text: kind === 'VIDEO' ? '🎬 Video' : `📄 ${fileName}`,
      attachment_path: path,
      attachment_kind: kind,
      file_name: fileName.slice(0, 120),
      client_token: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    });
    if (error) fail(error);
  }

  async shareAddress(conversationId: string, address: string, note?: string): Promise<void> {
    const { error } = await supabase.rpc('share_address', { p_conversation: conversationId, p_address: address, p_note: note ?? null });
    if (error) fail(error);
  }

  async revokeAddress(conversationId: string): Promise<void> {
    const { error } = await supabase.rpc('revoke_address', { p_conversation: conversationId });
    if (error) fail(error);
  }

  async conversationAddresses(conversationId: string): Promise<SharedAddress[]> {
    const { data, error } = await supabase.rpc('conversation_addresses', { p_conversation: conversationId });
    if (error) return [];
    return ((data ?? []) as (SharedAddress & { note: string | null })[]).map((a) => ({ ...a, note: a.note ?? undefined }));
  }
}
