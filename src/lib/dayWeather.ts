/**
 * Today's and the weekend's weather for the Oppdrag tab (0110): «God morgen, Kari – sol i Lillehammer i dag»,
 * outdoor jobs first on a sunny day, and «Fint vær i helgen». MET Locationforecast at the kommune's centre,
 * never the person's position. Phones only (browsers can't send the User-Agent MET needs); any failure = no line.
 */
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { kommuneCentre } from '@/data/kommuner';

const FORECAST = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const USER_AGENT = 'MinNabo/1.3 https://minnaboapp.no';
const STALE_MS = 60 * 60 * 1000;

export type Sky = 'sun' | 'rain' | 'snow' | 'cloud';
export type DayWeather = { today: Sky | null; weekendSun: boolean };

/** Jobs done outdoors: first on a sunny day. */
export const OUTDOOR_SLUGS = ['hage', 'snomaking', 'maling', 'vinduspuss', 'bortkjoring', 'ved', 'flytting', 'transport'];

type Step = { time: string; data: { next_6_hours?: { summary?: { symbol_code?: string } }; next_1_hours?: { summary?: { symbol_code?: string } } } };

/** 'clearsky_day' -> 'sun', 'lightrainshowers_day' -> 'rain', 'heavysnow' -> 'snow'. */
export function skyOf(symbol: string | undefined): Sky | null {
  if (!symbol) return null;
  if (/snow|sleet/.test(symbol)) return 'snow';
  if (/rain|drizzle|thunder/.test(symbol)) return 'rain';
  if (/clearsky|fair/.test(symbol)) return 'sun';
  return 'cloud';
}

// the local date: MET's midday steps (10–13 UTC) fall on the same date in Norway
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The sky around midday on a date, from MET steps. */
function middaySky(steps: Step[], day: Date): Sky | null {
  const key = dayKey(day);
  const noon = steps.find((s) => s.time.startsWith(key) && Number(s.time.slice(11, 13)) >= 10 && Number(s.time.slice(11, 13)) <= 13);
  return skyOf(noon?.data.next_6_hours?.summary?.symbol_code ?? noon?.data.next_1_hours?.summary?.symbol_code);
}

export function weatherFromSteps(steps: Step[], now = new Date()): DayWeather {
  const sat = new Date(now);
  sat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7));
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  return { today: middaySky(steps, now), weekendSun: middaySky(steps, sat) === 'sun' || middaySky(steps, sun) === 'sun' };
}

export async function fetchDayWeather(municipality: string): Promise<DayWeather | null> {
  if (Platform.OS === 'web') return null;
  const c = kommuneCentre(municipality);
  if (!c) return null;
  try {
    const res = await fetch(`${FORECAST}?lat=${c[0].toFixed(4)}&lon=${c[1].toFixed(4)}`, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;
    const body = (await res.json()) as { properties?: { timeseries?: Step[] } };
    return weatherFromSteps(body.properties?.timeseries ?? []);
  } catch {
    return null;
  }
}

export function useDayWeather(municipality: string | undefined) {
  return useQuery({ queryKey: ['day-weather', municipality], queryFn: () => fetchDayWeather(municipality!), enabled: !!municipality, staleTime: STALE_MS, retry: false });
}
