import type { Listing } from '@/domain/types';
import { matchesWhen, meetsBudget, whenDays } from '@/domain/listingFilters';

const task = (days?: string[], extra: Partial<Listing> = {}) =>
  ({ type: 'TASK_REQUEST', task: { description: '', scheduledDays: days }, ...extra }) as unknown as Listing;
const offer = (weekdays?: number[]) => ({ type: 'SERVICE_OFFER', offer: { about: '', services: [], availableWeekdays: weekdays } }) as unknown as Listing;

// Friday 6 November 2026
const FRIDAY = new Date(2026, 10, 6, 12);
const SUNDAY = new Date(2026, 10, 8, 12);

test('«I helgen» on a Friday is the coming Saturday and Sunday', () => {
  expect(whenDays('WEEKEND', FRIDAY).map((d) => d.getDate())).toEqual([7, 8]);
});

test('«I helgen» on a Sunday is today, not next weekend', () => {
  expect(whenDays('WEEKEND', SUNDAY).map((d) => d.getDate())).toEqual([8]);
});

test('«Neste uke» starts on Monday, also seen from a Sunday', () => {
  expect(whenDays('NEXT_WEEK', FRIDAY)[0].getDate()).toBe(9);
  expect(whenDays('NEXT_WEEK', SUNDAY)[0].getDate()).toBe(9);
  expect(whenDays('NEXT_WEEK', FRIDAY)).toHaveLength(7);
});

test('an oppdrag matches on its real days', () => {
  expect(matchesWhen(task(['2026-11-07']), 'WEEKEND', FRIDAY)).toBe(true);
  expect(matchesWhen(task(['2026-11-20']), 'WEEKEND', FRIDAY)).toBe(false);
});

test('an old oppdrag with only a free-text time does not match a day filter', () => {
  expect(matchesWhen(task(undefined), 'TODAY', FRIDAY)).toBe(false);
});

test('a «Tilbyr hjelp» matches on its weekdays', () => {
  expect(matchesWhen(offer([6]), 'WEEKEND', FRIDAY)).toBe(true);
  expect(matchesWhen(offer([1]), 'WEEKEND', FRIDAY)).toBe(false);
});

test('a helper who has named no days has ruled none out', () => {
  expect(matchesWhen(offer([]), 'TODAY', FRIDAY)).toBe(true);
});

test('«Ønsker tilbud» never passes a minimum amount', () => {
  expect(meetsBudget(task(undefined), 500)).toBe(false);
});

test('an hourly price is compared on the whole job', () => {
  const l = task(undefined, { priceMode: 'HOURLY', price: { amountMinor: 30000, currency: 'NOK' }, estimatedMinutes: 240 });
  expect(meetsBudget(l, 1000)).toBe(true);
  expect(meetsBudget(l, 1500)).toBe(false);
});
