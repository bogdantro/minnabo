import { FlatList, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ListingType, PublicProfile } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useListings } from '@/api/queries';
import { safePush } from '@/lib/nav';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { ScreenState, type ScreenStatus } from '@/components/ui/ScreenState';
import { ListingRowCard } from '@/components/ListingRowCard';
import { ActiveUsersRow } from '@/components/ActiveUsersRow';

export function ListingListScreen({
  type,
  title,
  activeProfiles,
}: {
  type: ListingType;
  title: string;
  activeProfiles?: PublicProfile[];
}) {
  const { data, isLoading, isError, refetch } = useListings({ type });
  const items = data ?? [];

  let status: ScreenStatus = 'ready';
  if (isLoading) status = 'loading';
  else if (isError) status = 'error';
  else if (items.length === 0) status = 'empty';

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={title} />

      <View style={styles.titleWrap}>
        <ScreenTitle>{title}</ScreenTitle>
      </View>

      {activeProfiles && activeProfiles.length > 0 ? (
        <View style={styles.active}>
          <ActiveUsersRow
            profiles={activeProfiles}
            onPressUser={(id) => safePush(`/profil/${id}`)}
          />
        </View>
      ) : null}

      {status === 'ready' ? (
        <FlatList
          data={items}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ListingRowCard listing={item} onPress={() => safePush(`/oppdrag/${item.id}`)} />
          )}
        />
      ) : (
        <ScreenState status={status} onRetry={() => refetch()} emptyText={nb.state.emptyListings} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  titleWrap: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.md },
  active: { paddingBottom: tokens.space.md },
  list: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.xxxl, gap: tokens.space.lg },
});
