import type { CategoryId } from '@/theme/theme';
import type { Category } from './types';

/**
 * The fixed category catalogue (spec §5). Single source of truth for the app;
 * `supabase/migrations/0023_seed_categories.sql` mirrors the rows into the DB.
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
  { id: 'c-annet', slug: 'annet', label: 'Annet', icon: 'more-horizontal' },
];

const FALLBACK = CATEGORIES[CATEGORIES.length - 1];

export function categoryBySlug(slug: string): Category {
  return CATEGORIES.find((c) => c.slug === slug) ?? FALLBACK;
}

/** The 5 chips on the Oppdrag front page (homepage.png). */
export const HOME_CATEGORIES: Category[] = [
  { id: 'c-alle', slug: 'alle', label: 'Alle', icon: 'grid' },
  categoryBySlug('hage'),
  { id: 'c-renhold-home', slug: 'renhold', label: 'Renhold', icon: 'droplet' },
  { id: 'c-transport-home', slug: 'transport', label: 'Transport', icon: 'truck' },
  categoryBySlug('montering'),
];

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
  annet: 'annet',
};

export function categoryArtId(slug: string): CategoryId {
  return ART_BY_SLUG[slug] ?? 'annet';
}

/** Design category id → listing slug (inverse of `categoryArtId`). */
export function slugForArtId(id: CategoryId): string {
  return Object.keys(ART_BY_SLUG).find((s) => ART_BY_SLUG[s] === id) ?? 'annet';
}
