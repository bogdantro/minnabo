import * as Location from 'expo-location';
import { detectKommune } from '@/lib/geo';

const L = Location as jest.Mocked<typeof Location>;

// jest-setup already mocks '@/lib/env' with useMocks:false; re-assert it here so
// this suite exercises the real permission → getCurrentPositionAsync →
// reverseGeocodeAsync path against the expo-location mock.
jest.mock('@/lib/env', () => ({ ENV: { useMocks: false, supabaseUrl: 'x', supabaseAnonKey: 'y' } }));

beforeEach(() => {
  jest.clearAllMocks();
  L.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true } as never);
  L.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 61.1, longitude: 10.4 } } as never);
  L.reverseGeocodeAsync.mockResolvedValue([{ subregion: 'Lillehammer', city: 'Lillehammer', region: 'Innlandet' }] as never);
});

it('resolves the kommune from subregion', async () => {
  await expect(detectKommune()).resolves.toEqual({ municipality: 'Lillehammer', place: 'Lillehammer' });
});

it('falls back to city when subregion is absent', async () => {
  L.reverseGeocodeAsync.mockResolvedValue([{ city: 'Brumunddal', region: 'Innlandet' }] as never);
  await expect(detectKommune()).resolves.toEqual({ municipality: 'Ringsaker', place: 'Brumunddal' });
});

it('returns {error:denied} when permission is refused', async () => {
  L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true } as never);
  L.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false } as never);
  await expect(detectKommune()).resolves.toEqual({ error: 'denied' });
});

it('returns {error:unavailable} when the fix throws', async () => {
  L.getCurrentPositionAsync.mockRejectedValue(new Error('location services off'));
  await expect(detectKommune()).resolves.toEqual({ error: 'unavailable' });
});

it('returns {error:unavailable} when the kommune cannot be resolved', async () => {
  L.reverseGeocodeAsync.mockResolvedValue([{ subregion: 'Nowhere', city: 'Nowhere' }] as never);
  await expect(detectKommune()).resolves.toEqual({ error: 'unavailable' });
});
