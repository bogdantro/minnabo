import { formatDayLabel } from '@/lib/calendar';

// Local-time constructor (month is 0-indexed) to stay timezone-stable.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);
const now = at(2026, 8, 29);

test('formatDayLabel labels today and yesterday', () => {
  expect(formatDayLabel(at(2026, 8, 29, 8), now)).toBe('I dag');
  expect(formatDayLabel(at(2026, 8, 28, 22), now)).toBe('I går');
});

test('formatDayLabel uses the weekday name within the past week', () => {
  // 2026-08-24 is a Monday
  expect(formatDayLabel(at(2026, 8, 24, 9), now)).toBe('mandag');
});

test('formatDayLabel falls back to a full date for older messages', () => {
  expect(formatDayLabel(at(2026, 7, 30, 9), now)).toBe('30. juli 2026');
});
