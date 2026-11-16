/**
 * The Innboks part of the in-memory client (0109). MockApiClient extends it.
 * Follows the database: edits only on my own text within 15 minutes, five pinned chats, an address only
 * with an avtale, PDFs only.
 */
import { UserError } from '@/lib/errors';
import type { InboxApi } from '@/api/inboxApi';
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
import { EDIT_WINDOW_MS } from '@/domain/inbox';
import { chatRepository } from '@mocks/data/chatRepository';
import { MockCommunity } from './mockCommunity';

let seq = 0;
const id = (p: string) => `${p}-${Date.now()}-${seq++}`;
const me = () => chatRepository.currentUserId;

function fresh() {
  return {
    flags: {} as Record<string, { pinnedAt?: string; snoozedUntil?: string; mutedUntil?: string }>,
    scheduled: [] as ScheduledMessage[],
    settings: { awayUntil: null, awayMessage: null, readReceipts: true, hideOnline: false, autoArchive: true } as ChatSettings,
    status: {} as Record<string, ChatStatus>,
    addresses: {} as Record<string, SharedAddress[]>,
  };
}

export const inbox = {
  ...fresh(),
  _reset() {
    Object.assign(inbox, fresh());
  },
};

export class MockInbox extends MockCommunity implements InboxApi {
  async setConversationFlags(conversationId: string, flags: ConversationFlags): Promise<void> {
    const cur = { ...(inbox.flags[conversationId] ?? {}) };
    if (flags.pinned === true) {
      const pinned = Object.entries(inbox.flags).filter(([k, v]) => k !== conversationId && v.pinnedAt).length;
      if (pinned >= 5) throw new UserError('Du kan feste 5 samtaler. Løsne en først.');
      cur.pinnedAt = new Date().toISOString();
    }
    if (flags.pinned === false) delete cur.pinnedAt;
    if (flags.snoozeUntil !== undefined) cur.snoozedUntil = flags.snoozeUntil ?? undefined;
    if (flags.mutedUntil !== undefined) cur.mutedUntil = flags.mutedUntil ?? undefined;
    inbox.flags[conversationId] = cur;
  }

  async editMessage(messageId: string, text: string): Promise<void> {
    const m = chatRepository.allMessages().find((x) => x.id === messageId);
    if (!m || m.authorProfileId !== me()) throw new UserError('Fant ikke meldingen.');
    if (m.kind !== 'TEXT' || m.deletedAt || m.attachmentKind) throw new UserError('Denne meldingen kan ikke endres.');
    if (Date.now() - Date.parse(m.createdAt) > EDIT_WINDOW_MS) throw new UserError('Meldinger kan bare endres de første 15 minuttene.');
    if (!text.trim()) throw new UserError('Skriv noe, eller slett meldingen.');
    chatRepository._patchMessage(m.conversationId, messageId, { text: text.trim(), editedAt: new Date().toISOString() });
  }

  async scheduleMessage(conversationId: string, text: string, sendAt: string): Promise<void> {
    const at = Date.parse(sendAt);
    if (at < Date.now() + 60_000 || at > Date.now() + 14 * 86_400_000) throw new UserError('Velg et tidspunkt fra om et minutt til om 14 dager.');
    inbox.scheduled.push({ id: id('sm'), conversationId, text: text.trim(), sendAt });
  }

  async listScheduledMessages(conversationId: string): Promise<ScheduledMessage[]> {
    return inbox.scheduled.filter((s) => s.conversationId === conversationId).sort((a, b) => Date.parse(a.sendAt) - Date.parse(b.sendAt));
  }

  async cancelScheduledMessage(scheduledId: string): Promise<void> {
    inbox.scheduled = inbox.scheduled.filter((s) => s.id !== scheduledId);
  }

  async myChatSettings(): Promise<ChatSettings> {
    return { ...inbox.settings };
  }

  async setChatSettings(patch: ChatSettingsPatch): Promise<void> {
    const s = inbox.settings;
    inbox.settings = {
      awayUntil: patch.clearAway ? null : (patch.awayUntil ?? s.awayUntil),
      awayMessage: patch.clearAway ? null : (patch.awayMessage ?? s.awayMessage),
      readReceipts: patch.readReceipts ?? s.readReceipts,
      hideOnline: patch.hideOnline ?? s.hideOnline,
      autoArchive: patch.autoArchive ?? s.autoArchive,
    };
  }

  async chatStatus(profileId: string): Promise<ChatStatus> {
    return inbox.status[profileId] ?? { awayUntil: null, hideOnline: false, readReceipts: true };
  }

  async searchMyMessages(query: string): Promise<MessageHit[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return chatRepository
      .allMessages()
      .filter((m) => !m.deletedAt && (m.text.toLowerCase().includes(q) || (m.transcript ?? '').toLowerCase().includes(q)))
      .map((m) => ({
        messageId: m.id,
        conversationId: m.conversationId,
        authorId: m.authorProfileId,
        createdAt: m.createdAt,
        text: m.text.toLowerCase().includes(q) ? m.text : (m.transcript ?? ''),
        kind: m.kind,
      }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 50);
  }

  async inboxFlags(): Promise<InboxFlags> {
    const all = chatRepository.allMessages();
    return {
      written: [...new Set(all.filter((m) => m.authorProfileId === me()).map((m) => m.conversationId))],
      media: [...new Set(all.filter((m) => !m.deletedAt && (m.kind === 'IMAGE' || m.attachmentKind === 'VIDEO')).map((m) => m.conversationId))],
    };
  }

  async sendFile(conversationId: string, path: string, kind: AttachmentKind, fileName: string): Promise<void> {
    if (kind === 'FILE' && !/\.pdf$/i.test(fileName)) throw new UserError('Bare PDF-filer kan sendes.');
    const text = kind === 'VIDEO' ? '🎬 Video' : `📄 ${fileName}`;
    chatRepository._addMine(conversationId, { text, attachmentKind: kind, attachmentUrl: path, fileName }, text);
  }

  async shareAddress(conversationId: string, address: string, note?: string): Promise<void> {
    if (!chatRepository.getAgreementForConversation(conversationId)) throw new UserError('Del adressen først når dere har en avtale.');
    inbox.addresses[conversationId] = [
      ...(inbox.addresses[conversationId] ?? []).filter((a) => a.fromId !== me()),
      { id: id('ad'), fromId: me(), address: address.trim(), note: note?.trim() || undefined, createdAt: new Date().toISOString() },
    ];
    chatRepository.addSystemMessage(conversationId, 'Du delte adressen din');
  }

  async revokeAddress(conversationId: string): Promise<void> {
    inbox.addresses[conversationId] = (inbox.addresses[conversationId] ?? []).filter((a) => a.fromId !== me());
    chatRepository.addSystemMessage(conversationId, 'Du trakk tilbake adressen');
  }

  async conversationAddresses(conversationId: string): Promise<SharedAddress[]> {
    return chatRepository.getAgreementForConversation(conversationId) ? [...(inbox.addresses[conversationId] ?? [])] : [];
  }
}
