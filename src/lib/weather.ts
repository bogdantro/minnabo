/**
 * Real weather for the job day (asked 2026-11-09), from MET Norway's Locationforecast – the forecast behind yr.no.
 *
 * Asked for the kommune's centre, never the person's own position, and only for outdoor jobs within the next
 * 9 days (as far as the forecast goes). On the web there is no warning: browsers can't send the User-Agent MET
 * requires. Any failure means no warning, never an error on screen.
 *
 * MET's data is free under CC BY 4.0: the note that shows a warning credits MET.
 */
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { kommuneCentre } from '@/data/kommuner';
import type { CategoryId } from '@/theme/theme';

const FORECAST = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
// MET requires an identifying User-Agent: https://api.met.no/doc/TermsOfService
const USER_AGENT = 'MinNabo/1.2 https://minnaboapp.no';

/** Jobs that happen outside, where the weather decides the day. */
const OUTDOOR = new Set<CategoryId>(['hage', 'snomaking', 'maling', 'transport', 'flytting', 'vinduspuss', 'bortkjoring', 'ved']);
/** Rain in the working hours (mm) that is worth a word. */
const RAIN_MM = 3;
/** Mean wind (m/s): «frisk bris» and up makes ladders and painting unpleasant. */
const WIND_MS = 10;
/** At or below this (°C) the precipitation is snow. */
const SNOW_TEMP = 0.5;
const WORK_HOURS = [8, 18];
const FORECAST_DAYS = 9;

export type OutdoorWarning = { kind: 'RAIN' | 'WIND' | 'SNOW' } | null;

type Step = { time: string; data: { instant: { details: { air_temperature?: number; wind_speed?: number } }; next_1_hours?: { details?: { precipitation_amount?: number } } } };

/** What the forecast says about the working hours of one day. Pure, so it can be tested. */
export function warningFromForecast(steps: Step[], day: Date): OutdoorWarning {
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  let rain = 0;
  let snow = 0;
  let wind = 0;
  let seen = 0;
  for (const s of steps) {
    const t = new Date(s.time);
    if (t.getFullYear() !== y || t.getMonth() !== m || t.getDate() !== d) continue;
    if (t.getHours() < WORK_HOURS[0] || t.getHours() >= WORK_HOURS[1]) continue;
    seen++;
    const mm = s.data.next_1_hours?.details?.precipitation_amount ?? 0;
    const temp = s.data.instant.details.air_temperature ?? 10;
    if (temp <= SNOW_TEMP) snow += mm;
    else rain += mm;
    wind = Math.max(wind, s.data.instant.details.wind_speed ?? 0);
  }
  // further ahead MET only has 6-hour steps without next_1_hours: then there is nothing to judge
  if (!seen) return null;
  if (snow >= RAIN_MM) return { kind: 'SNOW' };
  if (rain >= RAIN_MM) return { kind: 'RAIN' };
  if (wind >= WIND_MS) return { kind: 'WIND' };
  return null;
}

export async function fetchOutdoorWarning(category: CategoryId, dateISO: string, municipality: string): Promise<OutdoorWarning> {
  if (Platform.OS === 'web' || !OUTDOOR.has(category)) return null;
  const day = new Date(dateISO);
  const days = (day.getTime() - Date.now()) / 86_400_000;
  if (Number.isNaN(days) || days < -1 || days > FORECAST_DAYS) return null;
  const centre = kommuneCentre(municipality);
  if (!centre) return null;
  try {
    // MET asks for at most 4 decimals
    const res = await fetch(`${FORECAST}?lat=${centre[0].toFixed(4)}&lon=${centre[1].toFixed(4)}`, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;
    const body = (await res.json()) as { properties?: { timeseries?: Step[] } };
    return warningFromForecast(body.properties?.timeseries ?? [], day);
  } catch {
    return null;
  }
}

/** The warning for one job day; cached for an hour, as MET asks. */
export function useOutdoorWarning(category: CategoryId | undefined, dateISO: string | undefined, municipality: string | undefined) {
  return useQuery({
    queryKey: ['outdoor-weather', category, dateISO?.slice(0, 10), municipality],
    queryFn: () => fetchOutdoorWarning(category!, dateISO!, municipality!),
    enabled: !!category && !!dateISO && !!municipality,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}
