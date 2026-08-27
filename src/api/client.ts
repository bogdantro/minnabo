import type { Listing, ListingFilter, ListingSort } from '@/domain/types';
import { repositories } from '@/data/repositories';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type ListListingsParams = {
  filter?: ListingFilter;
  sort?: ListingSort;
};

/**
 * Mock API client. The method surface mirrors a future REST API so that
 * swapping in a real backend later means replacing only this file.
 */
export class MockApiClient {
  async listListings(params: ListListingsParams = {}): Promise<Listing[]> {
    await delay(250);
    return repositories.listings.list(params.filter, params.sort);
  }

  async getListing(id: string): Promise<Listing> {
    await delay(200);
    const listing = repositories.listings.get(id);
    if (!listing) {
      throw new Error('Fant ikke oppføringen.');
    }
    return listing;
  }
}

export const apiClient = new MockApiClient();
