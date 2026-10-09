import type { ListingExtras } from '@/api/ApiClient';
import type { Listing } from '@/domain/types';

/** The oppdrag being previewed (from the Legg ut wizard), plus how to save it. */
type Meta = { extras?: ListingExtras; editId?: string; /** where to land after saving an edit */ back?: string };

let draft: Listing | null = null;
let meta: Meta = {};

export const draftStore = {
  set: (listing: Listing, m: Meta = {}) => {
    draft = listing;
    meta = m;
  },
  get: (): Listing | null => draft,
  meta: (): Meta => meta,
  clear: () => {
    draft = null;
    meta = {};
  },
};
