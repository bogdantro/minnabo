import type { JobWorkspace } from '@/domain/types';

// Per-agreement working state (checklist / materials / time tracker). In-memory
// for the mock layer; the real backend gets job_workspaces (migration 0015).

const blank = (proposalId: string): JobWorkspace => ({
  proposalId,
  checklist: [],
  materials: [],
  photos: [],
  timerStartedAt: null,
  timerAccumMs: 0,
});

let store: Record<string, JobWorkspace> = {};
let seq = 0;
const id = (p: string) => `${p}-${Date.now()}-${seq++}`;

function ws(proposalId: string): JobWorkspace {
  store[proposalId] ??= blank(proposalId);
  return store[proposalId];
}
const commit = (next: JobWorkspace): JobWorkspace => {
  store = { ...store, [next.proposalId]: next };
  return next;
};

export const jobWorkspaceStore = {
  get: (proposalId: string): JobWorkspace => ({ ...ws(proposalId) }),

  addChecklistItem(proposalId: string, text: string): JobWorkspace {
    const w = ws(proposalId);
    return commit({
      ...w,
      checklist: [...w.checklist, { id: id('c'), text: text.trim(), done: false }],
    });
  },
  toggleChecklistItem(proposalId: string, itemId: string): JobWorkspace {
    const w = ws(proposalId);
    return commit({
      ...w,
      checklist: w.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)),
    });
  },
  removeChecklistItem(proposalId: string, itemId: string): JobWorkspace {
    const w = ws(proposalId);
    return commit({ ...w, checklist: w.checklist.filter((c) => c.id !== itemId) });
  },

  addMaterial(proposalId: string, label: string, amountKr: number): JobWorkspace {
    const w = ws(proposalId);
    return commit({
      ...w,
      materials: [...w.materials, { id: id('m'), label: label.trim(), amountKr }],
    });
  },
  removeMaterial(proposalId: string, itemId: string): JobWorkspace {
    const w = ws(proposalId);
    return commit({ ...w, materials: w.materials.filter((m) => m.id !== itemId) });
  },

  addPhoto(proposalId: string, url: string, phase: 'BEFORE' | 'AFTER'): JobWorkspace {
    const w = ws(proposalId);
    return commit({ ...w, photos: [...w.photos, { id: id('ph'), url, phase }] });
  },
  removePhoto(proposalId: string, itemId: string): JobWorkspace {
    const w = ws(proposalId);
    return commit({ ...w, photos: w.photos.filter((p) => p.id !== itemId) });
  },

  toggleTimer(proposalId: string): JobWorkspace {
    const w = ws(proposalId);
    if (w.timerStartedAt == null) {
      return commit({ ...w, timerStartedAt: Date.now() });
    }
    const elapsed = Date.now() - w.timerStartedAt;
    return commit({ ...w, timerStartedAt: null, timerAccumMs: w.timerAccumMs + elapsed });
  },

  _reset() {
    store = {};
  },
};
