import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Platform } from 'react-native';
import { NOTIFICATION_CHANNEL, NOTIFICATION_SOUND, registerForPush, sendTestNotification } from '@/lib/notifications';

// the module object the app itself requires
const N = jest.requireMock('expo-notifications') as Record<string, unknown> & Record<string, jest.Mock>;
const os = Platform.OS;

beforeEach(() => {
  N.setNotificationChannelAsync = jest.fn().mockResolvedValue(null);
  N.AndroidImportance = { HIGH: 4 } as never;
  (N.scheduleNotificationAsync as jest.Mock).mockClear();
});
afterEach(() => {
  Platform.OS = os;
});

test('on Android, MinNabo notifications ring with their own sound and vibrate when the phone is on silent', async () => {
  Platform.OS = 'android';
  await registerForPush();
  expect(N.setNotificationChannelAsync).toHaveBeenCalledWith(
    NOTIFICATION_CHANNEL,
    expect.objectContaining({ sound: NOTIFICATION_SOUND, enableVibrate: true, vibrationPattern: expect.any(Array) }),
  );
});

test('«Send et testvarsel» plays the MinNabo sound, so it can be heard in Varslinger', async () => {
  await sendTestNotification('Test', 'Hei');
  const [{ content }] = (N.scheduleNotificationAsync as jest.Mock).mock.calls[0];
  expect(content.sound).toBe(NOTIFICATION_SOUND);
});

test('the sound is a short WAV the phones accept (iOS plays at most 30 seconds)', () => {
  const wav = readFileSync(join(__dirname, '..', '..', 'assets', 'sounds', NOTIFICATION_SOUND));
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
  expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
  const byteRate = wav.readUInt32LE(28);
  const seconds = (wav.length - 44) / byteRate;
  expect(seconds).toBeGreaterThan(0.3);
  expect(seconds).toBeLessThan(30);
});

test('the build bundles the sound', () => {
  const plugins = require('../../app.json').expo.plugins as unknown[];
  const entry = plugins.find((p) => Array.isArray(p) && p[0] === 'expo-notifications') as [string, { sounds: string[] }] | undefined;
  expect(entry?.[1].sounds).toContain(`./assets/sounds/${NOTIFICATION_SOUND}`);
});
