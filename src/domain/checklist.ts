import type { Listing } from './types';
import { categoryArtId } from './categories';
import { FORMS } from '@/screens/LeggUt/wizardConfig';

/** Multi-choice answers that describe who/what, not work to tick off («Hund», «3–5 år»). */
const NOT_TASKS = new Set(['animal', 'ages', 'subject']);

/** Yes/no answers that are a task of their own when the answer is «Ja». */
const YES_TASKS: Record<string, string> = {
  'Skal hageavfall kjøres bort?': 'Kjøre bort hageavfall',
  'Skal det strøs?': 'Strø',
  'Trengs det skraping/vask først?': 'Skrape og vaske først',
  'Må det bæres ut?': 'Bære ut',
  'Trengs det sortering?': 'Sortere',
  'Skal barna legges?': 'Legge barna',
};

const MAX = 8;

/**
 * Jobbdag's checklist, suggested from what the owner answered when posting:
 * «Hva gjelder det? Plen, Hekk» + «Skal hageavfall kjøres bort? Ja» → ['Plen', 'Hekk', 'Kjøre bort hageavfall'].
 * «Annet» is left out, and so is anything already on the list (case-insensitive).
 */
export function checklistSuggestions(listing: Listing | undefined, existing: string[] = []): string[] {
  const intake = listing?.task?.intake;
  if (!listing || !intake?.length) return [];
  const have = new Set(existing.map((t) => t.trim().toLowerCase()));
  const form = FORMS[categoryArtId(listing.category.slug)];
  const out: string[] = [];
  const add = (t: string) => {
    const k = t.trim().toLowerCase();
    if (!k || k === 'annet' || have.has(k)) return;
    have.add(k);
    out.push(t.trim());
  };
  for (const f of form.fields) {
    if (f.kind !== 'choice' || !f.multi || NOT_TASKS.has(f.key)) continue;
    const row = intake.find((r) => r.label === f.label);
    row?.value.split(',').forEach(add);
  }
  for (const r of intake) if (r.value === 'Ja' && YES_TASKS[r.label]) add(YES_TASKS[r.label]);
  return out.slice(0, MAX);
}
