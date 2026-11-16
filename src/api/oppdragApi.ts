import type { InboxApi } from './inboxApi';

/** The Oppdrag part of the API (migration 0110). ApiClient extends it. */
export interface OppdragApi extends InboxApi {
  /** How many open tilbud each oppdrag has («Ingen tilbud ennå – vær først»). At most 100 ids. */
  listingOfferCounts(listingIds: string[]): Promise<Record<string, number>>;
  /** The owners among these who usually answer within an hour («Svarer raskt»). */
  fastResponders(profileIds: string[]): Promise<string[]>;
  /** Anonymous: the word and the kommune only. */
  logSearchTerm(municipality: string, term: string): Promise<void>;
  /** What people in the kommune search for most (each searched at least 3 times). */
  popularSearchTerms(municipality: string): Promise<string[]>;
}
