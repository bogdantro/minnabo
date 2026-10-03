import type { NoticeKind } from '@/domain/types';
import type { IconName } from '@/components/ui';
import { colors } from '@/theme/theme';

/** Oppslagstavle kinds in design order, with the `.kp` / `.ci` colours. */
export const NOTICE_KINDS: NoticeKind[] = ['GIVEAWAY', 'LOST_FOUND', 'TOOL_LEND', 'GENERAL'];

export const NOTICE_STYLE: Record<NoticeKind, { icon: IconName; bg: string; fg: string }> = {
  GIVEAWAY: { icon: 'gift', bg: colors.okTint, fg: colors.okText },
  LOST_FOUND: { icon: 'key', bg: colors.warnTint, fg: colors.warn },
  TOOL_LEND: { icon: 'montering', bg: colors.lavenderTint, fg: colors.lavender },
  GENERAL: { icon: 'msg', bg: colors.cyanTint, fg: colors.cyanDeep },
};
