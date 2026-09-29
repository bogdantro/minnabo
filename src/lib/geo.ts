/**
 * Device location → kommune. Coarse, one-shot, foreground only. The raw
 * coordinate never leaves this module — callers get a kommune name.
 */
import { resolveKommune } from '@/data/kommuner';

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
    const hits = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const hit = hits[0];
    if (!hit) return { error: 'unavailable' };

    const kommuneName = hit.subregion || hit.city || hit.region || '';
    const municipality = resolveKommune(kommuneName);
    if (!municipality) return { error: 'unavailable' };

    const place = hit.city || hit.district || hit.subregion || undefined;
    return { municipality, place };
  } catch {
    return { error: 'unavailable' };
  }
}
