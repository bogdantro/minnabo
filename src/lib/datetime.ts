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
