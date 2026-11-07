import type { NoticeKind, NoticeboardPost } from '@/domain/types';
import type { IconName } from '@/components/ui';
import { colors } from '@/theme/theme';

/** Oppslagstavle kinds in design order, with the `.kp` / `.ci` colours. */
export const NOTICE_KINDS: NoticeKind[] = ['GIVEAWAY', 'LOST_FOUND', 'TOOL_LEND', 'GENERAL'];

/**
 * What people choose between. A dugnad is stored as GENERAL + is_dugnad, so older apps still show
 * it as a normal oppslag; here it is a type of its own.
 */
export type NoticeType = NoticeKind | 'DUGNAD';
export const NOTICE_TYPES: NoticeType[] = ['GIVEAWAY', 'LOST_FOUND', 'TOOL_LEND', 'DUGNAD', 'GENERAL'];
export const noticeType = (p: Pick<NoticeboardPost, 'kind' | 'isDugnad'>): NoticeType => (p.isDugnad ? 'DUGNAD' : p.kind);

export const NOTICE_STYLE: Record<NoticeType, { icon: IconName; bg: string; fg: string }> = {
  GIVEAWAY: { icon: 'gift', bg: colors.okTint, fg: colors.okText },
  LOST_FOUND: { icon: 'key', bg: colors.warnTint, fg: colors.warn },
  TOOL_LEND: { icon: 'montering', bg: colors.lavenderTint, fg: colors.lavender },
  GENERAL: { icon: 'msg', bg: colors.cyanTint, fg: colors.cyanDeep },
  DUGNAD: { icon: 'users', bg: colors.limeTint, fg: colors.limeDeep },
};
