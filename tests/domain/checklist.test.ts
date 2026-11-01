import { checklistSuggestions } from '@/domain/checklist';
import type { Listing } from '@/domain/types';

const listing = (slug: string, intake: { label: string; value: string }[]) =>
  ({ category: { slug }, task: { intake } }) as unknown as Listing;

describe('checklistSuggestions', () => {
  it('turns multi-choice answers and «Ja» tasks into checklist items', () => {
    const l = listing('hage', [
      { label: 'Hva gjelder det?', value: 'Plen, Hekk, Annet' },
      { label: 'Omtrentlig størrelse', value: 'ca. 300 m²' },
      { label: 'Skal hageavfall kjøres bort?', value: 'Ja' },
    ]);
    expect(checklistSuggestions(l)).toEqual(['Plen', 'Hekk', 'Kjøre bort hageavfall']);
  });

  it('leaves out what is already on the list, ignoring case', () => {
    const l = listing('hage', [{ label: 'Hva gjelder det?', value: 'Plen, Hekk' }]);
    expect(checklistSuggestions(l, ['plen '])).toEqual(['Hekk']);
  });

  it('does not suggest a «Nei» answer or descriptive answers like the animal', () => {
    expect(checklistSuggestions(listing('hage', [{ label: 'Skal hageavfall kjøres bort?', value: 'Nei' }]))).toEqual([]);
    expect(checklistSuggestions(listing('dyrepass', [{ label: 'Hvilket dyr?', value: 'Hund, Katt' }]))).toEqual([]);
  });

  it('gives nothing for an oppdrag without answers', () => {
    expect(checklistSuggestions(undefined)).toEqual([]);
    expect(checklistSuggestions(listing('hage', []))).toEqual([]);
  });
});
