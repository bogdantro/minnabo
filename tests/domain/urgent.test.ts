import { isUrgent, urgentDayLabel, urgentDeadline, urgentFirst } from '@/domain/urgent';
import { applyUrgency, buildListing, emptyWizard, extrasFor, summary, upcomingDays, wizardFromListing } from '@/screens/LeggUt/wizardModel';

// Fri 30 Oct 2026, 10:00 local
const NOW = new Date(2026, 9, 30, 10, 0);

test('the deadline is the end of the chosen day', () => {
  expect(urgentDeadline('today', NOW)).toEqual(new Date(2026, 9, 30, 23, 59, 59, 999));
  expect(urgentDeadline('tomorrow', NOW)).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999));
  expect(urgentDeadline('days3', NOW)).toEqual(new Date(2026, 10, 2, 23, 59, 59, 999));
});

test('an oppdrag stops hasting when the deadline has passed', () => {
  const until = urgentDeadline('today', NOW).toISOString();
  expect(isUrgent({ urgentUntil: until }, NOW.getTime())).toBe(true);
  expect(isUrgent({ urgentUntil: until }, new Date(2026, 9, 31, 0, 1).getTime())).toBe(false);
  expect(isUrgent({}, NOW.getTime())).toBe(false);
});

test('haste goes first, soonest deadline on top, the rest keeps its order', () => {
  const t = NOW.getTime();
  const at = (h: number) => new Date(t + h * 3600000).toISOString();
  const list = [
    { id: 'a' },
    { id: 'b', urgentUntil: at(30) },
    { id: 'c', urgentUntil: at(-1) }, // expired: back in its normal place
    { id: 'd', urgentUntil: at(5) },
    { id: 'e' },
  ];
  expect(urgentFirst(list, t).map((l) => l.id)).toEqual(['d', 'b', 'a', 'c', 'e']);
});

test('the deadline reads «i dag», «i morgen» or the day', () => {
  expect(urgentDayLabel(urgentDeadline('today', NOW).toISOString(), NOW)).toBe('i dag');
  expect(urgentDayLabel(urgentDeadline('tomorrow', NOW).toISOString(), NOW)).toBe('i morgen');
  expect(urgentDayLabel(urgentDeadline('days3', NOW).toISOString(), NOW)).toBe('man 2. nov');
});

test('choosing how soon sets «Når» to innen that day, and the oppdrag gets the deadline', () => {
  const days = upcomingDays(NOW);
  const s = { ...emptyWizard('Lillehammer'), cat: 'hage' as const, title: 'Klippe plen', ...applyUrgency('tomorrow', days) };
  expect(s).toMatchObject({ whenMode: 'innen', days: ['2026-10-31'] });
  expect(summary(s, days).stedTid[1].v).toBe('Haster · Innen lør 31. okt');
  const until = new Date(2026, 9, 31, 23, 59, 59, 999).toISOString();
  expect(buildListing(s, days).urgentUntil).toBe(until);
  expect(extrasFor(s, NOW).urgentUntil).toBe(until);
  // no «Haster: Ja» detail row any more – urgency is its own field
  expect(buildListing(s, days).task?.intake).not.toContainEqual({ label: 'Haster', value: 'Ja' });
});

test('not hasting sends no deadline', () => {
  expect(extrasFor(emptyWizard(), NOW).urgentUntil).toBeNull();
});

test('editing an old oppdrag with a «Haster: Ja» row does not make it haste', () => {
  const days = upcomingDays(NOW);
  const l = buildListing({ ...emptyWizard('Lillehammer'), cat: 'hage', title: 'Klippe plen' }, days);
  const old = { ...l, task: { ...l.task!, intake: [{ label: 'Haster', value: 'Ja' }] } };
  expect(wizardFromListing(old, null).urgent).toBe(false);
  const live = { ...l, urgentUntil: new Date(Date.now() + 3600000).toISOString() };
  expect(wizardFromListing(live, null).urgent).toBe(true);
});
