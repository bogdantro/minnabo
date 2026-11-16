/**
 * «Rist telefonen for å melde fra om et problem» (asked 2026-11-09).
 *
 * A shake is a few hard jolts close together, so walking, a bus or putting the phone down never counts.
 * The motion sensor is loaded lazily: a build without it (Expo Go, an older build) simply never shakes.
 * Can be switched off in Innstillinger (stored on the phone).
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** A jolt is this many g away from resting (1 g). */
const JOLT_G = 1.6;
/** This many jolts … */
const JOLTS = 3;
/** … within this window (ms) is a shake. */
const WINDOW_MS = 900;
/** Quiet time after a shake, so one shake opens one sheet. */
const COOLDOWN_MS = 4000;
/** Sensor rate (ms). */
const INTERVAL_MS = 80;

const OFF_KEY = 'minnabo.shakeToReport.off';

/** Pure, so it can be tested: the jolt times (ms) → is this a shake? */
export function isShake(jolts: number[], now: number): boolean {
  return jolts.filter((t) => now - t <= WINDOW_MS).length >= JOLTS;
}

export const shakeSetting = {
  async isOn(): Promise<boolean> {
    return (await AsyncStorage.getItem(OFF_KEY).catch(() => null)) !== '1';
  },
  async set(on: boolean) {
    if (on) await AsyncStorage.removeItem(OFF_KEY).catch(() => undefined);
    else await AsyncStorage.setItem(OFF_KEY, '1').catch(() => undefined);
  },
};

/** The on/off switch, for Innstillinger. */
export function useShakeSetting() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    void shakeSetting.isOn().then(setOn);
  }, []);
  return {
    on: on ?? true,
    set: (next: boolean) => {
      setOn(next);
      void shakeSetting.set(next);
    },
  };
}

/** Calls `onShake` when the phone is shaken, while `enabled` and the app is in front. */
export function useShake(onShake: () => void, enabled: boolean) {
  const cb = useRef(onShake);
  useEffect(() => {
    cb.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let sub: { remove: () => void } | null = null;
    let alive = true;
    const jolts: number[] = [];
    let quietUntil = 0;

    const start = async () => {
      if (!(await shakeSetting.isOn()) || !alive) return;
      let Accelerometer: typeof import('expo-sensors').Accelerometer;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        Accelerometer = (require('expo-sensors') as typeof import('expo-sensors')).Accelerometer;
        if (!(await Accelerometer.isAvailableAsync())) return;
      } catch {
        return; // no sensor module in this build
      }
      if (!alive) return;
      Accelerometer.setUpdateInterval(INTERVAL_MS);
      sub = Accelerometer.addListener(({ x, y, z }) => {
        const now = Date.now();
        if (now < quietUntil) return;
        if (Math.abs(Math.sqrt(x * x + y * y + z * z) - 1) < JOLT_G) return;
        jolts.push(now);
        while (jolts.length && now - jolts[0] > WINDOW_MS) jolts.shift();
        if (isShake(jolts, now)) {
          jolts.length = 0;
          quietUntil = now + COOLDOWN_MS;
          cb.current();
        }
      });
    };
    const stop = () => {
      sub?.remove();
      sub = null;
    };

    void start();
    // the sensor only runs while the app is in front
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        if (!sub) void start();
      } else stop();
    });
    return () => {
      alive = false;
      stop();
      app.remove();
    };
  }, [enabled]);
}
