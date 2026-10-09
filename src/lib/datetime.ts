const WEEKDAYS = ['Søn.', 'Man.', 'Tirs.', 'Ons.', 'Tors.', 'Fre.', 'Lør.'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** "12:42" */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Relative label for conversation lists:
 * today -> "12:42", yesterday -> "I går", this week -> "Tirs.", older -> "24.08".
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000,
  );
  if (days <= 0) return formatTime(iso);
  if (days === 1) return 'I går';
  if (days < 7) return WEEKDAYS[d.getDay()];
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * "for 20 min siden", "for 3 t siden", "i går", "for 4 dager siden" (cards).
 * `long`: "for 20 minutter siden", "for 3 timer siden" (detail info grid).
 */
export function postedAgo(iso: string, now: Date = new Date(), long = false): string {
  const min = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (min < 1) return 'akkurat nå';
  if (min < 60) return long ? `for ${min} ${min === 1 ? 'minutt' : 'minutter'} siden` : `for ${min} min siden`;
  const h = Math.floor(min / 60);
  if (h < 24) return long ? `for ${h} ${h === 1 ? 'time' : 'timer'} siden` : `for ${h} t siden`;
  const days = Math.round((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / 86_400_000);
  if (days <= 1) return 'i går';
  return `for ${days} dager siden`;
}

const DAYS_SHORT = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

const MONTHS_LONG = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

/** "12. mars 2024" */
/** Median reply time as "20 min" / "1 t" / "2 dager" (long: "1 time", "3 timer"). */
export function replyTime(minutes: number, long = false): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes / 5) * 5)} min`;
  const h = Math.round(minutes / 60);
  if (h < 24) return long ? `${h} ${h === 1 ? 'time' : 'timer'}` : `${h} t`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? 'dag' : 'dager'}`;
}

export function longDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "mars 2023" */
export function monthYear(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "14. sep" */
export function dayMonth(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "12. sep 2026" */
export function dayMonthYear(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Fre 25. sep" */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;
}

/** 0 = today, 1 = yesterday, 2+ = older (calendar days). */
export function daysAgo(iso: string, now: Date = new Date()): number {
  return Math.round((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / 86_400_000);
}

/**
 * Best-effort day from free text like "Lør 10. okt kl. 10:00" (proposal times are free text).
 * Returns a sortable number (month * 100 + day), or null when no date is found.
 */
export function dayKey(textValue: string | undefined): number | null {
  const m = /(\d{1,2})\.\s*(jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des)/i.exec(textValue ?? '');
  if (!m) return null;
  return (MONTHS_SHORT.indexOf(m[2].toLowerCase()) + 1) * 100 + Number(m[1]);
}
