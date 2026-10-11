import { Linking } from 'react-native';

/** MinNabo's website. Every link to it goes through here. */
export const SITE = 'https://minnaboapp.no';

/**
 * Pages on the website. The legal pages are used during sign-up, where the person has no
 * account yet – signed-in screens keep the in-app /vilkar and /personvern.
 * The website has no public page per oppdrag, so sharing links to the front page.
 */
export const WEBSITE = {
  home: `${SITE}/`,
  vilkar: `${SITE}/vilkar/`,
  personvern: `${SITE}/personvern/`,
  /** help + contact form */
  hjelp: `${SITE}/hjelp/`,
} as const;

export type WebsitePage = keyof typeof WEBSITE;

/** Opens a page on the website in the phone's browser. */
export function openWebsite(page: WebsitePage): void {
  Linking.openURL(WEBSITE[page]).catch(() => undefined);
}
