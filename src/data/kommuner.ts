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

export function expandKommuner(
  base: string | undefined,
  reach: 0 | 1 | 2,
): string[] {
  if (!base) return [];
  if (reach === 0) return [base];
  const known = KOMMUNE_NEIGHBOURS[base];
  if (!known) {
    return reach === 1
      ? [base]
      : [base, ...INNLANDET_KOMMUNER.filter((k) => k !== base)];
  }
  const out = new Set<string>([base, ...known]);
  if (reach === 2) {
    for (const n of known) {
      for (const nn of KOMMUNE_NEIGHBOURS[n] ?? []) out.add(nn);
    }
  }
  return [base, ...[...out].filter((k) => k !== base)];
}
