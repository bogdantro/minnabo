import type { NeighbourhoodInfo } from '@/api/ApiClient';
import { profiles } from './seed';

type Group = { id: string; createdAt: string; members: string[] };

const key = (municipality: string, place: string) => `${municipality}|${place}`;

/** Seed: every sample profile is a member of the group for its own area. */
function seed(): Map<string, Group> {
  const m = new Map<string, Group>();
  let n = 0;
  for (const p of Object.values(profiles)) {
    if (p.id === 'u-mb') continue; // the current user starts outside, to show "Bli med"
    const k = key(p.location.municipality, p.location.place);
    const g = m.get(k) ?? { id: `nb-${++n}`, createdAt: '2025-03-04T10:00:00Z', members: [] };
    g.members.push(p.id);
    m.set(k, g);
  }
  return m;
}

let groups = seed();

export const neighbourhoodStore = {
  info(municipality: string, place: string, me: string): NeighbourhoodInfo {
    const g = groups.get(key(municipality, place));
    return {
      id: g?.id ?? null,
      name: `${place} nabolag`,
      place,
      municipality,
      createdAt: g?.createdAt,
      memberCount: g?.members.length ?? 0,
      isMember: !!g?.members.includes(me),
      memberIds: [...(g?.members ?? [])].reverse().slice(0, 5),
    };
  },
  join(municipality: string, place: string, me: string): void {
    const k = key(municipality, place);
    const g = groups.get(k) ?? { id: `nb-${groups.size + 1}`, createdAt: new Date().toISOString(), members: [] };
    if (!g.members.includes(me)) g.members.push(me);
    groups.set(k, g);
  },
  leave(municipality: string, place: string, me: string): void {
    const g = groups.get(key(municipality, place));
    if (g) g.members = g.members.filter((id) => id !== me);
  },
  _reset(): void {
    groups = seed();
  },
};
