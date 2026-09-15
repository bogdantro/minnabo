import { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, ScrollView, TextInput, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { ListingFilter, ListingSort, ListingType } from '@/domain/types';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { CATEGORIES as categories, HOME_CATEGORIES as homeCategories } from '@/domain/categories';
import { useAddSavedSearch, useListings } from '@/api/queries';
import { useLocationScope } from '@/lib/locationScope';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useRecentSearches } from '@/lib/recentSearches';
import { toast } from '@/lib/toast';
import { safePush } from '@/lib/nav';
import { AppText } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { BrandMark } from '@/components/BrandMark';
import { CategoryCircleRow, type CategoryCircle } from '@/components/CategoryCircleRow';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { ScreenState, type ScreenStatus } from '@/components/ui/ScreenState';
import { ListingListSkeleton } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SortDropdown } from '@/components/ui/SortDropdown';
import { DistanceSlider } from '@/components/ui/DistanceSlider';
import { TextField } from '@/components/ui/TextField';
import { ListingRowCard } from '@/components/ListingRowCard';

type TypeChoice = 'ALL' | ListingType;

const SORTS = [
  { value: 'RELEVANCE', label: nb.search.sortRelevance },
  { value: 'DISTANCE', label: nb.search.sortDistance },
  { value: 'NEWEST', label: nb.search.sortNewest },
  { value: 'PRICE', label: nb.search.sortPrice },
];

export function SearchScreen({
  initialQuery = '',
  initialCategory,
}: {
  initialQuery?: string;
  initialCategory?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<TypeChoice>('ALL');
  const [categorySlug, setCategorySlug] = useState(initialCategory || 'alle');
  const [maxDistanceKm, setMaxDistanceKm] = useState<number | undefined>(undefined);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<ListingSort>('RELEVANCE');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [searchName, setSearchName] = useState('');

  const debouncedQuery = useDebouncedValue(query, 300);
  const recent = useRecentSearches();
  const { municipalities, ready } = useLocationScope();

  const filter: ListingFilter = useMemo(
    () => ({
      query: debouncedQuery.trim() || undefined,
      type: type === 'ALL' ? undefined : type,
      categorySlug: categorySlug === 'alle' ? undefined : categorySlug,
      maxDistanceKm,
      verifiedOnly: verifiedOnly || undefined,
      municipalities,
    }),
    [debouncedQuery, type, categorySlug, maxDistanceKm, verifiedOnly, municipalities],
  );

  const { data, isLoading, isError, isFetching, refetch } = useListings(filter, sort);
  const results = data ?? [];
  const addSearch = useAddSavedSearch();
  const typingBehind = query.trim() !== debouncedQuery.trim();

  // Remember non-trivial searches once they settle and return something.
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2 && !isLoading && results.length > 0) {
      recent.add(debouncedQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, isLoading, results.length]);

  const activeFilterCount =
    (type !== 'ALL' ? 1 : 0) +
    (categorySlug !== 'alle' ? 1 : 0) +
    (maxDistanceKm ? 1 : 0) +
    (verifiedOnly ? 1 : 0);

  let status: ScreenStatus = 'ready';
  if (isLoading || typingBehind || !ready) status = 'loading';
  else if (isError) status = 'error';
  else if (results.length === 0) status = 'empty';

  const showDiscovery =
    ready &&
    debouncedQuery.trim().length === 0 &&
    activeFilterCount === 0 &&
    results.length === 0 &&
    !isLoading;

  const runRecent = (term: string) => {
    setQuery(term);
    recent.add(term);
  };

  const clearFilters = () => {
    setType('ALL');
    setCategorySlug('alle');
    setMaxDistanceKm(undefined);
    setVerifiedOnly(false);
  };

  const saveSearch = () => {
    // The kommune scope is a live, hard scope — don't freeze it into the saved search.
    const { municipalities: _drop, ...savedFilter } = filter;
    addSearch.mutate(
      { name: searchName.trim() || query.trim() || 'Lagret søk', filter: savedFilter, sort },
      {
        onSuccess: () => toast.success(nb.toast.savedSearch),
        onError: () => toast.error(nb.toast.genericError),
      },
    );
    setSaveOpen(false);
    setSearchName('');
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['top', 'bottom']}>
      <View style={styles.headerTop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.a11y.back}
          hitSlop={hitSlop}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        >
          <Icon name="arrow-left" size={24} color="navy" />
        </Pressable>
        <BrandMark size={24} showWordmark={false} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <View style={styles.searchCircle}>
            <Icon name="search" size={18} color="white" />
          </View>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={nb.search.placeholder}
            placeholderTextColor={tokens.color.navyMuted}
            autoFocus={!initialQuery && !initialCategory}
            returnKeyType="search"
            spellCheck={false}
            autoCorrect={false}
            accessibilityLabel={nb.search.placeholder}
          />
          {query.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Tøm" hitSlop={8} onPress={() => setQuery('')}>
              <Icon name="x" size={16} color="navyMuted" />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.search.filters}
          onPress={() => setFiltersOpen(true)}
          style={styles.filterBtn}
        >
          <Icon name="sliders" size={20} color="navy" />
          {activeFilterCount > 0 ? (
            <View style={styles.filterDot}>
              <AppText variant="meta" weight="bold" color="white" style={styles.filterDotText}>
                {activeFilterCount}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.typeRow}>
        {(
          [
            ['ALL', nb.search.typeAll],
            ['SERVICE_OFFER', nb.search.typeOffer],
            ['TASK_REQUEST', nb.search.typeTask],
          ] as [TypeChoice, string][]
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: type === value }}
            accessibilityLabel={label}
            onPress={() => setType(value)}
            style={[styles.typeTab, type === value ? styles.typeTabActive : styles.typeTabInactive]}
          >
            <AppText variant="meta" weight="bold" color={type === value ? 'lime' : 'navy'} numberOfLines={1}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>

      <CategoryCircleRow
        items={homeCategories.map(
          (c): CategoryCircle => ({ slug: c.slug, label: c.label, icon: c.icon as IconName }),
        )}
        activeSlug={categorySlug}
        onSelect={setCategorySlug}
      />

      <View style={styles.resultsHead}>
        <AppText variant="meta" color="navyMuted">
          {typingBehind ? nb.common.searching : `${results.length} ${nb.search.results}`}
        </AppText>
        <View style={styles.resultsRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nb.savedSearch.saveCurrent}
            hitSlop={8}
            onPress={() => setSaveOpen(true)}
            style={styles.saveLink}
          >
            <Icon name="bookmark" size={14} color="cyan" />
            <AppText variant="meta" weight="bold" color="cyan">
              {nb.savedSearch.saveCurrent}
            </AppText>
          </Pressable>
          <SortDropdown value={sort} options={SORTS} onChange={(v) => setSort(v as ListingSort)} />
        </View>
      </View>

      {showDiscovery ? (
        <ScrollView contentContainerStyle={styles.discovery} keyboardShouldPersistTaps="handled">
          {recent.items.length > 0 ? (
            <View style={styles.discSection}>
              <View style={styles.discHead}>
                <AppText variant="cardTitle" weight="bold">
                  {nb.search.recent}
                </AppText>
                <Pressable accessibilityRole="button" hitSlop={8} onPress={recent.clear}>
                  <AppText variant="meta" weight="bold" color="cyan">
                    {nb.search.clearRecent}
                  </AppText>
                </Pressable>
              </View>
              {recent.items.map((term) => (
                <Pressable
                  key={term}
                  accessibilityRole="button"
                  accessibilityLabel={term}
                  onPress={() => runRecent(term)}
                  style={styles.recentRow}
                >
                  <Icon name="clock" size={15} color="navyMuted" />
                  <AppText variant="body" style={styles.recentText}>
                    {term}
                  </AppText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Fjern"
                    hitSlop={8}
                    onPress={() => recent.remove(term)}
                  >
                    <Icon name="x" size={14} color="navyMuted" />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.discSection}>
            <AppText variant="cardTitle" weight="bold">
              {nb.search.browseCategories}
            </AppText>
            <View style={styles.tileGrid}>
              {categories.map((c) => (
                <Pressable
                  key={c.slug}
                  accessibilityRole="button"
                  accessibilityLabel={c.label}
                  onPress={() => setCategorySlug(c.slug)}
                  style={styles.tile}
                >
                  <Icon name={c.icon as IconName} size={20} color="lime" />
                  <AppText variant="meta" weight="bold" numberOfLines={1}>
                    {c.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : status === 'loading' ? (
        <View style={styles.list}>
          <ListingListSkeleton />
        </View>
      ) : status === 'ready' ? (
        <FlatList
          data={results}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              tintColor={tokens.color.cyan}
              colors={[tokens.color.cyan]}
            />
          }
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
        heightRatio={0.78}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Group title={nb.search.filterCategory}>
            <Pill label={nb.search.typeAll} selected={categorySlug === 'alle'} onPress={() => setCategorySlug('alle')} />
            {categories.map((c) => (
              <Pill
                key={c.slug}
                label={c.label}
                selected={categorySlug === c.slug}
                onPress={() => setCategorySlug(c.slug)}
              />
            ))}
          </Group>

          <Group title={nb.search.filterDistance}>
            <DistanceSlider
              label={nb.search.filterDistance}
              value={maxDistanceKm ?? 50}
              onChange={(v) => setMaxDistanceKm(v >= 50 ? undefined : v)}
            />
          </Group>

          <Group title={nb.search.filterVerified}>
            <Pill
              label={nb.search.filterVerified}
              selected={verifiedOnly}
              onPress={() => setVerifiedOnly((v) => !v)}
            />
          </Group>
        </ScrollView>

        <View style={styles.sheetActions}>
          <Button label={nb.search.clear} variant="secondary" onPress={clearFilters} style={styles.sheetBtn} />
          <Button label={nb.search.apply} onPress={() => setFiltersOpen(false)} style={styles.sheetBtn} />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={nb.savedSearch.saveCurrent}
        heightRatio={0.45}
      >
        <TextField
          label={nb.savedSearch.named}
          value={searchName}
          onChangeText={setSearchName}
          placeholder={nb.savedSearch.namePlaceholder}
        />
        <View style={styles.saveActions}>
          <Button label={nb.savedSearch.save} onPress={saveSearch} iconRight="bookmark" />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="cardTitle" weight="bold">
        {title}
      </AppText>
      <View style={styles.groupPills}>{children}</View>
    </View>
  );
}

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}>
      <StatusPill label={label} tone={selected ? 'lime' : 'neutral'} filled={selected} soft={!selected} />
    </Pressable>
  );
}

const CONTROL = 52;

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.sm,
    paddingBottom: tokens.space.lg,
  },
  discovery: { padding: tokens.space.xl, gap: tokens.space.xl, paddingBottom: tokens.space.xxxl },
  discSection: { gap: tokens.space.sm },
  discHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  recentText: { flex: 1 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  tile: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.tile,
    padding: tokens.space.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.sm,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.line,
    paddingRight: tokens.space.lg,
    paddingVertical: 6,
    paddingLeft: 6,
    ...tokens.shadow.card,
  },
  searchCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.color.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { flex: 1, fontFamily: tokens.font.regular, fontSize: 15, color: tokens.color.navy, padding: 0 },
  filterBtn: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: tokens.radius.tile,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.line,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.card,
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: tokens.color.lime,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterDotText: { fontSize: 10 },
  typeRow: {
    flexDirection: 'row',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.sm,
  },
  typeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: tokens.radius.tile,
    borderWidth: 1.5,
  },
  typeTabActive: { borderColor: tokens.color.lime, backgroundColor: tokens.color.limeTint },
  typeTabInactive: { borderColor: tokens.color.line, backgroundColor: tokens.color.surface },
  chips: { gap: tokens.space.sm, paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xs },
  resultsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.sm,
    gap: tokens.space.md,
  },
  resultsRight: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  saveLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  list: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.xxxl, gap: tokens.space.md },
  group: { gap: tokens.space.sm, marginBottom: tokens.space.lg },
  groupPills: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  sheetActions: { flexDirection: 'row', gap: tokens.space.md, paddingTop: tokens.space.md },
  sheetBtn: { flex: 1 },
  saveActions: { marginTop: tokens.space.md },
});
