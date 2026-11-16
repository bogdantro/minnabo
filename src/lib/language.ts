/**
 * A rough guess at whether a chat message is in another language, so «Vis på norsk» is only offered
 * where it helps. It never decides anything else: a wrong guess just shows or hides that one link.
 */
const NORWEGIAN = new Set(
  (
    // words that are just as common in English («i», «for») or French/Spanish («de») are left out
    'og jeg det er på til en et ei med ikke kan du har som så vi hei takk ja nei deg meg skal vil da når hva om men av den fra var blir ' +
    'kommer kom hvor hvordan hvis eller også bare litt mye noe her der nå dag dager uke tid klokka kl helt fint bra greit gjerne ' +
    'hilsen mvh lørdag søndag mandag tirsdag onsdag torsdag fredag morgen kveld jobben oppdraget hjelpe hjelp passer pris kr'
  ).split(' '),
);

/** At least this many words before we guess at all. */
const MIN_WORDS = 3;

export function looksForeign(value: string): boolean {
  const clean = value.replace(/https?:\/\/\S+/g, ' ').trim();
  if (/[æøåÆØÅ]/.test(clean)) return false;
  const words = clean.toLocaleLowerCase('nb-NO').match(/\p{L}+/gu) ?? [];
  if (words.length < MIN_WORDS) return false;
  const hits = words.filter((w) => NORWEGIAN.has(w)).length;
  return hits / words.length < 0.12;
}
