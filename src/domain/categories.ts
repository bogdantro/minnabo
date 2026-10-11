import { categoryColors, categoryLabels, type CategoryId } from '@/theme/theme';
import type { Category } from './types';

/**
 * The built-in category catalogue: the app's icons and the offline fallback. The live
 * list (order, on/off, labels, colours) comes from public.categories – see the bottom of
 * this file.
 */
export const CATEGORIES: Category[] = [
  { id: 'c-hage', slug: 'hage', label: 'Hage', icon: 'feather' },
  { id: 'c-renhold', slug: 'renhold', label: 'Rengjøring', icon: 'droplet' },
  { id: 'c-flytting', slug: 'flytting', label: 'Flytting/bæring', icon: 'package' },
  { id: 'c-transport', slug: 'transport', label: 'Transport/levering', icon: 'truck' },
  { id: 'c-montering', slug: 'montering', label: 'Montering', icon: 'tool' },
  { id: 'c-snomaking', slug: 'snomaking', label: 'Snømåking', icon: 'cloud-snow' },
  { id: 'c-maling', slug: 'maling', label: 'Maling/vedlikehold', icon: 'edit-3' },
  { id: 'c-dyrepass', slug: 'dyrepass', label: 'Dyrepass', icon: 'heart' },
  { id: 'c-datahjelp', slug: 'datahjelp', label: 'Datahjelp', icon: 'monitor' },
  { id: 'c-arrangement', slug: 'arrangement', label: 'Arrangementshjelp', icon: 'calendar' },
  { id: 'c-snekring', slug: 'snekring', label: 'Snekring/småreparasjoner', icon: 'snekring' },
  { id: 'c-vinduspuss', slug: 'vinduspuss', label: 'Vinduspuss', icon: 'vinduspuss' },
  { id: 'c-bilpleie', slug: 'bilpleie', label: 'Bilpleie', icon: 'bilpleie' },
  { id: 'c-handling', slug: 'handling', label: 'Handling og ærender', icon: 'handling' },
  { id: 'c-leksehjelp', slug: 'leksehjelp', label: 'Leksehjelp', icon: 'leksehjelp' },
  { id: 'c-husvakt', slug: 'husvakt', label: 'Hus- og plantevakt', icon: 'husvakt' },
  { id: 'c-ved', slug: 'ved', label: 'Ved og fyring', icon: 'ved' },
  { id: 'c-bortkjoring', slug: 'bortkjoring', label: 'Bortkjøring og rydding', icon: 'bortkjoring' },
  { id: 'c-sykkel', slug: 'sykkel', label: 'Sykkelreparasjon', icon: 'sykkel' },
  { id: 'c-matlaging', slug: 'matlaging', label: 'Matlaging og baking', icon: 'matlaging' },
  { id: 'c-selskap', slug: 'selskap', label: 'Selskap og følge', icon: 'selskap' },
  { id: 'c-barnevakt', slug: 'barnevakt', label: 'Barnevakt', icon: 'barnevakt' },
  { id: 'c-annet', slug: 'annet', label: 'Annet', icon: 'more-horizontal' },
];

const FALLBACK = CATEGORIES[CATEGORIES.length - 1];

export function categoryBySlug(slug: string): Category {
  const c = CATEGORIES.find((x) => x.slug === slug) ?? FALLBACK;
  // the label the admin set, when the live catalogue has one
  const live = getCategoryCatalog().find((e) => e.slug === c.slug)?.label;
  return live && live !== c.label ? { ...c, label: live } : c;
}

/** Listing category slug → design category art id (`theme.categoryColors` / `theme.icons`). */
const ART_BY_SLUG: Record<string, CategoryId> = {
  hage: 'hage',
  renhold: 'rengjoring',
  flytting: 'flytting',
  transport: 'transport',
  montering: 'montering',
  snomaking: 'snomaking',
  maling: 'maling',
  dyrepass: 'dyrepass',
  datahjelp: 'data',
  arrangement: 'arrangement',
  snekring: 'snekring',
  vinduspuss: 'vinduspuss',
  bilpleie: 'bilpleie',
  handling: 'handling',
  leksehjelp: 'leksehjelp',
  husvakt: 'husvakt',
  ved: 'ved',
  bortkjoring: 'bortkjoring',
  sykkel: 'sykkel',
  matlaging: 'matlaging',
  selskap: 'selskap',
  barnevakt: 'barnevakt',
  annet: 'annet',
};

export function categoryArtId(slug: string): CategoryId {
  return ART_BY_SLUG[slug] ?? 'annet';
}

/** Design category id → listing slug (inverse of `categoryArtId`). */
export function slugForArtId(id: CategoryId): string {
  return Object.keys(ART_BY_SLUG).find((s) => ART_BY_SLUG[s] === id) ?? 'annet';
}

// ---------------------------------------------------------------------------
// Live catalogue. The website's admin decides the order, which categories are on,
// their labels and tile colours (public.categories). The app starts from the built-in
// list above (also the offline fallback) and swaps in the database's version when it
// arrives. Icons are the app's own, so a slug the app doesn't know is ignored until an
// app update adds it.
// ---------------------------------------------------------------------------

/** One row of public.categories, as the app reads it. */
export type CategoryRow = {
  slug: string;
  label: string;
  tileBg?: string | null;
  iconColor?: string | null;
  active: boolean;
  sortOrder: number;
};

export type CatalogEntry = { art: CategoryId; slug: string; label: string; bg: string; fg: string; active: boolean; sortOrder: number };

const HEX = /^#[0-9a-f]{3,8}$/i;

const builtIn = (): CatalogEntry[] =>
  CATEGORIES.map((c, i) => {
    const art = categoryArtId(c.slug);
    return { art, slug: c.slug, label: categoryLabels[art] ?? c.label, ...staticColors(art), active: true, sortOrder: (i + 1) * 10 };
  });

function staticColors(art: CategoryId): { bg: string; fg: string } {
  const c = categoryColors[art] ?? categoryColors.annet;
  return { bg: c.bg, fg: c.fg };
}

let catalog: CatalogEntry[] = builtIn();
const subscribers = new Set<() => void>();

/** Replace the catalogue with the database's rows (unknown slugs are skipped; missing ones keep the built-in entry, switched off). */
export function setCategoryCatalog(rows: CategoryRow[] | null | undefined): void {
  if (!rows || rows.length === 0) return;
  const known = new Map(builtIn().map((e) => [e.slug, e]));
  const next: CatalogEntry[] = [];
  for (const r of rows) {
    const base = known.get(r.slug);
    if (!base) continue;
    known.delete(r.slug);
    next.push({
      ...base,
      label: r.label?.trim() || base.label,
      bg: r.tileBg && HEX.test(r.tileBg) ? r.tileBg : base.bg,
      fg: r.iconColor && HEX.test(r.iconColor) ? r.iconColor : base.fg,
      active: r.active !== false,
      sortOrder: Number.isFinite(r.sortOrder) ? r.sortOrder : base.sortOrder,
    });
  }
  // a built-in category the database doesn't have: still resolvable for old oppdrag, not offered
  known.forEach((e) => next.push({ ...e, active: false }));
  next.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'nb'));
  catalog = next;
  subscribers.forEach((l) => l());
}

/** Tests only. */
export function _resetCategoryCatalog(): void {
  catalog = builtIn();
  subscribers.forEach((l) => l());
}

export const subscribeCategoryCatalog = (l: () => void): (() => void) => {
  subscribers.add(l);
  return () => {
    subscribers.delete(l);
  };
};
export const getCategoryCatalog = (): CatalogEntry[] => catalog;

/** Art ids of the categories that are switched on, in the admin's order (chips, Legg ut, filters). */
export const activeCategoryArts = (): CategoryId[] => catalog.filter((e) => e.active).map((e) => e.art);

const entry = (art: CategoryId): CatalogEntry | undefined => catalog.find((e) => e.art === art);

/** The label for a category – also for one that has been switched off (old oppdrag keep showing it). */
export const categoryLabel = (art: CategoryId): string => entry(art)?.label ?? categoryLabels[art] ?? categoryLabels.annet;

/** Tile background + icon colour for a category. */
export const categoryArtColors = (art: CategoryId): { bg: string; fg: string } => {
  const e = entry(art);
  return e ? { bg: e.bg, fg: e.fg } : staticColors(art);
};
