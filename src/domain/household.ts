/** Husstand (0101, redesigned with 0105): pure helpers for the screen, so they are easy to test. */
import type { Household, HouseholdWho } from './types';

export const HOUSEHOLD_CODE_LEN = 6;

export type HouseholdAgreement = Household['agreements'][number];
export type WhoFilter = 'all' | 'me' | 'partner';
export type HouseholdDay = { key: string; label: string; items: HouseholdAgreement[] };

/** ' k7p 2-qx ' -> 'K7P2QX'. Only letters and digits, at most six. */
export function cleanCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, HOUSEHOLD_CODE_LEN);
}

/** Days left on an invitation, rounded: a fresh code says 7, one that runs out in a few hours says 0. */
export function codeDaysLeft(expiresAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000));
}

/** Before 0105 every row was the partner's, so a row without `who` is theirs. */
export function whoOf(a: HouseholdAgreement): HouseholdWho {
  return a.who ?? 'partner';
}

/** «Mine» shows mine and ours, «Emma sine» hers and ours. */
export function filterWho(list: HouseholdAgreement[], filter: WhoFilter): HouseholdAgreement[] {
  if (filter === 'all') return list;
  return list.filter((a) => whoOf(a) === filter || whoOf(a) === 'both');
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * «Hvem kommer når»: the avtaler by day, in time order. Labels: 'I dag', 'I morgen', then `dateLabel`;
 * the ones without a fixed time come last under `noTimeLabel`.
 */
export function householdDays(
  list: HouseholdAgreement[],
  labels: { today: string; tomorrow: string; noTime: string; date: (iso: string) => string },
  now: Date = new Date(),
): HouseholdDay[] {
  const today = startOfDay(now).getTime();
  const timed = list.filter((a) => a.scheduledAt).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
  const days: HouseholdDay[] = [];
  for (const a of timed) {
    const day = startOfDay(new Date(a.scheduledAt!));
    const key = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
    const diff = Math.round((day.getTime() - today) / 86_400_000);
    const label = diff <= 0 ? labels.today : diff === 1 ? labels.tomorrow : labels.date(a.scheduledAt!);
    const last = days[days.length - 1];
    if (last?.key === key) last.items.push(a);
    else days.push({ key, label, items: [a] });
  }
  const loose = list.filter((a) => !a.scheduledAt);
  if (loose.length) days.push({ key: 'no-time', label: labels.noTime, items: loose });
  return days;
}
