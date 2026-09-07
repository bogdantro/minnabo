/**
 * Per-category accent colour (2026 home redesign — newhomepage.png).
 * The job-card price and the category pill both take the accent for the
 * listing's category. Three hues only: green (default / nature), blue
 * (moving & logistics), purple (build & maintenance).
 */

export type CategoryAccent = {
  /** solid accent — price text, pill text/icon */
  color: string;
  /** soft tint — pill background */
  tint: string;
};

const GREEN: CategoryAccent = { color: '#39B54A', tint: '#E9F5EB' };
const BLUE: CategoryAccent = { color: '#2E90C4', tint: '#E4F1F8' };
const PURPLE: CategoryAccent = { color: '#8A7DD4', tint: '#EEEBF8' };

const BY_SLUG: Record<string, CategoryAccent> = {
  hage: GREEN,
  dyrepass: GREEN,
  arrangement: GREEN,
  annet: GREEN,
  renhold: BLUE,
  flytting: BLUE,
  transport: BLUE,
  datahjelp: BLUE,
  montering: PURPLE,
  maling: PURPLE,
  snomaking: PURPLE,
};

/** Accent for a category slug; green is the fallback. */
export function categoryAccent(slug: string): CategoryAccent {
  return BY_SLUG[slug] ?? GREEN;
}
