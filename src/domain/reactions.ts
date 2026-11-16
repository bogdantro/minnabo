/** The five reactions, the same on Oppslagstavla and in chat (2026-11-13). */
import type { NoticeReactionEmoji } from './types';

export const REACTIONS: NoticeReactionEmoji[] = ['👍', '😂', '😮', '🙏', '🎉'];

/**
 * A message's reactions as chips: the five in their usual order first, then anything older
 * (❤️, 😊, ✅ from before 2026-11-13) so nobody's reaction disappears.
 */
export function reactionChips(reactions: Record<string, string[]> | undefined, meId: string): { emoji: string; n: number; on: boolean }[] {
  const entries = Object.entries(reactions ?? {}).filter(([, ids]) => ids.length);
  const rank = (e: string) => {
    const i = (REACTIONS as string[]).indexOf(e);
    return i < 0 ? REACTIONS.length : i;
  };
  return entries.sort(([a], [b]) => rank(a) - rank(b)).map(([emoji, ids]) => ({ emoji, n: ids.length, on: ids.includes(meId) }));
}
