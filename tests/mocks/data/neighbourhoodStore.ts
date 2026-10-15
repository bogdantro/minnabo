import type { NabolagSummary, NeighbourhoodInfo } from '@/api/ApiClient';
import { profiles } from './seed';

type Group = { id: string; place: string; municipality: string; createdAt: string; members: string[] };

/** The nabolag MinNabo manages (0065). Other kommuner have none. */
const LIST: Record<string, string[]> = {
  Lillehammer: ['Sentrum', 'Nordre Ål', 'Søre Ål', 'Vingnes', 'Vingrom', 'Jørstadmoen'],
};
export const MAX_NABOLAG = 3;

/** Seed: a few sample profiles are spread over the first nabolag; the current user starts outside. */
function seed(): Group[] {
  const others = Object.values(profiles)
    .filter((p) => p.id !== 'u-mb' && p.location.municipality === 'Lillehammer')
    .map((p) => p.id);
  let n = 0;
  return Object.entries(LIST).flatMap(([municipality, places]) =>
    places.map((place, i) => ({
      id: `nb-${++n}`,
      place,
      municipality,
      createdAt: '2025-03-04T10:00:00Z',
      members: others.filter((_, j) => j % places.length === i),
    })),
  );
}

let groups = seed();

const summary = (g: Group, me: string): NabolagSummary => ({
  id: g.id,
  name: `${g.place} nabolag`,
  place: g.place,
  municipality: g.municipality,
  memberCount: g.members.length,
  isMember: g.members.includes(me),
});

export const neighbourhoodStore = {
  /** A kommune's nabolag, or (without a kommune) the ones `me` is in. */
  list(municipality: string | undefined, me: string): NabolagSummary[] {
    return groups.filter((g) => (municipality ? g.municipality === municipality : g.members.includes(me))).map((g) => summary(g, me));
  },
  info(municipality: string, place: string, me: string): NeighbourhoodInfo {
    const g = groups.find((x) => x.municipality === municipality && x.place === place);
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
  joinById(id: string, me: string): void {
    const g = groups.find((x) => x.id === id);
    if (!g) throw new Error('Fant ikke nabolaget.');
    if (g.members.includes(me)) return;
    if (groups.filter((x) => x.members.includes(me)).length >= MAX_NABOLAG) {
      throw new Error('Du kan være med i høyst 3 nabolag. Forlat ett for å bli med i et nytt.');
    }
    g.members.push(me);
  },
  leaveById(id: string, me: string): void {
    const g = groups.find((x) => x.id === id);
    if (g) g.members = g.members.filter((m) => m !== me);
  },
  isMember(id: string, me: string): boolean {
    return !!groups.find((x) => x.id === id)?.members.includes(me);
  },
  byId(id: string): Group | undefined {
    return groups.find((x) => x.id === id);
  },
  _reset(): void {
    groups = seed();
  },
};
