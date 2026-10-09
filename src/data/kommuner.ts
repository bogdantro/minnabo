/**
 * Kommune reference data for Innlandet. Kommune is MinNabo's location unit;
 * distance/coordinates are deliberately not used (spec 2026-09-05).
 * `postalCodes.ts` keeps the poststed lookup — this composes on top of it.
 */
import { isPostalCode, lookupPostalCode } from './postalCodes';

/** Canonical kommune names MinNabo serves. Extend as coverage grows. */
export const INNLANDET_KOMMUNER = [
  'Lillehammer', 'Øyer', 'Gausdal', 'Ringsaker', 'Hamar', 'Stange',
  'Gjøvik', 'Østre Toten', 'Vestre Toten', 'Nordre Land', 'Søndre Land',
  'Nord-Aurdal', 'Elverum', 'Åmot', 'Trysil', 'Kongsvinger', 'Sør-Odal',
  'Nord-Odal', 'Eidskog', 'Grue', 'Åsnes', 'Sel', 'Nord-Fron', 'Sør-Fron',
  'Ringebu', 'Tynset', 'Tolga',
] as const;

/**
 * Where MinNabo starts: Lillehammer and the kommuner within about 40 km of it
 * (centre to centre), plus Hamar (48 km), which is included on purpose.
 * These are the only choices when creating an account or an oppdrag, and the
 * only kommuner "Bruk posisjonen min" will place you in.
 */
export const LAUNCH_KOMMUNER = ['Lillehammer', 'Øyer', 'Gausdal', 'Ringsaker', 'Gjøvik', 'Hamar', 'Nordre Land'] as const;

export const isLaunchKommune = (kommune: string | null | undefined): boolean =>
  !!kommune && (LAUNCH_KOMMUNER as readonly string[]).includes(kommune);

/** Areas (bydeler/tettsteder) offered as quick picks in Oppsett. Approximate only – never an address. */
export const KOMMUNE_AREAS: Partial<Record<string, readonly string[]>> = {
  Lillehammer: ['Nordre Ål', 'Søre Ål', 'Sentrum', 'Stampesletta', 'Fåberg', 'Vingrom', 'Kanten'],
};

/** Område chips on Rediger profil (design/screens/RedigerProfil.dc.html). "Hele kommunen" = place is the kommune itself. */
export const WHOLE_KOMMUNE = 'Hele kommunen';
const PROFILE_AREAS: Partial<Record<string, readonly string[]>> = {
  Lillehammer: ['Nordre Ål', 'Søre Ål', 'Sentrum', 'Stampesletta', 'Fåberg', 'Vingrom', 'Kanten', 'Jørstadmoen'],
  Øyer: ['Tingberg', 'Hafjell', WHOLE_KOMMUNE],
  Gausdal: ['Follebu', 'Segalstad bru', WHOLE_KOMMUNE],
  Ringsaker: ['Brumunddal', 'Moelv', WHOLE_KOMMUNE],
  Hamar: ['Sentrum', 'Ridabu', WHOLE_KOMMUNE],
  Gjøvik: ['Sentrum', 'Biri', WHOLE_KOMMUNE],
};
export function profileAreas(kommune: string): readonly string[] {
  return PROFILE_AREAS[kommune] ?? [WHOLE_KOMMUNE];
}

/** poststed / tettsted / by → kommune, where the names differ. */
const PLACE_TO_KOMMUNE: Record<string, string> = {
  'Brumunddal': 'Ringsaker',
  'Moelv': 'Ringsaker',
  'Biri': 'Gjøvik',
  'Lena': 'Østre Toten',
  'Raufoss': 'Vestre Toten',
  'Otta': 'Sel',
  'Vinstra': 'Nord-Fron',
  'Hundorp': 'Sør-Fron',
  'Fagernes': 'Nord-Aurdal',
  'Dokka': 'Nordre Land',
  'Hov': 'Søndre Land',
  'Rena': 'Åmot',
  'Skotterud': 'Eidskog',
  'Flisa': 'Åsnes',
};

/** Direct-neighbour adjacency for the kommuner MinNabo actively serves. */
export const KOMMUNE_NEIGHBOURS: Record<string, readonly string[]> = {
  'Lillehammer': ['Øyer', 'Gausdal', 'Ringsaker', 'Gjøvik'],
  'Øyer': ['Lillehammer', 'Gausdal', 'Ringebu', 'Stor-Elvdal'],
  'Gausdal': ['Lillehammer', 'Øyer', 'Nordre Land', 'Sør-Fron', 'Ringebu'],
  'Ringsaker': ['Lillehammer', 'Hamar', 'Gjøvik', 'Øyer', 'Stange'],
  'Hamar': ['Ringsaker', 'Stange', 'Løten'],
  'Stange': ['Hamar', 'Ringsaker', 'Løten', 'Nord-Odal'],
  'Gjøvik': ['Lillehammer', 'Ringsaker', 'Østre Toten', 'Vestre Toten', 'Nordre Land', 'Søndre Land'],
  'Østre Toten': ['Gjøvik', 'Vestre Toten', 'Stange', 'Hamar'],
  'Vestre Toten': ['Gjøvik', 'Østre Toten', 'Søndre Land', 'Nordre Land'],
  'Elverum': ['Åmot', 'Løten', 'Hamar', 'Våler', 'Trysil'],
  'Åmot': ['Elverum', 'Stor-Elvdal', 'Trysil', 'Ringsaker'],
  'Kongsvinger': ['Sør-Odal', 'Nord-Odal', 'Grue', 'Eidskog'],
  'Sør-Odal': ['Kongsvinger', 'Nord-Odal', 'Nes'],
  'Nord-Odal': ['Sør-Odal', 'Kongsvinger', 'Stange', 'Nes'],
  'Grue': ['Kongsvinger', 'Åsnes', 'Våler'],
  'Sel': ['Nord-Fron', 'Vågå', 'Dovre', 'Rendalen'],
  'Nord-Fron': ['Sel', 'Sør-Fron', 'Ringebu', 'Vågå'],
  'Sør-Fron': ['Nord-Fron', 'Ringebu', 'Gausdal', 'Nordre Land'],
  'Ringebu': ['Sør-Fron', 'Øyer', 'Gausdal', 'Stor-Elvdal', 'Nord-Fron'],
  'Tynset': ['Tolga', 'Alvdal', 'Rendalen', 'Folldal'],
  'Tolga': ['Tynset', 'Os', 'Rendalen'],
};

const norm = (s: string): string => s.trim().toLowerCase();

const CANONICAL_BY_NORM = new Map<string, string>(
  INNLANDET_KOMMUNER.map((k) => [norm(k), k]),
);
const PLACE_BY_NORM = new Map<string, string>(
  Object.entries(PLACE_TO_KOMMUNE).map(([p, k]) => [norm(p), k]),
);

export function resolveKommune(input: string): string | undefined {
  if (!input || !input.trim()) return undefined;
  const n = norm(input);
  if (CANONICAL_BY_NORM.has(n)) return CANONICAL_BY_NORM.get(n);
  if (PLACE_BY_NORM.has(n)) return PLACE_BY_NORM.get(n);
  if (isPostalCode(input)) {
    const poststed = lookupPostalCode(input);
    if (poststed) return resolveKommune(poststed);
  }
  return undefined;
}

/**
 * Kommune allow-list for a reach level (Oppdrag › Rekkevidde):
 * 0 = own kommune, 1 = own + direct neighbours, 2 = all of Innlandet.
 */
export function expandKommuner(
  base: string | undefined,
  reach: 0 | 1 | 2,
): string[] {
  if (!base) return [];
  if (reach === 0) return [base];
  if (reach === 2) return [base, ...INNLANDET_KOMMUNER.filter((k) => k !== base)];
  const known = KOMMUNE_NEIGHBOURS[base] ?? [];
  return [base, ...known.filter((k) => k !== base)];
}

/** Approximate kommune centres (administrasjonssenter) for the offline location lookup. */
const KOMMUNE_CENTRES: Record<string, [number, number]> = {
  Lillehammer: [61.115, 10.466], Øyer: [61.264, 10.413], Gausdal: [61.25, 10.15], Ringsaker: [60.881, 10.94],
  Hamar: [60.795, 11.068], Stange: [60.717, 11.191], Gjøvik: [60.795, 10.692], 'Østre Toten': [60.676, 10.813],
  'Vestre Toten': [60.726, 10.613], 'Nordre Land': [60.836, 10.077], 'Søndre Land': [60.7, 10.355],
  'Nord-Aurdal': [60.986, 9.233], Elverum: [60.881, 11.564], Åmot: [61.135, 11.371], Trysil: [61.315, 12.264],
  Kongsvinger: [60.191, 11.998], 'Sør-Odal': [60.256, 11.683], 'Nord-Odal': [60.39, 11.565], Eidskog: [59.981, 12.12],
  Grue: [60.462, 12.06], Åsnes: [60.613, 12.016], Sel: [61.773, 9.54], 'Nord-Fron': [61.596, 9.751],
  'Sør-Fron': [61.552, 9.92], Ringebu: [61.53, 10.14], Tynset: [62.275, 10.778], Tolga: [62.41, 10.993],
};

/** Nearest served kommune to a coordinate, or undefined when further than ~60 km from all of them. */
export function nearestKommune(lat: number, lon: number): string | undefined {
  const rad = Math.PI / 180;
  let best: string | undefined;
  let bestKm = Infinity;
  for (const [name, [la, lo]] of Object.entries(KOMMUNE_CENTRES)) {
    const x = (lo - lon) * rad * Math.cos(((la + lat) / 2) * rad);
    const y = (la - lat) * rad;
    const km = Math.sqrt(x * x + y * y) * 6371;
    if (km < bestKm) {
      bestKm = km;
      best = name;
    }
  }
  return bestKm <= 60 ? best : undefined;
}
