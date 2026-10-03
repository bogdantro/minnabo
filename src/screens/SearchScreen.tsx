import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import nb from '@/i18n/nb';
import type { Listing, ListingSort } from '@/domain/types';
import { categoryArtId, slugForArtId } from '@/domain/categories';
import { useAddSavedSearch, useListings, useRemoveSavedSearch } from '@/api/queries';
import { useLocationScope } from '@/lib/locationScope';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useRecentSearches } from '@/lib/recentSearches';
import { toast } from '@/lib/toast';
import { categoryLabels, colors, radius, safeTopExtra, screenPadding, shadow, text, type CategoryId } from '@/theme/theme';
import { OppdragCard } from '@/components/OppdragCard';
import {
  Button,
  Card,
  Chip,
  ChipRow,
  ErrorState,
  FadeUp,
  Field,
  Icon,
  IconButton,
  ListGroup,
  ListingListSkeleton,
  OptionCard,
  PaymentNote,
  Radio,
  RangeSlider,
  ScaleIn,
  Screen,
  Sheet,
  Toggle,
  TextLink,
} from '@/components/ui';

const CATS = Object.keys(categoryLabels) as CategoryId[];
const SORTS: ListingSort[] = ['RELEVANCE', 'DISTANCE', 'NEWEST', 'PRICE'];
const MAX_KM = 50;

type Filters = { cats: CategoryId[]; verified: boolean; km: number; sort: ListingSort };
const NO_FILTERS: Filters = { cats: [], verified: false, km: MAX_KM, sort: 'RELEVANCE' };

const priceValue = (l: Listing) => (l.price ? l.price.amountMinor : Number.MAX_SAFE_INTEGER);

/**
 * Search query + kommune scope on the server; categories (multi), "Kun
 * verifiserte", distance and sort applied here so the filter sheet can show
 * a live "Vis N treff" count.
 */
function applyFilters(list: Listing[], f: Filters): Listing[] {
  let out = list;
  if (f.cats.length) out = out.filter((l) => f.cats.includes(categoryArtId(l.category.slug)));
  if (f.verified) out = out.filter((l) => l.owner.verifications.some((v) => v.verified));
  if (f.km < MAX_KM) out = out.filter((l) => (l.location.distanceKm ?? 0) <= f.km);
  const s = [...out];
  if (f.sort === 'DISTANCE') s.sort((a, b) => (a.location.distanceKm ?? 999) - (b.location.distanceKm ?? 999));
  if (f.sort === 'NEWEST') s.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (f.sort === 'PRICE') s.sort((a, b) => priceValue(a) - priceValue(b));
  return s;
}

/** Søk (design/screens/Sok.dc.html). Oppdrag only (rule 1). */
export function SearchScreen({ initialQuery = '', initialCategory }: { initialQuery?: string; initialCategory?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const [f, setF] = useState<Filters>(() => ({
    ...NO_FILTERS,
    cats: initialCategory && initialCategory !== 'alle' ? [categoryArtId(initialCategory)] : [],
  }));
  const [draft, setDraft] = useState<Filters>(f);
  const [sheet, setSheet] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const debounced = useDebouncedValue(q, 300);
  const recent = useRecentSearches();
  const { municipality, municipalities, reach, ready } = useLocationScope();
  const jobs = useListings({ type: 'TASK_REQUEST', query: debounced.trim() || undefined, municipalities }, 'RELEVANCE');
  const addSearch = useAddSavedSearch();
  const removeSearch = useRemoveSavedSearch();

  const base = useMemo(() => jobs.data ?? [], [jobs.data]);
  const results = useMemo(() => applyFilters(base, f), [base, f]);
  const draftCount = useMemo(() => applyFilters(base, draft).length, [base, draft]);

  // Remember a settled, non-trivial query that returned something.
  const term = debounced.trim();
  useEffect(() => {
    if (term.length >= 2 && !jobs.isLoading && base.length > 0) recent.add(term);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, jobs.isLoading, base.length]);

  const set = (patch: Partial<Filters>) => {
    setF((x) => ({ ...x, ...patch }));
    setSavedId(null);
  };
  const active: { label: string; remove: () => void }[] = [
    ...f.cats.map((c) => ({ label: categoryLabels[c], remove: () => set({ cats: f.cats.filter((x) => x !== c) }) })),
    ...(f.verified ? [{ label: nb.sok.verifiedOnly, remove: () => set({ verified: false }) }] : []),
    ...(f.km < MAX_KM ? [{ label: nb.sok.distanceUpTo(f.km), remove: () => set({ km: MAX_KM }) }] : []),
    ...(f.sort !== 'RELEVANCE' ? [{ label: nb.sok.sortedBy(nb.sok.sorts[f.sort].label), remove: () => set({ sort: 'RELEVANCE' }) }] : []),
  ];
  const runQuery = (t: string) => {
    setQ(t);
    setSavedId(null);
    recent.add(t);
  };

  const where = !municipality
    ? nb.sok.whereAll
    : reach === 0
      ? nb.sok.whereKommune(municipality)
      : reach === 1
        ? nb.sok.whereNeighbours(municipality)
        : nb.sok.whereAll;
  const typing = q.trim() !== term;
  const loading = jobs.isLoading || typing || !ready;
  const showSuggest = !q.trim();

  const toggleSaved = () => {
    if (savedId) {
      removeSearch.mutate(savedId, { onSuccess: () => toast.success(nb.sok.unsavedToast, { icon: 'x' }) });
      setSavedId(null);
      return;
    }
    addSearch.mutate(
      {
        name: term || f.cats.map((c) => categoryLabels[c]).join(', ') || nb.sok.saveSearch,
        filter: {
          type: 'TASK_REQUEST',
          query: term || undefined,
          categorySlug: f.cats.length === 1 ? slugForArtId(f.cats[0]) : undefined,
          verifiedOnly: f.verified || undefined,
          maxDistanceKm: f.km < MAX_KM ? f.km : undefined,
        },
        sort: f.sort,
      },
      {
        onSuccess: (s) => {
          setSavedId(s.id);
          toast.success(nb.sok.savedToast, { icon: 'bookmark' });
        },
        onError: () => toast.error(nb.toast.genericError),
      },
    );
  };

  return (
    <Screen
      scroll
      spacer="none"
      scrollProps={{ keyboardDismissMode: 'on-drag' }}
      header={
        <View style={[styles.sbar, { paddingTop: insets.top + safeTopExtra }]}>
          <IconButton icon="back" accessibilityLabel={nb.sok.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <View style={[styles.search, shadow.card, focused && [styles.searchFocus, shadow.focus]]}>
            <Icon name="search" size={18} color={colors.mute} />
            <TextInput
              value={q}
              onChangeText={(v) => {
                setQ(v);
                setSavedId(null);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={nb.sok.ph}
              placeholderTextColor={colors.mute}
              accessibilityLabel={nb.sok.a11y}
              returnKeyType="search"
              autoFocus={!initialQuery && !initialCategory}
              style={[text.input, styles.input]}
            />
            {q ? (
              <ScaleIn>
                <Pressable accessibilityRole="button" accessibilityLabel={nb.sok.clear} onPress={() => setQ('')} style={styles.clr}>
                  <Icon name="x" size={16} color={colors.ink2} />
                </Pressable>
              </ScaleIn>
            ) : null}
          </View>
        </View>
      }
    >
      <FadeUp delay={100} style={styles.mt12}>
        <ChipRow style={styles.filterRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nb.sok.openFilters}
            onPress={() => {
              setDraft(f);
              setSheet(true);
            }}
            style={[styles.fbtn, active.length > 0 && styles.fbtnOn]}
          >
            <Icon name="sliders" size={18} color={active.length ? colors.white : colors.ink} />
            <Text style={[text.segment, { color: active.length ? colors.white : colors.ink }]}>{nb.sok.filters}</Text>
            {active.length ? (
              <View style={styles.fc}>
                <Text style={[text.count, { color: colors.ink, fontSize: 11.5, lineHeight: 20 }]}>{active.length}</Text>
              </View>
            ) : null}
          </Pressable>
          {active.map((a) => (
            <ScaleIn key={a.label}>
              <Pressable accessibilityRole="button" accessibilityLabel={nb.sok.removeFilter(a.label)} onPress={a.remove} style={styles.achip}>
                <Text style={[text.chipSm, { fontSize: 13.5 }]}>{a.label}</Text>
                <View style={styles.xx}>
                  <Icon name="x" size={14} />
                </View>
              </Pressable>
            </ScaleIn>
          ))}
          {active.length > 1 ? <TextLink label={nb.sok.reset} icon={null} onPress={() => set(NO_FILTERS)} style={styles.resetLink} /> : null}
          {active.length === 0 ? <Text style={[text.meta, styles.hint]}>{nb.sok.filterHint}</Text> : null}
        </ChipRow>
      </FadeUp>

      {showSuggest ? (
        <View>
          {recent.items.length ? (
            <>
              <View style={styles.recentHead}>
                <Text style={[text.sectionTitle, { fontSize: 18 }]}>{nb.sok.recent}</Text>
                <TextLink label={nb.sok.clearRecent} icon={null} onPress={recent.clear} />
              </View>
              <FadeUp delay={150} style={styles.px}>
                <ListGroup>
                  {recent.items.map((r) => (
                    <View key={r} style={styles.rrow}>
                      <Pressable accessibilityRole="button" onPress={() => runQuery(r)} style={styles.rq}>
                        <Icon name="clock" size={18} color={colors.faint} />
                        <Text style={[text.bodySemi, styles.flex]}>{r}</Text>
                      </Pressable>
                      <IconButton icon="x" iconSize={16} variant="ghost" accessibilityLabel={nb.sok.removeRecent(r)} onPress={() => recent.remove(r)} />
                    </View>
                  ))}
                </ListGroup>
              </FadeUp>
            </>
          ) : null}
          <View style={styles.popHead}>
            <View style={styles.popIcon}>
              <Icon name="zap" size={16} color={colors.limeDeep} />
            </View>
            <Text style={[text.sectionTitle, { fontSize: 18 }]} accessibilityRole="header">
              {nb.sok.popular(municipality ?? '')}
            </Text>
          </View>
          <FadeUp delay={200} style={[styles.px, styles.wrap]}>
            {nb.sok.popularTerms.map((p) => (
              <Pressable key={p} accessibilityRole="button" onPress={() => runQuery(p)} style={styles.pop}>
                <Icon name="arrowur" size={14} color={colors.limeDeep} />
                <Text style={text.chip}>{p}</Text>
              </Pressable>
            ))}
          </FadeUp>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.mt26}>
          <ListingListSkeleton count={3} />
        </View>
      ) : jobs.isError ? (
        <View style={styles.errorBox}>
          <ErrorState onRetry={() => void jobs.refetch()} retrying={jobs.isFetching} />
        </View>
      ) : results.length ? (
        <View>
          <View style={styles.resHead}>
            <View style={[styles.flex, { gap: 3 }]}>
              <Text style={[text.h3, { fontSize: 19 }]}>{nb.sok.count(results.length, where)}</Text>
              <Text style={text.meta}>{nb.sok.sortLine(term, nb.sok.sorts[f.sort].label)}</Text>
            </View>
            <Button
              label={savedId ? nb.sok.saved : nb.sok.saveSearch}
              icon={savedId ? 'check' : 'bookmark'}
              variant="ghost"
              size="sm"
              block={false}
              accessibilityLabel={savedId ? nb.sok.savedA11y : nb.sok.saveSearch}
              onPress={toggleSaved}
            />
          </View>
          <View style={[styles.px, styles.gap12]}>
            {results.map((l, i) => (
              <FadeUp key={l.id} delay={Math.min(i, 9) * 50}>
                <OppdragCard listing={l} showVerified />
              </FadeUp>
            ))}
          </View>
          <View style={[styles.px, styles.mt18]}>
            <PaymentNote style={styles.noteCenter} />
          </View>
        </View>
      ) : (
        <ScaleIn style={[styles.px, styles.mt26]}>
          <Card pad style={styles.empty}>
            <View style={styles.emptyIll}>
              <View style={styles.emptyOuter} />
              <View style={[styles.emptyInner, shadow.medium]}>
                <Icon name="search" size={32} color={colors.cyanDeep} />
              </View>
              <View style={styles.emptyX}>
                <Icon name="x" size={14} color={colors.ink} />
              </View>
            </View>
            <Text style={[text.h3, styles.center]}>{term ? nb.sok.emptyQ(term) : nb.sok.emptyFilters}</Text>
            <Text style={[text.meta, styles.center, { maxWidth: 280 }]}>{nb.sok.emptyBody}</Text>
            {active.length ? (
              <Button label={nb.sok.removeAll} icon="refresh" variant="ink" size="sm" block={false} align="center" onPress={() => set(NO_FILTERS)} />
            ) : null}
            <Text style={[text.eyebrow, styles.mt12]}>{nb.sok.tryInstead}</Text>
            <View style={[styles.wrap, { justifyContent: 'center' }]}>
              {nb.sok.trySuggestions.map((p) => (
                <Pressable
                  key={p}
                  accessibilityRole="button"
                  onPress={() => {
                    setQ(p);
                    set(NO_FILTERS);
                  }}
                  style={styles.pop}
                >
                  <Icon name="search" size={14} color={colors.limeDeep} />
                  <Text style={text.chip}>{p}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.divider} />
            <Text style={text.meta}>{nb.sok.notFound}</Text>
            <Button label={nb.sok.post} icon="plus" onPress={() => router.push('/legg-ut')} />
          </Card>
        </ScaleIn>
      )}
      <View style={styles.bottomSpace} />

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title={nb.sok.sheetTitle}
        titleSize="h2"
        scroll
        headerAction={<TextLink label={nb.sok.reset} icon={null} onPress={() => setDraft(NO_FILTERS)} />}
      >
        <Field label={nb.sok.category} hint={nb.sok.categoryHint}>
          <View style={styles.catwrap}>
            {CATS.map((c) => {
              const on = draft.cats.includes(c);
              return (
                <Chip
                  key={c}
                  label={categoryLabels[c]}
                  category={c}
                  selected={on}
                  onPress={() => setDraft((d) => ({ ...d, cats: on ? d.cats.filter((x) => x !== c) : [...d.cats, c] }))}
                  style={styles.catChip}
                />
              );
            })}
          </View>
        </Field>
        <View style={styles.sheetDivider} />
        <View style={styles.verRow}>
          <View style={styles.verIcon}>
            <Icon name="verified" size={22} color={colors.ok} />
          </View>
          <View style={styles.flex}>
            <Text style={[text.rowTitle, { fontFamily: text.label.fontFamily }]}>{nb.sok.verifiedOnly}</Text>
            <Text style={text.meta}>{nb.sok.verifiedSub}</Text>
          </View>
          <Toggle value={draft.verified} onValueChange={(v) => setDraft((d) => ({ ...d, verified: v }))} accessibilityLabel={nb.sok.verifiedOnly} />
        </View>
        <View style={styles.sheetDivider} />
        <View style={styles.distHead}>
          <Text style={text.label}>{nb.sok.distance}</Text>
          <Text style={[text.num, { fontSize: 17 }]}>{draft.km >= MAX_KM ? nb.sok.distanceAll : nb.sok.distanceUpTo(draft.km)}</Text>
        </View>
        <RangeSlider
          value={draft.km}
          min={1}
          max={MAX_KM}
          onChange={(v) => setDraft((d) => ({ ...d, km: v }))}
          accessibilityLabel={nb.sok.distanceA11y}
          formatValue={(v) => `${v} km`}
        />
        <View style={styles.ticks}>
          {['1 km', '25 km', '50 km'].map((t) => (
            <Text key={t} style={[text.small, { color: colors.faint }]}>
              {t}
            </Text>
          ))}
        </View>
        <View style={styles.sheetDivider} />
        <Text style={[text.label, styles.mb12]}>{nb.sok.sortBy}</Text>
        <View style={styles.gap8}>
          {SORTS.map((s) => (
            <OptionCard
              key={s}
              selected={draft.sort === s}
              onPress={() => setDraft((d) => ({ ...d, sort: s }))}
              accessibilityLabel={nb.sok.sorts[s].label}
              style={styles.sortOpt}
            >
              <Radio selected={draft.sort === s} />
              <Text style={[text.optionName, styles.flex, { fontSize: 15 }]}>{nb.sok.sorts[s].label}</Text>
              <Text style={text.meta}>{nb.sok.sorts[s].desc}</Text>
            </OptionCard>
          ))}
        </View>
        <Button
          label={nb.sok.apply(draftCount)}
          variant="ink"
          size="lg"
          disabled={draftCount === 0}
          onPress={() => {
            setF(draft);
            setSavedId(null);
            setSheet(false);
            toast.success(nb.sok.applied(draftCount), { icon: 'sliders' });
          }}
          style={styles.apply}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  px: { paddingHorizontal: screenPadding },
  mt12: { marginTop: 12 },
  mt18: { marginTop: 18 },
  mt26: { marginTop: 26 },
  mb12: { marginBottom: 12 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  bottomSpace: { height: 60 },
  sbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8, zIndex: 5 },
  search: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 4,
  },
  searchFocus: { borderColor: colors.cyan2 },
  input: { flex: 1, height: '100%', fontSize: 15.5 },
  clr: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  filterRow: { alignItems: 'center' },
  fbtn: {
    height: 42,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fbtnOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  fc: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.lime, paddingHorizontal: 5, alignItems: 'center' },
  achip: {
    height: 42,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  xx: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  resetLink: { paddingHorizontal: 6, alignSelf: 'center' },
  hint: { paddingLeft: 4, alignSelf: 'center' },
  recentHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: screenPadding,
    marginTop: 20,
    marginBottom: 10,
  },
  rrow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingRight: 6, minHeight: 52 },
  rq: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  popHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: screenPadding, marginTop: 24, marginBottom: 10 },
  popIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pop: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  resHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: screenPadding,
    marginTop: 26,
    marginBottom: 12,
  },
  noteCenter: { justifyContent: 'center' },
  errorBox: { height: 400 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 28, paddingHorizontal: 22, paddingBottom: 22 },
  emptyIll: { width: 96, height: 96, marginBottom: 6 },
  emptyOuter: { ...StyleSheet.absoluteFill, borderRadius: 48, backgroundColor: colors.cyanTint },
  emptyInner: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 34,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyX: {
    position: 'absolute',
    right: 2,
    top: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { alignSelf: 'stretch', height: 1, backgroundColor: colors.line, marginTop: 12, marginBottom: 4 },
  catwrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { height: 40 },
  sheetDivider: { height: 1, backgroundColor: colors.line, marginVertical: 20 },
  verRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  verIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.okTint, alignItems: 'center', justifyContent: 'center' },
  distHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  ticks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  sortOpt: { paddingVertical: 12, paddingHorizontal: 14 },
  apply: { marginTop: 16 },
});
