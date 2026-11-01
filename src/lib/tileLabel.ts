/**
 * Category names in the narrow 3-column tiles (Legg ut step 1). A tile fits about ten
 * letters per line, so a long word like "Sykkelreparasjon" used to be broken by the text
 * engine wherever it ran out of room ("Sykkelreparasjo" + "n"). Instead, long words are
 * split where the compound joins ("Sykkel-" / "reparasjon"); a long word with no known
 * ending gets a smaller font, so it is never broken mid-word. Labels come from the
 * database, so this can't be a hand-made list of labels.
 */

/** Longer words than this don't fit on one line of a tile on a small phone. */
export const MAX_TILE_WORD = 10;

// Second halves of Norwegian compounds used in category names, longest first.
const TAILS = [
  'reparasjoner', 'reparasjon', 'montering', 'likehold', 'levering', 'rydding', 'kjøring', 'flytting',
  'hjelp', 'måking', 'pleie', 'vakt', 'puss', 'pass', 'vask', 'stell',
];

/** 'Sykkelreparasjon' -> 'Sykkel-\nreparasjon'; short words and unknown compounds are left as they are. */
function splitWord(word: string): string {
  if (word.length <= MAX_TILE_WORD) return word;
  const lower = word.toLowerCase();
  const tail = TAILS.find((t) => lower.endsWith(t) && word.length - t.length >= 3);
  if (!tail) return word;
  const at = word.length - tail.length;
  return `${word.slice(0, at)}-\n${word.slice(at)}`;
}

/**
 * 'Sykkelreparasjon' -> { text: 'Sykkel-\nreparasjon', small: false }
 * 'Transport/levering' -> { text: 'Transport/​levering', small: false }  (may wrap after the slash)
 * 'Kjempelangtordutenkjenteending' -> { text: same, small: true }
 */
export function tileLabel(label: string): { text: string; small: boolean } {
  const parts = label.split(/(\s+|\/)/).map((p) => (p === '/' ? '/​' : /^\s+$/.test(p) ? p : splitWord(p)));
  const text = parts.join('');
  // after splitting, every line piece must fit; otherwise use the smaller font
  const longest = Math.max(...text.split(/[\s/​\n]+/).map((w) => w.replace(/-$/, '').length));
  return { text, small: longest > MAX_TILE_WORD + 1 };
}
