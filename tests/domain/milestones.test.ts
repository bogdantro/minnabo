import { milestonesFor } from '@/domain/milestones';

test('no badges for a new profile', () => {
  expect(milestonesFor({})).toEqual([]);
  expect(milestonesFor({ completedTasks: 0, replyMinutes: 180, rating: { average: 5, count: 2 } })).toEqual([]);
  // a few jobs done: only «Første jobb», slow replies and few vurderinger earn nothing
  expect(milestonesFor({ completedTasks: 4, replyMinutes: 180, rating: { average: 5, count: 2 } }).map((m) => m.key)).toEqual(['first']);
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

test('«Første jobb» until the 5-step takes over', () => {
  expect(milestonesFor({ completedTasks: 1 }).map((m) => m.key)).toEqual(['first']);
  expect(milestonesFor({ completedTasks: 5 }).map((m) => m.key)).toEqual(['jobs']);
});

test('«Møter alltid opp», «Hjelper i nabolaget ditt» and «Verver»', () => {
  const m = milestonesFor({ completedTasks: 6, alwaysShowsUp: true, sameKommune: true, invitedCount: 2 });
  expect(m.map((x) => x.label)).toEqual(['5 oppdrag fullført', 'Møter alltid opp', 'Hjelper i nabolaget ditt', 'Verver']);
  // a neighbour who has never done a job isn't "helping" yet
  expect(milestonesFor({ sameKommune: true }).map((x) => x.key)).toEqual([]);
});
