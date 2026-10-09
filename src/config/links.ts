import { Linking } from 'react-native';

/**
 * The legal pages on minnabo.app. Used during sign-up, where the person has no
 * account yet – signed-in screens keep the in-app /vilkar and /personvern.
 */
export const WEBSITE = {
  vilkar: 'https://minnabo.app/vilkar/',
  personvern: 'https://minnabo.app/personvern/',
} as const;

export type WebsitePage = keyof typeof WEBSITE;

/** Opens a minnabo.app page in the phone's browser. */
export function openWebsite(page: WebsitePage): void {
  Linking.openURL(WEBSITE[page]).catch(() => undefined);
}
