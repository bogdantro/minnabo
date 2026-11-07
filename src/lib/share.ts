import { Share, type View } from 'react-native';
import * as Linking from 'expo-linking';
import { SITE } from '@/config/links';
import { track } from './reporting';

/**
 * A view on screen → an image file. Native only: loaded when needed, so a build without the module
 * (Expo Go, an old build after an over-the-air update) just gets the error and shows a message.
 */
export async function captureViewAsFile(view: View, format: 'jpg' | 'png' = 'png'): Promise<string> {
  const { captureRef } = await import('react-native-view-shot');
  return captureRef(view, { format, quality: 0.92, result: 'tmpfile' });
}

/** Share an image file; falls back to the text when the phone can't. */
export async function shareImageFile(uri: string, fallback: { title: string; message: string }): Promise<void> {
  try {
    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: fallback.title, UTI: 'public.png' });
      return;
    }
  } catch {
    /* no module in this build: the text below still gets it shared */
  }
  await Share.share(fallback).catch(() => undefined);
}

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
