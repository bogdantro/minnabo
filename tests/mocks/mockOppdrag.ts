/** The Oppdrag part of the in-memory client (0110). MockApiClient extends it. */
import type { OppdragApi } from '@/api/oppdragApi';
import { chatRepository } from '@mocks/data/chatRepository';
import { MockInbox } from './mockInbox';

function fresh() {
  return {
    terms: {} as Record<string, Record<string, number>>,
    fast: ['u-emma', 'u-jonas'] as string[],
  };
}

export const oppdragMock = {
  ...fresh(),
  _reset() {
    Object.assign(oppdragMock, fresh());
  },
};

export class MockOppdrag extends MockInbox implements OppdragApi {
  async listingOfferCounts(listingIds: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const id of listingIds) out[id] = chatRepository.proposalsForListing(id).filter((p) => ['SENT', 'REVISION_PENDING', 'ACCEPTED'].includes(p.status)).length;
    return out;
  }

  async fastResponders(profileIds: string[]): Promise<string[]> {
    return profileIds.filter((id) => oppdragMock.fast.includes(id));
  }

  async logSearchTerm(municipality: string, term: string): Promise<void> {
    const t = term.trim().toLowerCase();
    if (!/^[a-zæøåé ]{2,40}$/.test(t)) return;
    const k = (oppdragMock.terms[municipality] ??= {});
    k[t] = (k[t] ?? 0) + 1;
  }

  async popularSearchTerms(municipality: string): Promise<string[]> {
    const seeded = municipality === 'Lillehammer' ? { snømåking: 9, plenklipping: 7, flytting: 5, vinduspuss: 4 } : {};
    const all = { ...seeded, ...(oppdragMock.terms[municipality] ?? {}) } as Record<string, number>;
    return Object.entries(all)
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([t]) => t);
  }
}
