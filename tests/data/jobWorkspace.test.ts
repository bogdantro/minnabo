import { jobWorkspaceStore } from '@mocks/data/jobWorkspaceStore';

beforeEach(() => jobWorkspaceStore._reset());

test('checklist items can be added, toggled and removed', () => {
  let ws = jobWorkspaceStore.addChecklistItem('p-1', 'Feie trappa');
  expect(ws.checklist).toHaveLength(1);
  const id = ws.checklist[0].id;

  ws = jobWorkspaceStore.toggleChecklistItem('p-1', id);
  expect(ws.checklist[0].done).toBe(true);

  ws = jobWorkspaceStore.removeChecklistItem('p-1', id);
  expect(ws.checklist).toHaveLength(0);
});

test('the timer accumulates elapsed time across start/stop', () => {
  const started = jobWorkspaceStore.toggleTimer('p-2');
  expect(started.timerStartedAt).not.toBeNull();

  const stopped = jobWorkspaceStore.toggleTimer('p-2');
  expect(stopped.timerStartedAt).toBeNull();
  expect(stopped.timerAccumMs).toBeGreaterThanOrEqual(0);
});

test('before/after photos attach to the workspace', () => {
  jobWorkspaceStore.addPhoto('p-4', 'https://x/before.jpg', 'BEFORE');
  const ws = jobWorkspaceStore.addPhoto('p-4', 'https://x/after.jpg', 'AFTER');
  expect(ws.photos.map((p) => p.phase)).toEqual(['BEFORE', 'AFTER']);
});

test('materials log keeps a running total', () => {
  jobWorkspaceStore.addMaterial('p-3', 'Parkering', 60);
  const ws = jobWorkspaceStore.addMaterial('p-3', 'Maling', 340);
  expect(ws.materials.reduce((s, m) => s + m.amountKr, 0)).toBe(400);
});

test('who, payer, caption and a saved stop are kept on the workspace', () => {
  jobWorkspaceStore._reset();
  const withItem = jobWorkspaceStore.addChecklistItem('p9', 'Vaske gjerdet');
  const item = withItem.checklist[0];
  expect(item.who).toBeUndefined();
  expect(jobWorkspaceStore.setChecklistWho('p9', item.id, 'HELPER').checklist[0].who).toBe('HELPER');
  expect(jobWorkspaceStore.addMaterial('p9', 'Gjerdevask', 119, 'HELPER_OUTLAY').materials[0].payer).toBe('HELPER_OUTLAY');
  const photo = jobWorkspaceStore.addPhoto('p9', 'file:///a.jpg', 'DURING', ' Første strøk ').photos[0];
  expect(photo).toMatchObject({ phase: 'DURING', caption: 'Første strøk' });

  const started = jobWorkspaceStore.toggleTimer('p9');
  expect(started.firstStartedAt).not.toBeNull();
  const paused = jobWorkspaceStore.toggleTimer('p9');
  expect(paused.pausedAt).not.toBeNull();
  const stopped = jobWorkspaceStore.stopTimer('p9');
  expect(stopped.timerStoppedAt).not.toBeNull();
  expect(stopped.pausedAt).toBeNull();
  // starting again clears the stop but keeps the first start
  const again = jobWorkspaceStore.toggleTimer('p9');
  expect(again.timerStoppedAt).toBeNull();
  expect(again.firstStartedAt).toBe(started.firstStartedAt);
});
