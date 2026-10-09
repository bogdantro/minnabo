import * as Location from 'expo-location';
import { detectKommune } from '@/lib/geo';

const L = Location as jest.Mocked<typeof Location>;

beforeEach(() => {
  jest.clearAllMocks();
  L.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true } as never);
  L.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 61.1, longitude: 10.4 } } as never);
  L.getLastKnownPositionAsync.mockResolvedValue(null as never);
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

it('falls back to the nearest kommune centre when reverse geocoding gives nothing useful', async () => {
  L.reverseGeocodeAsync.mockResolvedValue([{ subregion: 'Nowhere', city: 'Nowhere' }] as never);
  await expect(detectKommune()).resolves.toEqual({ municipality: 'Lillehammer' });
});

it('falls back to the nearest kommune centre when reverse geocoding throws (web)', async () => {
  L.reverseGeocodeAsync.mockRejectedValue(new Error('Geocoding API removed'));
  L.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 60.8, longitude: 11.07 } } as never);
  await expect(detectKommune()).resolves.toEqual({ municipality: 'Hamar' });
});

it('says "outside" (not "could not find you") far outside the kommuner we serve', async () => {
  L.reverseGeocodeAsync.mockResolvedValue([{ subregion: 'Oslo', city: 'Oslo', region: 'Oslo' }] as never);
  L.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 59.91, longitude: 10.75 } } as never); // Oslo
  await expect(detectKommune()).resolves.toEqual({ error: 'outside' });
});

it('uses the last known position when a fresh fix fails (slow GPS indoors on iOS)', async () => {
  L.getCurrentPositionAsync.mockRejectedValue(new Error('kCLErrorLocationUnknown'));
  L.getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: 61.1, longitude: 10.4 } } as never);
  await expect(detectKommune()).resolves.toEqual({ municipality: 'Lillehammer', place: 'Lillehammer' });
});

it('tells a blocked permission (iOS never asks twice) apart from a plain "no"', async () => {
  L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false } as never);
  await expect(detectKommune()).resolves.toEqual({ error: 'blocked' });
  expect(L.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});

it('only places you in a launch kommune (Lillehammer and the kommuner around it)', async () => {
  L.reverseGeocodeAsync.mockResolvedValue([{ subregion: 'Elverum', city: 'Elverum', region: 'Innlandet' }] as never);
  L.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 60.881, longitude: 11.564 } } as never);
  await expect(detectKommune()).resolves.toEqual({ error: 'outside' });
});
