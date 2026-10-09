/**
 * Device location → kommune. Coarse, one-shot, foreground only. The raw
 * coordinate never leaves this module — callers get a kommune name.
 */
import { Platform } from 'react-native';
import nb from '@/i18n/nb';
import { isLaunchKommune, nearestKommune, resolveKommune } from '@/data/kommuner';
import { reportError } from './reporting';

/**
 * Why it failed, so the person is told what to do:
 *   denied      – said no to the question just now
 *   blocked     – said no earlier; iOS never asks twice, it must be changed in Innstillinger
 *   outside     – we know where the phone is, but it is not in one of the launch kommuner
 *   unavailable – no position (location services off, no signal, timed out)
 */
export type LocationError = 'denied' | 'blocked' | 'outside' | 'unavailable';

export type DetectResult = { municipality: string; place?: string } | { error: LocationError };

/** A fresh fix can take a long time indoors (iOS especially) – don't leave the spinner running. */
const FIX_TIMEOUT_MS = 12_000;
/** A position this recent is as good as a new one for picking a kommune. */
const LAST_KNOWN_MAX_AGE_MS = 15 * 60_000;

type Coords = { latitude: number; longitude: number };

async function currentCoords(Location: typeof import('expo-location')): Promise<Coords | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS));
  const fresh = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    .then((p) => p.coords as Coords)
    .catch(() => null);
  const coords = await Promise.race([fresh, timeout]);
  if (coords) return coords;
  // No new fix: the phone's last known position is fine for choosing a kommune.
  const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null);
  return last ? (last.coords as Coords) : null;
}

export async function detectKommune(): Promise<DetectResult> {
  try {
    // Loaded lazily so screens that never ask for location don't pull in the
    // native module. `require` rather than `await import` — Jest's CJS VM
    // rejects a dynamic import() callback, and Metro resolves this inline require
    // the same way. The cast keeps the call sites type-checked.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Location = require('expo-location') as typeof import('expo-location');

    const current = await Location.getForegroundPermissionsAsync();
    if (!current.granted) {
      if (current.canAskAgain === false) return { error: 'blocked' };
      const asked = await Location.requestForegroundPermissionsAsync();
      if (!asked.granted) return { error: 'denied' };
    }

    const coords = await currentCoords(Location);
    if (!coords) return { error: 'unavailable' };
    const { latitude, longitude } = coords;

    // Native reverse geocoding (iOS/Android). Not available on web since SDK 49,
    // and it can fail offline – then fall back to the nearest kommune centre.
    if (Platform.OS !== 'web') {
      try {
        const hit = (await Location.reverseGeocodeAsync({ latitude, longitude }))[0];
        const municipality = hit ? resolveKommune(hit.subregion || hit.city || hit.region || '') : undefined;
        if (municipality) {
          if (!isLaunchKommune(municipality)) return { error: 'outside' };
          return { municipality, place: hit?.city || hit?.district || undefined };
        }
      } catch {
        /* fall through to the offline lookup */
      }
    }
    const nearest = nearestKommune(latitude, longitude);
    return isLaunchKommune(nearest) ? { municipality: nearest! } : { error: 'outside' };
  } catch (e) {
    reportError(e, { where: 'detectKommune' });
    return { error: 'unavailable' };
  }
}

/** What to tell the person for each way "Bruk posisjonen min" can fail. */
export function locationErrorText(error: LocationError): string {
  switch (error) {
    case 'denied':
    case 'blocked':
      return nb.location.permissionDenied;
    case 'outside':
      return nb.location.outsideArea;
    default:
      return nb.location.locationUnavailable;
  }
}
