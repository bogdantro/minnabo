import { DEFAULT_NOTIFICATION_PREFS, withDefaultPrefs } from '@/api/ApiClient';

test('new oppdrag and oppslag i nabolaget are on by default, stille timer is off', () => {
  const p = withDefaultPrefs({}); // someone who never opened Varslinger
  expect(p.push.match).toBe(true);
  expect(p.push.board).toBe(true);
  expect(p.quiet.on).toBe(false);
  expect(DEFAULT_NOTIFICATION_PREFS.quiet).toMatchObject({ from: '22:00', to: '07:00' }); // ready when switched on
});

test('a choice the person made themselves still wins over the defaults', () => {
  const p = withDefaultPrefs({ push: { ...DEFAULT_NOTIFICATION_PREFS.push, board: false }, quiet: { on: true, from: '23:00', to: '06:00' } });
  expect(p.push.board).toBe(false);
  expect(p.quiet).toEqual({ on: true, from: '23:00', to: '06:00' });
});
