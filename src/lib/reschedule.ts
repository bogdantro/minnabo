import { shortDate, formatTime } from './datetime';

export type RescheduleSuggestion = { label: string; when: string; iso: string };

/**
 * One-tap new times for «Nytt tidspunkt», keeping the agreed time of day:
 * Fri 14:00 → «I morgen samme tid», «Om to dager samme tid», «Samme tid neste uke».
 * Suggestions in the past are left out; no agreed time → none.
 */
export function rescheduleSuggestions(currentIso: string | undefined, now: Date): RescheduleSuggestion[] {
  if (!currentIso) return [];
  const cur = new Date(currentIso);
  if (Number.isNaN(cur.getTime())) return [];
  // "i morgen" is counted from today, or from the agreed day if that is still ahead
  const base = cur.getTime() > now.getTime() ? cur : new Date(now.getFullYear(), now.getMonth(), now.getDate(), cur.getHours(), cur.getMinutes());
  const plus = (days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  };
  const out: [string, Date][] = [
    ['I morgen samme tid', plus(1)],
    ['Om to dager samme tid', plus(2)],
    ['Samme tid neste uke', plus(7)],
  ];
  return out
    .filter(([, d]) => d.getTime() > now.getTime())
    .map(([label, d]) => ({ label, when: `${shortDate(d.toISOString())} kl. ${formatTime(d.toISOString())}`, iso: d.toISOString() }));
}
