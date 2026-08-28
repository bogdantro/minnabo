import { useMemo, useState } from 'react';
import { View, FlatList, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { ListingSort, ListingType } from '@/domain/types';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { categories } from '@/data/seed';
import { useListings } from '@/api/queries';
import { safePush } from '@/lib/nav';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from '@/components/BrandMark';
import { SearchField } from '@/components/ui/SearchField';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { ScreenState, type ScreenStatus } from '@/components/ui/ScreenState';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ListingRowCard } from '@/components/ListingRowCard';

type TypeChoice = 'ALL' | ListingType;

const DISTANCES = [5, 10, 25, 50] as const;

const SORTS: { value: ListingSort; label: string }[] = [
  { value: 'RELEVANCE', label: nb.search.sortRelevance },
  { value: 'DISTANCE', label: nb.search.sortDistance },
  { value: 'NEWEST', label: nb.search.sortNewest },
  { value: 'PRICE', label: nb.search.sortPrice },
];

export function SearchScreen({ initialQuery = '' }: { initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<TypeChoice>('ALL');
  const [categorySlug, setCategorySlug] = useState<string | undefined>(undefined);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number | undefined>(undefined);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<ListingSort>('RELEVANCE');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filter = useMemo(
    () => ({
      query: query.trim() || undefined,
      type: type === 'ALL' ? undefined : type,
      categorySlug,
      maxDistanceKm,
      verifiedOnly: verifiedOnly || undefined,
    }),
    [query, type, categorySlug, maxDistanceKm, verifiedOnly],
  );

  const { data, isLoading, isError, refetch } = useListings(filter, sort);
  const results = data ?? [];

  const activeFilterCount =
    (type !== 'ALL' ? 1 : 0) +
    (categorySlug ? 1 : 0) +
    (maxDistanceKm ? 1 : 0) +
    (verifiedOnly ? 1 : 0);

  let status: ScreenStatus = 'ready';
  if (isLoading) status = 'loading';
  else if (isError) status = 'error';
  else if (results.length === 0) status = 'empty';

  const clearFilters = () => {
    setType('ALL');
    setCategorySlug(undefined);
    setMaxDistanceKm(undefined);
    setVerifiedOnly(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerTop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.a11y.back}
          hitSlop={hitSlop}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        >
          <Icon name="arrow-left" size={24} color="navy" />
        </Pressable>
        <BrandMark size={24} />
      </View>

      <View style={styles.headerField}>
        <SearchField
          placeholder={nb.search.placeholder}
          value={query}
          onChangeText={setQuery}
          autoFocus={!initialQuery}
        />
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.search.filters}
          onPress={() => setFiltersOpen(true)}
          style={styles.filterBtn}
        >
          <Icon name="sliders" size={16} color="navy" />
          <AppText variant="meta" weight="bold">
            {nb.search.filters}
            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </AppText>
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {SORTS.map((s) => (
            <Pressable
              key={s.value}
              accessibilityRole="button"
              accessibilityState={{ selected: sort === s.value }}
              onPress={() => setSort(s.value)}
              style={[styles.sortChip, sort === s.value && styles.sortChipActive]}
            >
              <AppText variant="meta" weight="bold" color={sort === s.value ? 'navy' : 'navyMuted'}>
                {s.label}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <AppText variant="meta" color="navyMuted" style={styles.count}>
        {results.length} {nb.search.results}
      </AppText>

      {status === 'ready' ? (
        <FlatList
          data={results}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ListingRowCard listing={item} onPress={() => safePush(`/oppdrag/${item.id}`)} />
          )}
        />
      ) : (
        <ScreenState status={status} onRetry={() => refetch()} emptyText={nb.search.empty} />
      )}

      <BottomSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={nb.search.filters}
        heightRatio={0.72}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <FilterGroup title={nb.search.filterType}>
            {(
              [
                ['ALL', nb.search.typeAll],
                ['TASK_REQUEST', nb.search.typeTask],
                ['SERVICE_OFFER', nb.search.typeOffer],
              ] as [TypeChoice, string][]
            ).map(([value, label]) => (
              <SelectPill key={value} label={label} selected={type === value} onPress={() => setType(value)} />
            ))}
          </FilterGroup>

          <FilterGroup title={nb.search.filterCategory}>
            <SelectPill
              label={nb.search.typeAll}
              selected={!categorySlug}
              onPress={() => setCategorySlug(undefined)}
            />
            {categories.map((c) => (
              <SelectPill
                key={c.slug}
                label={c.label}
                selected={categorySlug === c.slug}
                onPress={() => setCategorySlug(c.slug)}
              />
            ))}
          </FilterGroup>

          <FilterGroup title={nb.search.filterDistance}>
            <SelectPill
              label={nb.search.anyDistance}
              selected={!maxDistanceKm}
              onPress={() => setMaxDistanceKm(undefined)}
            />
            {DISTANCES.map((d) => (
              <SelectPill
                key={d}
                label={`${d} ${nb.common.km}`}
                selected={maxDistanceKm === d}
                onPress={() => setMaxDistanceKm(d)}
              />
            ))}
          </FilterGroup>

          <FilterGroup title={nb.search.filterVerified}>
            <SelectPill
              label={nb.search.filterVerified}
              selected={verifiedOnly}
              onPress={() => setVerifiedOnly((v) => !v)}
            />
          </FilterGroup>
        </ScrollView>

        <View style={styles.sheetActions}>
          <Button label={nb.search.clear} variant="secondary" onPress={clearFilters} style={styles.sheetBtn} />
          <Button label={nb.search.apply} onPress={() => setFiltersOpen(false)} style={styles.sheetBtn} />
        </View>
      </BottomSheet>
    </View>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="cardTitle" weight="bold">
        {title}
      </AppText>
      <View style={styles.groupPills}>{children}</View>
    </View>
  );
}

function SelectPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}>
      <StatusPill label={label} tone={selected ? 'lime' : 'neutral'} filled={selected} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.xxl,
    paddingBottom: tokens.space.sm,
  },
  headerField: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.sm },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.sm,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  sortRow: { gap: tokens.space.sm, alignItems: 'center' },
  sortChip: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: tokens.color.line,
  },
  sortChipActive: { borderColor: tokens.color.lime, backgroundColor: tokens.color.limeTint },
  count: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.sm },
  list: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.xxxl, gap: tokens.space.lg },
  group: { gap: tokens.space.sm, marginBottom: tokens.space.lg },
  groupPills: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  sheetActions: { flexDirection: 'row', gap: tokens.space.md, paddingTop: tokens.space.md },
  sheetBtn: { flex: 1 },
});
