import { jobWorkspaceStore } from '@/data/jobWorkspaceStore';

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

test('materials log keeps a running total', () => {
  jobWorkspaceStore.addMaterial('p-3', 'Parkering', 60);
  const ws = jobWorkspaceStore.addMaterial('p-3', 'Maling', 340);
  expect(ws.materials.reduce((s, m) => s + m.amountKr, 0)).toBe(400);
});
