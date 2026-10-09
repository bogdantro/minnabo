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
