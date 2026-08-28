import { useState } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ListingType } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useMyListings } from '@/api/queries';
import { safePush } from '@/lib/nav';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { FilterTabs } from '@/components/FilterTabs';
import { Button } from '@/components/ui/Button';
import { ScreenState, type ScreenStatus } from '@/components/ui/ScreenState';
import { ListingRowCard } from '@/components/ListingRowCard';

export function MyListingsScreen() {
  const [tab, setTab] = useState<ListingType>('TASK_REQUEST');
  const { data, isLoading, isError, refetch } = useMyListings(tab);
  const items = data ?? [];

  let status: ScreenStatus = 'ready';
  if (isLoading) status = 'loading';
  else if (isError) status = 'error';
  else if (items.length === 0) status = 'empty';

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.mine.title} />
      <View style={styles.header}>
        <ScreenTitle>{nb.mine.title}</ScreenTitle>
        <FilterTabs<ListingType>
          options={[
            { value: 'TASK_REQUEST', label: nb.mine.tasksTab },
            { value: 'SERVICE_OFFER', label: nb.mine.offersTab },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {status === 'ready' ? (
        <FlatList
          data={items}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListingRowCard listing={item} onPress={() => safePush(`/oppdrag/${item.id}`)} />
          )}
        />
      ) : (
        <ScreenState
          status={status}
          onRetry={() => refetch()}
          emptyText={tab === 'TASK_REQUEST' ? nb.mine.emptyTasks : nb.mine.emptyOffers}
        />
      )}

      <View style={styles.footer}>
        <Button label={nb.mine.newListing} onPress={() => safePush('/legg-ut')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  header: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.md, gap: tokens.space.md },
  list: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.lg, gap: tokens.space.lg },
  footer: {
    padding: tokens.space.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
