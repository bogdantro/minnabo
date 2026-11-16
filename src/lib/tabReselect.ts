/**
 * Tap the tab you're already on: the screen scrolls to the top (and Oppdrag fetches new oppdrag),
 * the way most apps work. The tab bar calls `emit`, the tab's screen listens with `useTabReselect`.
 */
import { useEffect, useRef } from 'react';
import type { NavTarget } from '@/components/BottomNav';

type Listener = () => void;
const listeners = new Map<NavTarget, Set<Listener>>();

export const tabReselect = {
  emit(target: NavTarget) {
    listeners.get(target)?.forEach((l) => l());
  },
};

export function useTabReselect(target: NavTarget, onReselect: Listener) {
  const latest = useRef(onReselect);
  useEffect(() => {
    latest.current = onReselect;
  }, [onReselect]);
  useEffect(() => {
    const l = () => latest.current();
    const set = listeners.get(target) ?? new Set<Listener>();
    set.add(l);
    listeners.set(target, set);
    return () => {
      set.delete(l);
    };
  }, [target]);
}
