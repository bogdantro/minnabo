import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { tokens } from '@/theme';
import { apiClient } from '@/api/client';
import { ScreenState } from '@/components/ui/ScreenState';

export default function StartChatRoute() {
  const { listing } = useLocalSearchParams<{ listing?: string }>();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    if (typeof listing === 'string' && listing) {
      apiClient
        .startConversationForListing(listing)
        .then((conv) => {
          if (!cancelled) router.replace(`/chat/${conv.id}`);
        })
        .catch(() => {
          if (!cancelled) router.replace('/innboks');
        });
    }
    return () => {
      cancelled = true;
    };
  }, [listing, router]);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenState status="loading" />
    </View>
  );
}
