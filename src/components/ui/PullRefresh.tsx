import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { colors } from '@/theme/theme';
import { haptics } from '@/lib/haptics';

/**
 * Pull to refresh for a screen: refetches every query that is on screen right now (whatever the
 * screen and its parts use), and shows the spinner only while the person is pulling – a background
 * refetch never makes it flicker. A light tick when the pull starts.
 */
export function usePullRefresh() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    haptics.light();
    setRefreshing(true);
    try {
      await qc.refetchQueries({ type: 'active' });
    } catch {
      // a failed refetch shows its own error state; the spinner must still stop
    } finally {
      setRefreshing(false);
    }
  }, [qc]);
  return { refreshing, onRefresh };
}

/** The RefreshControl element for `scrollProps.refreshControl`, `ListScreen.refreshControl` or a ScrollView. */
export function pullRefreshControl({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.limeDeep} colors={[colors.limeDeep]} />;
}
