/**
 * What the Oppdrag tab knows about its cards (0110), shared with OppdragCard through a context so other screens
 * stay as they were: tilbud counts, «Svarer raskt», my nabolag, what I opened, the compact list, the card menu.
 * Also the lists kept on this phone: hidden oppdrag and hidden categories.
 */
import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Listing } from '@/domain/types';
import { apiClient } from '@/api/client';

export const HIDDEN_KEY = 'minnabo.hiddenListings.v1';
export const HIDDEN_CATS_KEY = 'minnabo.hiddenCategories.v1';
export const COMPACT_KEY = 'minnabo.compactFeed.v1';

export type FeedInfo = {
  offerCounts: Record<string, number>;
  fast: Set<string>;
  nabolagPlaces: Set<string>;
  kommune?: string;
  compact: boolean;
  onMenu?: (l: Listing) => void;
};

export const FeedContext = createContext<FeedInfo | null>(null);
export const useFeedInfo = () => useContext(FeedContext);

/** Tilbud counts and fast responders for the cards on screen, one call each. */
export function useFeedFacts(listings: Listing[]) {
  const ids = listings.map((l) => l.id).slice(0, 100);
  const owners = [...new Set(listings.map((l) => l.owner.id))].slice(0, 60);
  const counts = useQuery({
    queryKey: ['listing-offer-counts', ids.join(',')],
    queryFn: () => apiClient.listingOfferCounts(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
  const fast = useQuery({
    queryKey: ['fast-responders', owners.join(',')],
    queryFn: () => apiClient.fastResponders(owners),
    enabled: owners.length > 0,
    staleTime: 10 * 60_000,
  });
  return { offerCounts: counts.data ?? {}, fast: new Set(fast.data ?? []) };
}
