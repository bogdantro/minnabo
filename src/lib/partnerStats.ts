import { apiClient } from '@/api/client';

/**
 * Statistics for partners (website › partner portal): an impression when a partner card
 * has been at least half visible for a second – once per partner per app session – and a
 * click on "Besøk nettsiden". The database ignores hidden partners (log_partner_event).
 * Logging never blocks or fails anything the person does.
 */
const logged = new Set<string>();

export const impressionLogged = (partnerId: string): boolean => logged.has(partnerId);

/** The viewer's kommune, reported with impressions (set by the screen that shows the partners). */
let viewerKommune: string | undefined;
export function setPartnerStatsKommune(kommune: string | undefined): void {
  viewerKommune = kommune || undefined;
}

export function logPartnerImpression(partnerId: string, kommune: string | undefined = viewerKommune): void {
  if (logged.has(partnerId)) return;
  logged.add(partnerId);
  apiClient.logPartnerEvent(partnerId, 'impression', kommune).catch(() => undefined);
}

export function logPartnerClick(partnerId: string, kommune?: string): void {
  apiClient.logPartnerEvent(partnerId, 'click', kommune).catch(() => undefined);
}

/** Tests only. */
export function _resetPartnerStats(): void {
  logged.clear();
  viewerKommune = undefined;
}

export type Rect = { x: number; y: number; width: number; height: number };

/** How much of `rect` is inside the window (0–1). */
export function visibleRatio(rect: Rect, win: { width: number; height: number }): number {
  const area = rect.width * rect.height;
  if (area <= 0) return 0;
  const w = Math.min(rect.x + rect.width, win.width) - Math.max(rect.x, 0);
  const h = Math.min(rect.y + rect.height, win.height) - Math.max(rect.y, 0);
  return w <= 0 || h <= 0 ? 0 : (w * h) / area;
}

export const IMPRESSION_RATIO = 0.5;
export const IMPRESSION_MS = 1000;

/**
 * Turns "how visible is card X right now" into "X was seen": the card must stay at or above
 * IMPRESSION_RATIO for IMPRESSION_MS without dropping below it.
 */
export class ImpressionWatcher {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private onSeen: (id: string) => void, private delay = IMPRESSION_MS) {}

  update(id: string, ratio: number): void {
    if (ratio >= IMPRESSION_RATIO) {
      if (this.timers.has(id)) return;
      this.timers.set(
        id,
        setTimeout(() => {
          this.timers.delete(id);
          this.onSeen(id);
        }, this.delay),
      );
    } else {
      const t = this.timers.get(id);
      if (t) {
        clearTimeout(t);
        this.timers.delete(id);
      }
    }
  }

  dispose(): void {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }
}
