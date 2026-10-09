import type { JobParty, JobPhotoPhase, JobWorkspace, MaterialPayer } from '@/domain/types';

// Per-agreement working state (checklist / materials / time tracker). In-memory
// for the mock layer; the real backend gets job_workspaces (migration 0015).

const blank = (proposalId: string): JobWorkspace => ({
  proposalId,
  checklist: [],
  materials: [],
  photos: [],
  timerStartedAt: null,
  timerAccumMs: 0,
  firstStartedAt: null,
  pausedMs: 0,
  pausedAt: null,
  timerStoppedAt: null,
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

  addChecklistItem(proposalId: string, text: string, who?: JobParty): JobWorkspace {
    const w = ws(proposalId);
    return commit({
      ...w,
      checklist: [...w.checklist, { id: id('c'), text: text.trim(), done: false, who }],
    });
  },
  setChecklistWho(proposalId: string, itemId: string, who?: JobParty): JobWorkspace {
    const w = ws(proposalId);
    return commit({ ...w, checklist: w.checklist.map((c) => (c.id === itemId ? { ...c, who } : c)) });
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

  addMaterial(proposalId: string, label: string, amountKr: number, payer: MaterialPayer = 'CLIENT'): JobWorkspace {
    const w = ws(proposalId);
    return commit({
      ...w,
      materials: [...w.materials, { id: id('m'), label: label.trim(), amountKr, payer }],
    });
  },
  removeMaterial(proposalId: string, itemId: string): JobWorkspace {
    const w = ws(proposalId);
    return commit({ ...w, materials: w.materials.filter((m) => m.id !== itemId) });
  },

  addPhoto(proposalId: string, url: string, phase: JobPhotoPhase, caption?: string): JobWorkspace {
    const w = ws(proposalId);
    return commit({
      ...w,
      photos: [...w.photos, { id: id('ph'), url, phase, caption: caption?.trim() || undefined, at: new Date().toISOString() }],
    });
  },
  removePhoto(proposalId: string, itemId: string): JobWorkspace {
    const w = ws(proposalId);
    return commit({ ...w, photos: w.photos.filter((p) => p.id !== itemId) });
  },

  toggleTimer(proposalId: string): JobWorkspace {
    const w = ws(proposalId);
    const now = Date.now();
    if (w.timerStartedAt == null) {
      return commit({
        ...w,
        timerStartedAt: now,
        firstStartedAt: w.firstStartedAt ?? now,
        pausedMs: w.pausedMs + (w.pausedAt ? now - w.pausedAt : 0),
        pausedAt: null,
        timerStoppedAt: null,
      });
    }
    return commit({ ...w, timerStartedAt: null, timerAccumMs: w.timerAccumMs + (now - w.timerStartedAt), pausedAt: now });
  },

  stopTimer(proposalId: string): JobWorkspace {
    const w = ws(proposalId);
    const now = Date.now();
    return commit({
      ...w,
      timerAccumMs: w.timerAccumMs + (w.timerStartedAt ? now - w.timerStartedAt : 0),
      timerStartedAt: null,
      pausedMs: w.pausedMs + (w.pausedAt ? now - w.pausedAt : 0),
      pausedAt: null,
      timerStoppedAt: now,
    });
  },

  _reset() {
    store = {};
  },
};
