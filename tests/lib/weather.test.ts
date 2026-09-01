import { outdoorWarningFor } from '@/lib/weather';

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

test('no warning for an indoor category', () => {
  expect(outdoorWarningFor('datahjelp', inDays(2))).toBeNull();
});

test('no warning outside the 7-day forecast window', () => {
  expect(outdoorWarningFor('hage', inDays(20))).toBeNull();
});

test('a stable verdict for the same outdoor date', () => {
  const date = inDays(3);
  expect(outdoorWarningFor('hage', date)).toEqual(outdoorWarningFor('hage', date));
});
