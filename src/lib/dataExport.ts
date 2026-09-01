import { Share } from 'react-native';
import { apiClient } from '@/api/client';
import { track } from './reporting';

/**
 * GDPR self-service export: gather the current user's data from the API and
 * hand it to the OS share sheet as JSON. A dev build could instead write a
 * file and offer "save to Files".
 */
export async function exportMyData(userId: string): Promise<void> {
  const [profile, listings, agreements, reviews, savedSearches] = await Promise.all([
    apiClient.getProfile(userId),
    apiClient.listMyListings(),
    apiClient.listMyAgreements(),
    apiClient.listReviews(userId),
    apiClient.listSavedSearches().catch(() => []),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    profile,
    listings,
    agreements,
    reviews,
    savedSearches,
  };

  track('data_exported');
  try {
    await Share.share({
      title: 'MinNabo – mine data',
      message: JSON.stringify(payload, null, 2),
    });
  } catch {
    /* user dismissed the sheet */
  }
}
