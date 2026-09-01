/**
 * A stand-in outdoor-weather check. A real build would call MET Norway's
 * Locationforecast API; here we derive a stable pseudo-forecast from the date
 * so the warning is deterministic and only fires for outdoor categories on
 * days within the next week.
 */
const OUTDOOR = new Set(['hage', 'snomaking', 'maling', 'transport', 'flytting']);

export type OutdoorWarning = { kind: 'RAIN' | 'WIND' | 'SNOW' } | null;

export function outdoorWarningFor(categorySlug: string, dateISO: string | undefined): OutdoorWarning {
  if (!dateISO || !OUTDOOR.has(categorySlug)) return null;
  const when = new Date(dateISO);
  if (Number.isNaN(when.getTime())) return null;

  const days = Math.round((when.getTime() - Date.now()) / 86_400_000);
  if (days < 0 || days > 7) return null; // outside the forecast window

  const seed = when.getFullYear() * 372 + (when.getMonth() + 1) * 31 + when.getDate();
  const roll = seed % 10;
  if (roll < 3) return { kind: 'RAIN' };
  if (roll === 3) return { kind: 'WIND' };
  if (roll === 4 && (when.getMonth() < 2 || when.getMonth() > 9)) return { kind: 'SNOW' };
  return null;
}
