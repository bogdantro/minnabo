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
