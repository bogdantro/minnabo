import { useSyncExternalStore } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { savedStore } from '@/data/savedStore';
import { repositories } from '@/data/repositories';
import { safePush } from '@/lib/nav';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { ScreenState } from '@/components/ui/ScreenState';
import { ListingRowCard } from '@/components/ListingRowCard';

export function SavedScreen() {
  const savedIds = useSyncExternalStore(
    savedStore.subscribe,
    savedStore.list,
    savedStore.list,
  );

  const listings = savedIds
    .map((id) => repositories.listings.get(id))
    .filter((l): l is NonNullable<typeof l> => !!l);

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.saved.title} />
      <View style={styles.header}>
        <ScreenTitle>{nb.saved.title}</ScreenTitle>
      </View>

      {listings.length === 0 ? (
        <ScreenState status="empty" emptyText={nb.saved.emptyListings} />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListingRowCard listing={item} onPress={() => safePush(`/oppdrag/${item.id}`)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  header: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.md },
  list: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.xxxl, gap: tokens.space.lg },
});
