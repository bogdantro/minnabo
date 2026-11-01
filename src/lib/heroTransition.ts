import { useSyncExternalStore } from 'react';

/**
 * The oppdrag photo "growing" from the card into the detail gallery (a shared-element look,
 * built in JS: Reanimated's own shared transitions are an experimental native flag).
 *
 *   card tap ──start(from)──> flying, waiting for the gallery
 *   gallery on screen ──land(to)──> the overlay (HeroOverlay, at the app root) animates from → to
 *   overlay done ──finish()──> idle, the gallery shows its own photo
 *
 * The overlay lives above every screen, so the normal push slide can run underneath. If the gallery
 * never reports (no photo, navigation failed), the flight is dropped after GIVE_UP_MS.
 */
export type Rect = { x: number; y: number; width: number; height: number; radius: number };
type Flight = { id: string; uri: string; from: Rect; to?: Rect; startedAt: number };

/** A gallery that reports later than this is not the one the card was tapped for. */
export const GIVE_UP_MS = 900;

let flight: Flight | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let giveUp: ReturnType<typeof setTimeout> | undefined;

export const heroTransition = {
  start(id: string, uri: string, from: Rect) {
    flight = { id, uri, from, startedAt: Date.now() };
    clearTimeout(giveUp);
    giveUp = setTimeout(() => {
      if (flight && !flight.to) heroTransition.finish();
    }, GIVE_UP_MS);
    emit();
  },
  /** The detail gallery for `id` is on screen at `to`. Ignored if no flight for it is waiting. */
  land(id: string, to: Rect) {
    if (!flight || flight.id !== id || flight.to || Date.now() - flight.startedAt > GIVE_UP_MS) return false;
    flight = { ...flight, to };
    clearTimeout(giveUp);
    emit();
    return true;
  },
  finish() {
    clearTimeout(giveUp);
    flight = null;
    emit();
  },
  current: () => flight,
  /** A flight is waiting for (or flying to) the gallery of this oppdrag. */
  pendingFor: (id: string) => !!flight && flight.id === id && Date.now() - flight.startedAt <= GIVE_UP_MS,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useHeroFlight() {
  return useSyncExternalStore(heroTransition.subscribe, heroTransition.current, heroTransition.current);
}
