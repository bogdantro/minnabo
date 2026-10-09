import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

/**
 * Reads a start time from the free-text agreement time, e.g. "Lør 10. okt kl. 10:00".
 * Uses this year, or next year when the date has already passed. Null when no date is found.
 */
export function parseAgreedTime(textValue: string | undefined, now: Date = new Date()): Date | null {
  const d = /(\d{1,2})\.\s*(jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des)/i.exec(textValue ?? '');
  if (!d) return null;
  const t = /kl\.?\s*(\d{1,2})[:.](\d{2})/i.exec(textValue ?? '');
  const date = new Date(now.getFullYear(), MONTHS.indexOf(d[2].toLowerCase()), Number(d[1]), t ? Number(t[1]) : 10, t ? Number(t[2]) : 0);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date < startOfToday) date.setFullYear(date.getFullYear() + 1);
  return date;
}

/** The agreed day/time: the stored timestamp when there is one, else parsed from the text. */
export function agreedDate(
  x: { scheduledAt?: string; scheduledText?: string } | null | undefined,
  now: Date = new Date(),
): Date | null {
  if (x?.scheduledAt) {
    const d = new Date(x.scheduledAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return parseAgreedTime(x?.scheduledText, now);
}

/** "ca. 5 t", "2–3 timer", "Omtrent en dag" → hours (default 2). */
export function parseDurationHours(textValue: string | undefined): number {
  const m = /(\d+(?:[.,]\d+)?)\s*(?:[–-]\s*\d+\s*)?(?:t\b|timer|time)/i.exec(textValue ?? '');
  if (m) return Number(m[1].replace(',', '.'));
  if (/dag/i.test(textValue ?? '')) return 8;
  return 2;
}

/** Whole days from today to `date` (0 = today). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

export const deviceCalendarSupported = Platform.OS === 'ios' || Platform.OS === 'android';

async function writableCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    const cal = await Calendar.getDefaultCalendarAsync();
    return cal.id;
  }
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const pick = cals.find((c) => c.allowsModifications && c.isPrimary) ?? cals.find((c) => c.allowsModifications);
  return pick?.id ?? null;
}

export type CalendarResult = { ok: true; eventId: string } | { ok: false; reason: 'denied' | 'unsupported' | 'failed' };

/** Adds the agreed job to the device calendar (asks for permission the first time). */
export async function addAgreementToCalendar(input: {
  title: string;
  start: Date;
  hours: number;
  location?: string;
  notes?: string;
}): Promise<CalendarResult> {
  if (!deviceCalendarSupported) return { ok: false, reason: 'unsupported' };
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'denied' };
    const calendarId = await writableCalendarId();
    if (!calendarId) return { ok: false, reason: 'failed' };
    const end = new Date(input.start.getTime() + input.hours * 3_600_000);
    const eventId = await Calendar.createEventAsync(calendarId, {
      title: input.title,
      startDate: input.start,
      endDate: end,
      location: input.location,
      notes: input.notes,
    });
    return { ok: true, eventId };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export async function removeCalendarEvent(eventId: string): Promise<void> {
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    /* already gone */
  }
}
