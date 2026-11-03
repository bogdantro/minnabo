import type { CategoryId } from '@/theme/theme';

/**
 * The categories a youth account works in: the oppdrag the youth app lists, and what a youth may offer as
 * «Tilbyr hjelp». The database checks the same list (youth_offer_category, migration 0084) – change both.
 */
export const YOUTH_CATS: CategoryId[] = ['hage', 'dyrepass', 'data', 'snomaking'];
