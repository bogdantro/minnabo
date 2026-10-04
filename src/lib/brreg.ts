/**
 * Enhetsregisteret (Brønnøysundregistrene) – free public API, no key.
 * https://data.brreg.no/enhetsregisteret/api/docs/index.html
 */

export type BrregCompany = {
  orgNr: string;
  name: string;
  /** "Storgata 1" */
  address?: string;
  postalCode?: string;
  city?: string;
  /** "Aksjeselskap", "Enkeltpersonforetak" … */
  form?: string;
};

/** 9 digits, starts with 8 or 9, and the mod-11 check digit is right. */
export function isValidOrgNr(digits: string): boolean {
  if (!/^[89]\d{8}$/.test(digits)) return false;
  const w = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = w.reduce((s, x, i) => s + x * Number(digits[i]), 0);
  const rest = sum % 11;
  const check = rest === 0 ? 0 : 11 - rest;
  return check !== 10 && check === Number(digits[8]);
}

type Raw = {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform?: { beskrivelse?: string };
  forretningsadresse?: { adresse?: string[]; postnummer?: string; poststed?: string };
  postadresse?: { adresse?: string[]; postnummer?: string; poststed?: string };
  konkurs?: boolean;
  slettedato?: string;
};

/** Look up an organisation number. null = not found / deleted; throws on network errors. */
export async function lookupOrgNr(digits: string): Promise<BrregCompany | null> {
  const res = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${digits}`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`brreg ${res.status}`);
  const r = (await res.json()) as Raw;
  if (r.slettedato) return null;
  const adr = r.forretningsadresse ?? r.postadresse;
  return {
    orgNr: r.organisasjonsnummer,
    name: r.navn,
    address: adr?.adresse?.filter(Boolean).join(', ') || undefined,
    postalCode: adr?.postnummer,
    city: adr?.poststed ? adr.poststed.charAt(0) + adr.poststed.slice(1).toLowerCase() : undefined,
    form: r.organisasjonsform?.beskrivelse,
  };
}
