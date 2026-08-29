import { useState } from 'react';
import { FlatList, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueries } from '@tanstack/react-query';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import {
  listingKeys,
  useRemoveSavedSearch,
  useSavedListingIds,
  useSavedSearches,
} from '@/api/queries';
import { apiClient } from '@/api/client';
import type { SavedSearchRecord } from '@/api/ApiClient';
import { categoryBySlug } from '@/domain/categories';
import { safePush } from '@/lib/nav';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { FilterTabs } from '@/components/FilterTabs';
import { ScreenState } from '@/components/ui/ScreenState';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { StatusPill } from '@/components/ui/StatusPill';
import { ListingRowCard } from '@/components/ListingRowCard';

type Tab = 'listings' | 'searches';

export function SavedScreen() {
  const [tab, setTab] = useState<Tab>('listings');

  const { data: savedIds = [] } = useSavedListingIds();
  const { data: searches = [] } = useSavedSearches();

  const listingQueries = useQueries({
    queries: savedIds.map((id) => ({
      queryKey: listingKeys.detail(id),
      queryFn: () => apiClient.getListing(id),
    })),
  });
  const listings = listingQueries
    .map((q) => q.data)
    .filter((l): l is NonNullable<typeof l> => !!l);

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.saved.title} />
      <View style={styles.header}>
        <ScreenTitle>{nb.saved.title}</ScreenTitle>
        <FilterTabs<Tab>
          options={[
            { value: 'listings', label: nb.saved.listingsTab },
            { value: 'searches', label: nb.saved.searchesTab },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'listings' ? (
        listings.length === 0 ? (
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
        )
      ) : searches.length === 0 ? (
        <ScreenState status="empty" emptyText={nb.saved.emptySearches} />
      ) : (
        <FlatList
          data={searches}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <SavedSearchCard search={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function summarize(search: SavedSearchRecord): string[] {
  const parts: string[] = [];
  if (search.filter.type === 'TASK_REQUEST') parts.push(nb.search.typeTask);
  else if (search.filter.type === 'SERVICE_OFFER') parts.push(nb.search.typeOffer);
  if (search.filter.categorySlug) parts.push(categoryBySlug(search.filter.categorySlug).label);
  if (search.filter.maxDistanceKm) parts.push(`≤ ${search.filter.maxDistanceKm} km`);
  if (search.filter.verifiedOnly) parts.push(nb.search.filterVerified);
  return parts;
}

function SavedSearchCard({ search }: { search: SavedSearchRecord }) {
  const remove = useRemoveSavedSearch();
  const tags = summarize(search);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${search.name} — ${nb.savedSearch.run}`}
      onPress={() => safePush(`/sok?q=${encodeURIComponent(search.filter.query ?? '')}`)}
      style={styles.card}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardTitle}>
          <Icon name="bookmark" size={16} color="cyan" />
          <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
            {search.name}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.savedSearch.remove}
          hitSlop={hitSlop}
          onPress={() => remove.mutate(search.id)}
        >
          <Icon name="trash-2" size={16} color="navyMuted" />
        </Pressable>
      </View>

      {search.filter.query ? (
        <AppText variant="meta" color="navyMuted">
          «{search.filter.query}»
        </AppText>
      ) : null}

      {tags.length > 0 ? (
        <View style={styles.tags}>
          {tags.map((t) => (
            <StatusPill key={t} label={t} tone="neutral" soft />
          ))}
        </View>
      ) : null}

      <View style={styles.cardFoot}>
        <AppText variant="meta" weight="bold" color="cyan">
          {nb.savedSearch.run}
        </AppText>
        <Icon name="chevron-right" size={16} color="cyan" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  header: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.md, gap: tokens.space.md },
  list: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.xxxl, gap: tokens.space.lg },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
    gap: tokens.space.sm,
    ...tokens.shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm, flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.xs },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: tokens.space.xs },
});
