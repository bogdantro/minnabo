/** Innboks types added with migration 0109 (docs/IDEAS.md part 3). */

export type ConversationFlags = {
  /** true / false to pin or unpin; leave out to keep */
  pinned?: boolean;
  /** ISO; null ends the snooze */
  snoozeUntil?: string | null;
  /** ISO; null ends a timed mute */
  mutedUntil?: string | null;
};

export type ScheduledMessage = { id: string; conversationId: string; text: string; sendAt: string };

export type ChatSettings = {
  /** YYYY-MM-DD, the last day I am away */
  awayUntil: string | null;
  awayMessage: string | null;
  readReceipts: boolean;
  hideOnline: boolean;
  autoArchive: boolean;
};

export type ChatSettingsPatch = {
  awayUntil?: string;
  awayMessage?: string;
  clearAway?: boolean;
  readReceipts?: boolean;
  hideOnline?: boolean;
  autoArchive?: boolean;
};

/** What others may know about my chat: away until, and whether I hide «aktiv nå». */
export type ChatStatus = { awayUntil: string | null; hideOnline: boolean; readReceipts: boolean };

export type MessageHit = { messageId: string; conversationId: string; authorId: string; createdAt: string; text: string; kind: string };

/** Conversations I have written in, and the ones with photos or videos. */
export type InboxFlags = { written: string[]; media: string[] };

export type SharedAddress = { id: string; fromId: string; address: string; note?: string; createdAt: string };

export type AttachmentKind = 'VIDEO' | 'FILE';

/** How long a video in the chat may be. */
export const MAX_VIDEO_SECONDS = 15;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
/** Deleting has the same 15 minutes as editing, so one rule covers fixing a slip (0110; the server checks too). */
export const DELETE_WINDOW_MS = EDIT_WINDOW_MS;

type Fixable = { createdAt: string; kind: string; deletedAt?: string | null; pending?: boolean; attachmentKind?: string | null };

/** My own message, not deleted or still sending, within 15 minutes. */
export function canDeleteMessage(m: Fixable, mine: boolean, now = Date.now()): boolean {
  return mine && !m.deletedAt && !m.pending && now - Date.parse(m.createdAt) < DELETE_WINDOW_MS;
}

/** As deleting, and only plain text (a photo, voice message, video or PDF can't be edited). */
export function canEditMessage(m: Fixable, mine: boolean, now = Date.now()): boolean {
  return m.kind === 'TEXT' && !m.attachmentKind && mine && !m.deletedAt && !m.pending && now - Date.parse(m.createdAt) < EDIT_WINDOW_MS;
}
