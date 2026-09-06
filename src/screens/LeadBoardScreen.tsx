import { useMemo } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useListings, useMyListings } from '@/api/queries';
import { useLocationScope } from '@/lib/locationScope';
import { useDismissedLeads } from '@/lib/dismissedLeads';
import { safePush } from '@/lib/nav';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { ScreenState } from '@/components/ui/ScreenState';
import { ListingListSkeleton } from '@/components/ui/Skeleton';
import { ListingRowCard } from '@/components/ListingRowCard';

export function LeadBoardScreen() {
  const { municipalities, ready } = useLocationScope();
  const myOffers = useMyListings('SERVICE_OFFER');
  const tasks = useListings({ type: 'TASK_REQUEST', municipalities }, 'NEWEST');
  const { dismissed, dismiss } = useDismissedLeads();

  const myCategories = useMemo(
    () => new Set((myOffers.data ?? []).map((l) => l.category.slug)),
    [myOffers.data],
  );

  const ranked = useMemo(() => {
    const all = tasks.data ?? [];
    return all
      .filter((l) => !dismissed.has(l.id))
      .map((l) => ({
        listing: l,
        match: myCategories.has(l.category.slug),
      }))
      .sort((a, b) => {
        if (a.match !== b.match) return a.match ? -1 : 1;
        const da = a.listing.location.distanceKm ?? 999;
        const db = b.listing.location.distanceKm ?? 999;
        if (da !== db) return da - db;
        return Date.parse(b.listing.createdAt) - Date.parse(a.listing.createdAt);
      });
  }, [tasks.data, dismissed, myCategories]);

  const loading = tasks.isLoading || myOffers.isLoading || !ready;

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.leadBoard.title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle>{nb.leadBoard.title}</ScreenTitle>
        <AppText variant="body" color="navyMuted">
          {myCategories.size > 0 ? nb.leadBoard.body : nb.leadBoard.noOfferBody}
        </AppText>

        {loading ? (
          <ListingListSkeleton count={4} />
        ) : tasks.isError ? (
          <ScreenState status="error" onRetry={() => tasks.refetch()} />
        ) : ranked.length === 0 ? (
          <ScreenState status="empty" emptyText={nb.leadBoard.empty} />
        ) : (
          <View style={styles.list}>
            {ranked.map(({ listing, match }) => (
              <View key={listing.id}>
                {match ? (
                  <View style={styles.matchTag}>
                    <Icon name="target" size={12} color="lime" />
                    <AppText variant="meta" weight="bold" color="lime">
                      {nb.leadBoard.matchTag}
                    </AppText>
                  </View>
                ) : null}
                <ListingRowCard listing={listing} onPress={() => safePush(`/oppdrag/${listing.id}`)} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${nb.leadBoard.dismiss} — ${listing.title}`}
                  hitSlop={8}
                  onPress={() => dismiss(listing.id)}
                  style={styles.dismiss}
                >
                  <Icon name="x" size={13} color="navyMuted" />
                  <AppText variant="meta" color="navyMuted">
                    {nb.leadBoard.dismiss}
                  </AppText>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.md, paddingBottom: tokens.space.xxxl },
  list: { gap: tokens.space.lg, marginTop: tokens.space.sm },
  matchTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  dismiss: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: tokens.space.xs,
  },
});
