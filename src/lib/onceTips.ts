/**
 * First-time tips (asked 2026-11-09): each tip shows once per phone, then never again.
 * Stored on the phone only; a tip that hasn't loaded its answer yet stays hidden, so it never flashes.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TipKey = 'leggUt' | 'forMegSwipe' | 'mapCircles';

const KEY = (k: TipKey) => `minnabo.tip.${k}`;

/** true when the tip should show now; `done()` hides it for good. */
export function useOnceTip(key: TipKey, enabled = true): { show: boolean; done: () => void } {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY(key))
      .then((v) => live && setSeen(v === '1'))
      .catch(() => live && setSeen(true));
    return () => {
      live = false;
    };
  }, [key]);
  const done = useCallback(() => {
    setSeen(true);
    void AsyncStorage.setItem(KEY(key), '1').catch(() => undefined);
  }, [key]);
  return { show: enabled && seen === false, done };
}
