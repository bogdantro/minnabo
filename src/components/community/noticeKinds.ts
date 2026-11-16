import type { EventType, NoticeKind, NoticeboardPost } from '@/domain/types';
import type { NoticeTopic } from '@/domain/community';
import type { IconName } from '@/components/ui';
import { colors } from '@/theme/theme';

/** Oppslagstavle kinds in design order, with the `.kp` / `.ci` colours. */
export const NOTICE_KINDS: NoticeKind[] = ['GIVEAWAY', 'LOST_FOUND', 'TOOL_LEND', 'GENERAL'];

/**
 * What people choose between. An arrangement (a dugnad, loppemarked, quiz …) is stored as GENERAL +
 * event_type (and is_dugnad for a dugnad), so older apps still show it as a normal oppslag (0090, 0101).
 */
export type NoticeType = NoticeKind | 'EVENT';
export const NOTICE_TYPES: NoticeType[] = ['GIVEAWAY', 'LOST_FOUND', 'TOOL_LEND', 'EVENT', 'GENERAL'];
export const noticeType = (p: Pick<NoticeboardPost, 'kind' | 'isDugnad' | 'eventType'>): NoticeType =>
  p.isDugnad || p.eventType ? 'EVENT' : p.kind;

/** The kinds of arrangement, dugnad first; each with its own icon on the card and in the calendar. */
export const EVENT_TYPES: EventType[] = ['DUGNAD', 'LOPPEMARKED', 'QUIZ', 'FEST', 'MOTE', 'TUR', 'ANNET'];
export const EVENT_ICON: Record<EventType, IconName> = {
  DUGNAD: 'users',
  LOPPEMARKED: 'tag',
  QUIZ: 'sparkle',
  FEST: 'arrangement',
  MOTE: 'msg',
  TUR: 'nav',
  ANNET: 'cal',
};
/** Each kind of arrangement has its own flat colour on «Skjer i nærheten» (the base design's tints). */
export const EVENT_STYLE: Record<EventType, { bg: string; fg: string }> = {
  DUGNAD: { bg: colors.limeTint, fg: colors.limeDeep },
  LOPPEMARKED: { bg: colors.warnTint, fg: colors.warn },
  QUIZ: { bg: colors.lavenderTint, fg: colors.lavender },
  FEST: { bg: colors.savedBg, fg: colors.heart },
  MOTE: { bg: colors.cyanTint, fg: colors.cyanDeep },
  TUR: { bg: colors.okTint, fg: colors.okText },
  ANNET: { bg: colors.surface2, fg: colors.ink2 },
};
export const eventTypeOf = (p: Pick<NoticeboardPost, 'isDugnad' | 'eventType'>): EventType | null =>
  p.eventType ?? (p.isDugnad ? 'DUGNAD' : null);

export const NOTICE_STYLE: Record<NoticeType, { icon: IconName; bg: string; fg: string }> = {
  GIVEAWAY: { icon: 'gift', bg: colors.okTint, fg: colors.okText },
  LOST_FOUND: { icon: 'key', bg: colors.warnTint, fg: colors.warn },
  TOOL_LEND: { icon: 'montering', bg: colors.lavenderTint, fg: colors.lavender },
  GENERAL: { icon: 'msg', bg: colors.cyanTint, fg: colors.cyanDeep },
  EVENT: { icon: 'arrangement', bg: colors.limeTint, fg: colors.limeDeep },
};

/** The newer kinds of oppslag (0108): each has its own icon and flat colour. */
export const TOPIC_STYLE: Record<NoticeTopic, { icon: IconName; bg: string; fg: string }> = {
  WANT_BORROW: { icon: 'hand', bg: colors.lavenderTint, fg: colors.lavender },
  SWAP: { icon: 'repeat', bg: colors.cyanTint, fg: colors.cyanDeep },
  FOOD: { icon: 'matlaging', bg: colors.warnTint, fg: colors.warn },
  HARVEST: { icon: 'hage', bg: colors.okTint, fg: colors.okText },
  PET: { icon: 'dyrepass', bg: colors.dangerTint, fg: colors.danger },
  RIDE: { icon: 'transport', bg: colors.cyanTint, fg: colors.cyanDeep },
  RECOMMEND: { icon: 'thumb', bg: colors.limeTint, fg: colors.limeDeep },
  OUTAGE: { icon: 'zap', bg: colors.warnTint, fg: colors.warn },
};

/** The icon and colour an oppslag shows: its topic first, else its type. */
export const noticeLook = (p: Pick<NoticeboardPost, 'kind' | 'isDugnad' | 'eventType' | 'topic'>) =>
  p.topic ? TOPIC_STYLE[p.topic] : NOTICE_STYLE[noticeType(p)];
