import { reviewStreak } from '@/domain/reviewStreak';
import type { AgendaItem } from '@/domain/types';

const job = (id: string, extra: Partial<AgendaItem> = {}) =>
  ({ proposalId: id, fullyCompleted: true, cancelled: false, ...extra }) as AgendaItem;

test('counts finished jobs, including the review sent a moment ago', () => {
  const items = [job('a', { myRating: 5 }), job('b'), job('c', { myRating: 4 }), job('d', { fullyCompleted: false }), job('e', { cancelled: true })];
  expect(reviewStreak(items, 'b')).toEqual({ reviewed: 3, total: 3 });
  expect(reviewStreak(items)).toEqual({ reviewed: 2, total: 3 });
});

test('says nothing with fewer than two finished jobs', () => {
  expect(reviewStreak([job('a', { myRating: 5 })], 'a')).toBeNull();
  expect(reviewStreak(undefined)).toBeNull();
});
