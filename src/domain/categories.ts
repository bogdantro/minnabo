import type { Category } from './types';

/**
 * The fixed category catalogue (spec §5). Single source of truth for the app;
 * `supabase/seed_static.sql` mirrors the slug/label/icon rows into the DB.
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
