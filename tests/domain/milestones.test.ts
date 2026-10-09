import { milestonesFor } from '@/domain/milestones';

test('no badges for a new profile', () => {
  expect(milestonesFor({})).toEqual([]);
  expect(milestonesFor({ completedTasks: 4, replyMinutes: 180, rating: { average: 5, count: 2 } })).toEqual([]);
});

test('oppdrag fullført shows the highest step reached', () => {
  expect(milestonesFor({ completedTasks: 5 }).map((m) => m.label)).toEqual(['5 oppdrag fullført']);
  expect(milestonesFor({ completedTasks: 24 }).map((m) => m.label)).toEqual(['10 oppdrag fullført']);
  expect(milestonesFor({ completedTasks: 120 }).map((m) => m.label)).toEqual(['50 oppdrag fullført']);
});

test('quick replies and high vurderinger', () => {
  const m = milestonesFor({ completedTasks: 12, replyMinutes: 35, rating: { average: 4.9, count: 8 } });
  expect(m.map((x) => x.label)).toEqual(['10 oppdrag fullført', 'Rask til å svare', 'Toppvurdert']);
  // an unknown reply time is not "fast"; 4,7 is not top
  expect(milestonesFor({ replyMinutes: null, rating: { average: 4.7, count: 30 } })).toEqual([]);
});
