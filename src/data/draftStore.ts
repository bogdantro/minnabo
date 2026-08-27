import type { Listing } from '@/domain/types';

let draft: Listing | null = null;

export const draftStore = {
  set: (listing: Listing) => {
    draft = listing;
  },
  get: (): Listing | null => draft,
  clear: () => {
    draft = null;
  },
};
