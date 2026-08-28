/**
 * Mock postnummer → poststed lookup for Innlandet. A real deploy would call
 * Bring / Posten's postnummer API. Enough entries to demo the flow.
 */
const POSTAL: Record<string, string> = {
  '2600': 'Lillehammer',
  '2601': 'Lillehammer',
  '2609': 'Lillehammer',
  '2615': 'Lillehammer',
  '2618': 'Lillehammer',
  '2300': 'Hamar',
  '2315': 'Hamar',
  '2317': 'Hamar',
  '2319': 'Hamar',
  '2800': 'Gjøvik',
  '2815': 'Gjøvik',
  '2819': 'Gjøvik',
  '2400': 'Elverum',
  '2406': 'Elverum',
  '2408': 'Elverum',
  '2200': 'Kongsvinger',
  '2208': 'Kongsvinger',
  '2211': 'Kongsvinger',
  '2670': 'Otta',
  '2673': 'Otta',
  '2380': 'Brumunddal',
  '2390': 'Moelv',
  '2836': 'Biri',
  '2850': 'Lena',
  '2500': 'Tynset',
  '2540': 'Tolga',
};

/** Returns the poststed for a 4-digit postnummer, or undefined. */
export function lookupPostalCode(code: string): string | undefined {
  return POSTAL[code.trim()];
}

export function isPostalCode(input: string): boolean {
  return /^\d{4}$/.test(input.trim());
}
