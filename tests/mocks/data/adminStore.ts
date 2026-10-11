import type { Partner } from '@/domain/types';

/**
 * What the website's admin has decided, for the mock backend: who is suspended and how each
 * partner is shown. The app has no admin panel of its own any more – tests set these directly.
 */
let suspended = new Set<string>();
let mainOverride: Record<string, boolean> = {};
let inactive = new Set<string>();
let heroes = new Set<string>();

export const adminStore = {
  isSuspended: (id: string) => suspended.has(id),
  setSuspended(id: string, on: boolean): void {
    const next = new Set(suspended);
    if (on) next.add(id);
    else next.delete(id);
    suspended = next;
  },

  setHero(id: string, on: boolean): void {
    const next = new Set(heroes);
    if (on) next.add(id);
    else next.delete(id);
    heroes = next;
    if (on) adminStore.setActive(id, true);
  },
  setMain(_all: Partner[], id: string, on: boolean): void {
    mainOverride = { ...mainOverride, [id]: on };
    if (on) adminStore.setActive(id, true);
  },
  /** false = hidden in the app (not approved, unpaid past the grace period, paused or hidden by an admin) */
  setActive(id: string, on: boolean): void {
    const next = new Set(inactive);
    if (on) next.delete(id);
    else next.add(id);
    inactive = next;
  },
  /** What Fellesskap sees: hidden partners are not returned, levels as the website set them. */
  visiblePartners(all: Partner[]): Partner[] {
    return all
      .filter((p) => !inactive.has(p.id))
      .map((p) => ({ ...p, featured: mainOverride[p.id] ?? p.featured, localHero: heroes.has(p.id) || !!p.localHero }));
  },

  _reset(): void {
    suspended = new Set();
    mainOverride = {};
    inactive = new Set();
    heroes = new Set();
  },
};
