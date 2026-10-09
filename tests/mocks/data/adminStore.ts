import type {
  AdminDayStat,
  AdminListing,
  AdminOverview,
  AdminPartner,
  AdminReport,
  AdminUser,
  ReportOutcome,
} from '@/api/ApiClient';
import type { Partner } from '@/domain/types';
import { profiles } from './seed';
import { repositories } from './repositories';
import { safetyStore } from './safetyStore';
import { businessStore } from './businessStore';
import { noticeboardStore } from './noticeboardStore';

/** Admin moderation state for the mock backend (mirrors 0032_admin.sql). */
let outcomes: Record<string, { outcome: ReportOutcome; at: string }> = {};
let suspended = new Set<string>();
let hidden = new Set<string>();
let mainOverride: Record<string, boolean> = {};
let inactive = new Set<string>();
let heroes = new Set<string>();

const names = (id: string) => Object.values(profiles).find((p) => p.id === id)?.displayName ?? 'Slettet bruker';

function targetText(type: AdminReport['targetType'], id: string): string {
  switch (type) {
    case 'LISTING': {
      const l = repositories.listings.get(id);
      return l ? `«${l.title}»` : 'Innholdet finnes ikke lenger';
    }
    case 'USER': {
      const p = Object.values(profiles).find((x) => x.id === id);
      return p ? `${p.displayName} · ${p.location?.place ?? ''}` : 'Innholdet finnes ikke lenger';
    }
    case 'NOTICE': {
      const n = noticeboardStore.list().find((x) => x.id === id);
      return n ? `«${n.title}» på oppslagstavla` : 'Innholdet finnes ikke lenger';
    }
    default:
      return 'Innholdet finnes ikke lenger';
  }
}

export const adminStore = {
  reports(): AdminReport[] {
    return safetyStore.listReports().map((r) => {
      const o = outcomes[r.id];
      return {
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        details: r.details,
        targetText: targetText(r.targetType, r.targetId),
        byName: names(r.byProfileId),
        createdAt: r.createdAt,
        status: o || safetyStore.isResolved(r.id) ? 'RESOLVED' : 'OPEN',
        outcome: o?.outcome ?? null,
        resolvedAt: o?.at ?? null,
      };
    });
  },
  decideReport(id: string, outcome: ReportOutcome): void {
    const r = safetyStore.listReports().find((x) => x.id === id);
    if (!r) throw new Error('Fant ikke rapporten.');
    if (outcome === 'remove' && r.targetType === 'LISTING') hidden = new Set(hidden).add(r.targetId);
    if (outcome === 'remove' && r.targetType === 'USER') suspended = new Set(suspended).add(r.targetId);
    outcomes = { ...outcomes, [id]: { outcome, at: new Date().toISOString() } };
    safetyStore.resolveReport(id);
  },
  reopenReport(id: string): void {
    const o = outcomes[id];
    const r = safetyStore.listReports().find((x) => x.id === id);
    if (o?.outcome === 'remove' && r?.targetType === 'LISTING') {
      const next = new Set(hidden);
      next.delete(r.targetId);
      hidden = next;
    }
    if (o?.outcome === 'remove' && r?.targetType === 'USER') {
      const next = new Set(suspended);
      next.delete(r.targetId);
      suspended = next;
    }
    const { [id]: _drop, ...rest } = outcomes;
    outcomes = rest;
    safetyStore.reopenReport(id);
  },
  isSuspended: (id: string) => suspended.has(id),
  isHidden: (id: string) => hidden.has(id),

  users(query = ''): AdminUser[] {
    const q = query.trim().toLowerCase();
    return Object.values(profiles)
      .filter((p) => !q || `${p.displayName} ${p.location?.place ?? ''} ${p.location?.municipality ?? ''}`.toLowerCase().includes(q))
      .map((p) => ({
        id: p.id,
        displayName: p.displayName,
        initials: p.initials,
        avatarUrl: p.avatarUrl,
        place: p.location?.place ?? null,
        municipality: p.location?.municipality ?? null,
        memberSince: p.memberSince,
        rating: p.rating?.average ?? null,
        ratingCount: p.rating?.count ?? 0,
        suspended: suspended.has(p.id),
        isAdmin: p.role === 'admin',
      }));
  },
  setSuspended(id: string, on: boolean): void {
    const next = new Set(suspended);
    if (on) next.add(id);
    else next.delete(id);
    suspended = next;
  },

  flaggedListings(): AdminListing[] {
    const byListing = new Map<string, { count: number; last: string; at: string }>();
    for (const r of safetyStore.listReports()) {
      if (r.targetType !== 'LISTING') continue;
      const cur = byListing.get(r.targetId);
      if (!cur) byListing.set(r.targetId, { count: 1, last: r.reason, at: r.createdAt });
      else byListing.set(r.targetId, { count: cur.count + 1, last: r.createdAt > cur.at ? r.reason : cur.last, at: r.createdAt > cur.at ? r.createdAt : cur.at });
    }
    const out: AdminListing[] = [];
    byListing.forEach((v, id) => {
      const l = repositories.listings.get(id);
      if (!l) return;
      out.push({ id, title: l.title, categorySlug: l.category.slug, reportCount: v.count, lastReason: v.last, hidden: hidden.has(id) });
    });
    return out;
  },
  setHidden(id: string, on: boolean): void {
    const next = new Set(hidden);
    if (on) next.add(id);
    else next.delete(id);
    hidden = next;
  },

  partners(all: Partner[]): AdminPartner[] {
    return all.map((p) => ({
      id: p.id,
      name: p.name,
      blurb: p.tagline,
      municipality: p.municipality,
      main: mainOverride[p.id] ?? p.featured,
      active: !inactive.has(p.id),
      hero: heroes.has(p.id),
    }));
  },
  setHero(id: string, on: boolean): void {
    const next = new Set(heroes);
    if (on) next.add(id);
    else next.delete(id);
    heroes = next;
    if (on) adminStore.setActive(id, true);
  },
  setMain(all: Partner[], id: string, on: boolean): void {
    if (on && adminStore.partners(all).filter((p) => p.main && p.id !== id).length >= 4) {
      throw new Error('Maks 4 hovedpartnere.');
    }
    mainOverride = { ...mainOverride, [id]: on };
    if (on) adminStore.setActive(id, true);
  },
  setActive(id: string, on: boolean): void {
    const next = new Set(inactive);
    if (on) next.delete(id);
    else next.add(id);
    inactive = next;
  },
  /** What Fellesskap sees: inactive partners hidden, main flag from the admin. */
  visiblePartners(all: Partner[]): Partner[] {
    return all
      .filter((p) => !inactive.has(p.id))
      .map((p) => ({ ...p, featured: mainOverride[p.id] ?? p.featured, localHero: heroes.has(p.id) || !!p.localHero }));
  },

  overview(): AdminOverview {
    return {
      openReports: adminStore.reports().filter((r) => r.status === 'OPEN').length,
      pendingBusinesses: businessStore.list().filter((b) => b.status === 'PENDING').length,
      newUsersToday: 3,
      activeListings: repositories.listings.list().filter((l) => !hidden.has(l.id)).length,
    };
  },

  weekStats(day?: string): AdminDayStat[] {
    const base = day ? new Date(`${day}T12:00:00Z`) : new Date();
    const mon = new Date(base);
    mon.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));
    const demo = { listings: [18, 22, 19, 25, 31, 14, 11], offers: [41, 48, 44, 57, 63, 29, 24], completed: [9, 12, 10, 14, 17, 21, 15] };
    return demo.listings.map((_, i) => {
      const d = new Date(mon);
      d.setUTCDate(mon.getUTCDate() + i);
      return { day: d.toISOString().slice(0, 10), listings: demo.listings[i], offers: demo.offers[i], completed: demo.completed[i] };
    });
  },

  _reset(): void {
    outcomes = {};
    suspended = new Set();
    hidden = new Set();
    mainOverride = {};
    inactive = new Set();
    heroes = new Set();
  },
};
