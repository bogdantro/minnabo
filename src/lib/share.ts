import { Share } from 'react-native';
import * as Linking from 'expo-linking';
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
      message: `Bli med på MinNabo – hjelp naboene dine med småjobber. ${url}`,
      url,
    });
    track('invite_shared', { referrerId });
  } catch {
    /* user dismissed the sheet */
  }
}
