import { seenWhen } from '@/lib/datetime';

const now = new Date(2026, 9, 31, 18, 0);

test('«Sett» shows the time today, «i går» yesterday and the date before that', () => {
  expect(seenWhen(new Date(2026, 9, 31, 14, 2).toISOString(), now)).toBe('kl. 14:02');
  expect(seenWhen(new Date(2026, 9, 30, 9, 5).toISOString(), now)).toBe('i går kl. 09:05');
  expect(seenWhen(new Date(2026, 9, 12, 20, 30).toISOString(), now)).toBe('12.10 kl. 20:30');
});
