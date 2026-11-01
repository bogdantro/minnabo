import { Share } from 'react-native';
import * as Linking from 'expo-linking';
import { SITE } from '@/config/links';
import { track } from './reporting';

/** Share a deep link to a listing via the OS share sheet. */
export async function shareListing(id: string, title: string): Promise<void> {
  const url = Linking.createURL(`/oppdrag/${id}`);
  try {
    await Share.share({
      title,
      message: `${title}\n${url}`,
      url,
    });
    track('listing_shared', { id });
  } catch {
    /* user dismissed the sheet */
  }
}

/** Invite a neighbour to MinNabo with a referral link. */
export async function shareInvite(referrerId: string): Promise<void> {
  const url = Linking.createURL('/velkommen', { queryParams: { ref: referrerId } });
  try {
    await Share.share({
      // the website link works for someone without the app; the second opens the app with the invite
      message: `Bli med på MinNabo – nabohjelp i Innlandet. Last ned appen: ${SITE}\nHar du appen? Åpne invitasjonen: ${url}`,
      url,
    });
    track('invite_shared', { referrerId });
  } catch {
    /* user dismissed the sheet */
  }
}
