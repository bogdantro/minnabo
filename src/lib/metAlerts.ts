/**
 * Farevarsler for a kommune (Fellesskap, 0108), from MET Norway's MetAlerts – the warnings on yr.no.
 *
 * Asked for the kommune's centre, never the person's position. Like weather.ts there is nothing on the web
 * (browsers can't send the User-Agent MET requires), and any failure simply shows no warning.
 * MET's data is free under CC BY 4.0: the card credits MET.
 */
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { kommuneCentre } from '@/data/kommuner';

const ALERTS = 'https://api.met.no/weatherapi/metalerts/2.0/current.json';
const USER_AGENT = 'MinNabo/1.3 https://minnaboapp.no';
// MET asks clients to cache; warnings change a few times a day at most
const STALE_MS = 30 * 60 * 1000;

export type AlertLevel = 'yellow' | 'orange' | 'red';
export type MetAlert = { title: string; description: string; level: AlertLevel; until?: string };

type Feature = {
  properties?: {
    eventAwarenessName?: string;
    title?: string;
    description?: string;
    awareness_level?: string;
  };
  when?: { interval?: string[] };
};

/** '3; orange; Severe' -> 'orange'. Unknown levels are yellow, the mildest. */
export function levelOf(awareness: string | undefined): AlertLevel {
  const word = (awareness ?? '').split(';')[1]?.trim().toLowerCase();
  return word === 'red' || word === 'orange' ? word : 'yellow';
}

/** The most serious current warning, or null. */
export function pickAlert(features: Feature[]): MetAlert | null {
  const rank: Record<AlertLevel, number> = { yellow: 1, orange: 2, red: 3 };
  const alerts = features
    .map((f) => ({
      title: f.properties?.eventAwarenessName ?? f.properties?.title ?? '',
      description: f.properties?.description ?? '',
      level: levelOf(f.properties?.awareness_level),
      until: f.when?.interval?.[1],
    }))
    .filter((a) => a.title);
  return alerts.sort((a, b) => rank[b.level] - rank[a.level])[0] ?? null;
}

export async function fetchMetAlert(municipality: string): Promise<MetAlert | null> {
  if (Platform.OS === 'web') return null;
  const centre = kommuneCentre(municipality);
  if (!centre) return null;
  try {
    const res = await fetch(`${ALERTS}?lat=${centre[0].toFixed(4)}&lon=${centre[1].toFixed(4)}&lang=no`, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;
    const body = (await res.json()) as { features?: Feature[] };
    return pickAlert(body.features ?? []);
  } catch {
    return null;
  }
}

export function useMetAlert(municipality: string | undefined) {
  return useQuery({
    queryKey: ['met-alert', municipality],
    queryFn: () => fetchMetAlert(municipality!),
    enabled: !!municipality,
    staleTime: STALE_MS,
    retry: false,
  });
}
