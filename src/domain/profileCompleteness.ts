import type { PublicProfile } from './types';
import nb from '@/i18n/nb';

export type CompletenessStep = { id: string; label: string; sub: string; done: boolean; href: string };

/**
 * «Bygg tillit»: the six things that make a profile get more answers, in the order worth
 * doing them. `portfolioCount` is the real before/after portfolio (portfolio_items),
 * `hasContacts` the trygge kontakter on this phone.
 */
export function completenessSteps(profile: PublicProfile, portfolioCount: number, hasContacts: boolean): CompletenessStep[] {
  const T = nb.verificationCenter.tips;
  return [
    { id: 'photo', label: T.photo.label, sub: T.photo.sub, done: !!profile.avatarUrl, href: '/profil/rediger' },
    { id: 'bio', label: T.bio.label, sub: T.bio.sub, done: !!profile.presentation?.trim(), href: '/profil/rediger' },
    { id: 'cats', label: T.cats.label, sub: T.cats.sub, done: (profile.categorySlugs?.length ?? 0) > 0, href: '/profil/rediger' },
    { id: 'port', label: T.port.label, sub: T.port.sub(portfolioCount), done: portfolioCount > 0, href: '/profil/rediger' },
    { id: 'notes', label: T.notes.label, sub: T.notes.sub, done: !!profile.homeNotes?.trim(), href: '/profil/rediger' },
    { id: 'contacts', label: T.contacts.label, sub: T.contacts.sub, done: hasContacts, href: '/trygge-kontakter' },
  ];
}

/** 4 of 6 done → 67. */
export function completenessPct(steps: CompletenessStep[]): number {
  return steps.length ? Math.round((steps.filter((s) => s.done).length / steps.length) * 100) : 100;
}
