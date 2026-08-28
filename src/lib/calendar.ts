export const MONTHS_NB = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
];

export const WEEKDAYS_SHORT_NB = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'];

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** "29. august 2026" */
export function formatLongDate(d: Date): string {
  return `${d.getDate()}. ${MONTHS_NB[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Tors. 29. august" style, with I dag / I morgen prefixes. */
export function formatFriendlyDate(d: Date, now: Date = new Date()): string {
  if (isSameDay(d, now)) return `I dag, ${formatLongDate(d)}`;
  if (isSameDay(d, addDays(now, 1))) return `I morgen, ${formatLongDate(d)}`;
  return formatLongDate(d);
}

/**
 * 6 rows × 7 days for a month grid, Monday-first. Cells outside the month are
 * still real Dates (previous/next month) so they can be rendered dimmed.
 */
export function monthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Mon = 0
  const gridStart = new Date(year, month, 1 - offset);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7 + d));
    }
    weeks.push(row);
  }
  return weeks;
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

const WEEKDAYS_LONG_NB = [
  'søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag',
];

/** Chat day-separator label: "I dag", "I går", "torsdag", or "29. august 2026". */
export function formatDayLabel(d: Date, now: Date = new Date()): string {
  if (isSameDay(d, now)) return 'I dag';
  if (isSameDay(d, addDays(now, -1))) return 'I går';
  const weekAgo = addDays(startOfDay(now), -6);
  if (startOfDay(d) >= weekAgo) return WEEKDAYS_LONG_NB[d.getDay()];
  return formatLongDate(d);
}
