import { daysUntil, parseAgreedTime, parseDurationHours } from '@/lib/deviceCalendar';

const now = new Date(2026, 8, 30, 12, 0); // 30 Sep 2026

test('reads date and time from the free-text agreement time', () => {
  const d = parseAgreedTime('Lør 10. okt kl. 10:00', now)!;
  expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 10, 10, 0]);
  expect(daysUntil(d, now)).toBe(10);
});

test('a passed date rolls to next year; text without a date gives null', () => {
  expect(parseAgreedTime('3. jan', now)!.getFullYear()).toBe(2027);
  expect(parseAgreedTime('Fredag ettermiddag', now)).toBeNull();
});

test('duration text becomes hours', () => {
  expect(parseDurationHours('ca. 5 t')).toBe(5);
  expect(parseDurationHours('Omtrent 1–2 timer')).toBe(1);
  expect(parseDurationHours('Omtrent en dag')).toBe(8);
  expect(parseDurationHours(undefined)).toBe(2);
});
