import { isProposalExpired, proposalExpiresInDays } from '@/domain/proposal';
import type { Proposal } from '@/domain/types';

const base = (over: Partial<Proposal>): Proposal =>
  ({
    id: 'p',
    listingId: 'l',
    conversationId: 'c',
    fromProfileId: 'a',
    toProfileId: 'b',
    price: { amountMinor: 10000, currency: 'NOK' },
    status: 'SENT',
    createdAt: new Date().toISOString(),
    ...over,
  }) as Proposal;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

test('a SENT proposal older than a week is expired', () => {
  expect(isProposalExpired(base({ createdAt: daysAgo(8) }))).toBe(true);
  expect(isProposalExpired(base({ createdAt: daysAgo(3) }))).toBe(false);
});

test('accepted proposals never expire', () => {
  expect(isProposalExpired(base({ status: 'ACCEPTED', createdAt: daysAgo(30) }))).toBe(false);
});

test('expiresInDays counts down from the TTL', () => {
  expect(proposalExpiresInDays(base({ createdAt: daysAgo(5) }))).toBe(2);
});
