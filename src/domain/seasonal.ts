import type { CategoryId } from '@/theme/theme';

/**
 * What neighbours in Innlandet typically need help with each month, most likely first.
 * Index 0 = January. Snømåking in the winter, hage and maling in the summer, ved in the autumn.
 */
const BY_MONTH: CategoryId[][] = [
  ['snomaking', 'ved', 'husvakt'], // jan
  ['snomaking', 'ved', 'husvakt'], // feb
  ['snomaking', 'rengjoring', 'sykkel'], // mar
  ['hage', 'sykkel', 'vinduspuss'], // apr
  ['hage', 'maling', 'sykkel'], // mai
  ['hage', 'maling', 'husvakt'], // jun
  ['husvakt', 'dyrepass', 'hage'], // jul
  ['hage', 'maling', 'flytting'], // aug
  ['ved', 'hage', 'flytting'], // sep
  ['hage', 'ved', 'bilpleie'], // okt – løv, ved inn, dekkskift
  ['snomaking', 'ved', 'bilpleie'], // nov
  ['snomaking', 'husvakt', 'matlaging'], // des
];

/** Nov → ['snomaking', 'ved', 'bilpleie']. */
export function seasonalCategories(now: Date): CategoryId[] {
  return BY_MONTH[now.getMonth()];
}
