/**
 * Device location → kommune. Coarse, one-shot, foreground only. The raw
 * coordinate never leaves this module — callers get a kommune name.
 */
import { Platform } from 'react-native';
import { nearestKommune, resolveKommune } from '@/data/kommuner';

export type DetectResult =
  | { municipality: string; place?: string }
  | { error: 'denied' | 'unavailable' };

export async function detectKommune(): Promise<DetectResult> {
  try {
    // Loaded lazily so screens that never ask for location don't pull in the
    // native module. `require` rather than `await import` — Jest's CJS VM
    // rejects a dynamic import() callback, and Metro resolves this inline require
    // the same way. The cast keeps the call sites type-checked.
    const Location = require('expo-location') as typeof import('expo-location');

    let granted = (await Location.getForegroundPermissionsAsync()).granted;
    if (!granted) {
      granted = (await Location.requestForegroundPermissionsAsync()).granted;
    }
    if (!granted) return { error: 'denied' };

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });
    const { latitude, longitude } = pos.coords;

    // Native reverse geocoding (iOS/Android). Not available on web since SDK 49,
    // and it can fail offline – then fall back to the nearest kommune centre.
    if (Platform.OS !== 'web') {
      try {
        const hit = (await Location.reverseGeocodeAsync({ latitude, longitude }))[0];
        const municipality = hit ? resolveKommune(hit.subregion || hit.city || hit.region || '') : undefined;
        if (municipality) return { municipality, place: hit?.city || hit?.district || undefined };
      } catch {
        /* fall through to the offline lookup */
      }
    }
    const nearest = nearestKommune(latitude, longitude);
    return nearest ? { municipality: nearest } : { error: 'unavailable' };
  } catch {
    return { error: 'unavailable' };
  }
}
