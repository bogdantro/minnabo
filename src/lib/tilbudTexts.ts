import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'minnabo.tilbudTexts.v1';
export const MAX_TEXTS = 5;

/** Your own tilbud texts («Hei! Jeg har egen gressklipper …»). On the phone, like Nylige søk. */
export function useTilbudTexts() {
  const [texts, setTexts] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => setTexts(raw ? (JSON.parse(raw) as string[]) : []))
      .catch(() => undefined);
  }, []);
  const store = useCallback((next: string[]) => {
    setTexts(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);
  const add = useCallback((t: string) => store([t.trim(), ...texts.filter((x) => x !== t.trim())].slice(0, MAX_TEXTS)), [store, texts]);
  const remove = useCallback((t: string) => store(texts.filter((x) => x !== t)), [store, texts]);
  return { texts, add, remove };
}
