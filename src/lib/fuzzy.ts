/**
 * Typo-tolerant search for Søk (0110): when the server finds nothing for «snømåking» typed as «snømåkign»,
 * the oppdrag already loaded for the kommune are matched word by word with a small edit distance.
 */
import type { Listing } from '@/domain/types';

/** Words shorter than this must match exactly: «tak» vs «tal» is a different word, not a typo. */
const MIN_FUZZY_LENGTH = 4;

/** 'kitten', 'sitting' -> 3. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

const words = (s: string) => s.toLowerCase().split(/[^a-zæøå0-9]+/).filter(Boolean);

/** One typo per four letters, at most two: «hagearbied» finds «hagearbeid», «mal» doesn't find «mat». */
function close(typed: string, word: string): boolean {
  if (typed.length < MIN_FUZZY_LENGTH) return word.startsWith(typed);
  if (word.startsWith(typed)) return true;
  const allowed = Math.min(2, Math.floor(typed.length / 4));
  // compare with the start of a longer word too: «snømåkign» vs «snømåking»/«snømåkingen»
  return editDistance(typed, word) <= allowed || editDistance(typed, word.slice(0, typed.length)) <= allowed;
}

/** Listings where every typed word is close to a word in the title, description or category. */
export function fuzzyMatch(listings: Listing[], term: string): Listing[] {
  const typed = words(term);
  if (!typed.length) return [];
  return listings.filter((l) => {
    const own = words(`${l.title} ${l.task?.description ?? l.offer?.about ?? ''} ${l.category.label}`);
    return typed.every((t) => own.some((w) => close(t, w)));
  });
}
