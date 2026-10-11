import { useMemo, useState } from 'react';
import { useCategoryCatalog } from '@/hooks/useCategories';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import type { Listing } from '@/domain/types';
import { categoryArtId, categoryLabel } from '@/domain/categories';
import { useListings } from '@/api/queries';
import { useLocationScope, type Reach } from '@/lib/locationScope';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from '@/lib/toast';
import { colors, radius, screenPadding, shadow, text, type CategoryId } from '@/theme/theme';
import { LocationSheet } from '@/components/LocationSheet';
import { OppdragCard } from '@/components/OppdragCard';
import {
  Button,
  Chip,
  ChipRow,
  ErrorState,
  FadeUp,
  Icon,
  IconButton,
  ListingListSkeleton,
  PaymentNote,
  ScaleIn,
  Screen,
  SubHeader,
  TextLink,
  type IconKey,
} from '@/components/ui';

type Sort = 'near' | 'new' | 'low' | 'high';
const SORTS: { id: Sort; icon: IconKey }[] = [
  { id: 'near', icon: 'locate' },
  { id: 'new', icon: 'clock' },
  { id: 'low', icon: 'down' },
  { id: 'high', icon: 'up' },
];
const DAY_MS = 24 * 60 * 60 * 1000;

const price = (l: Listing, unknown: number) => (l.price ? l.price.amountMinor : unknown);

function sortList(list: Listing[], sort: Sort): Listing[] {
  const s = [...list];
  if (sort === 'near') s.sort((a, b) => (a.location.distanceKm ?? 999) - (b.location.distanceKm ?? 999));
  if (sort === 'new') s.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (sort === 'low') s.sort((a, b) => price(a, Number.MAX_SAFE_INTEGER) - price(b, Number.MAX_SAFE_INTEGER));
  if (sort === 'high') s.sort((a, b) => price(b, -1) - price(a, -1));
  return s;
}

/** Se alle oppdrag (design/screens/SeAlle.dc.html). Oppdrag only (rule 1). */
export function SeeAllScreen({ initialCategory }: { initialCategory?: string }) {
  useCategoryCatalog(); // labels and colours follow the website's settings
  const router = useRouter();
  const me = useCurrentUser();
  const { municipality, municipalities, reach, setReach, setKommune, ready } = useLocationScope();
  const jobs = useListings({ type: 'TASK_REQUEST', municipalities }, 'NEWEST');
  const [cat, setCat] = useState<CategoryId | null>(initialCategory ? categoryArtId(initialCategory) : null);
  const [sort, setSort] = useState<Sort>('near');
  const [menu, setMenu] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const all = useMemo(() => (jobs.data ?? []).filter((l) => l.owner.id !== me.id), [jobs.data, me.id]);
  const present = useMemo(() => {
    const seen: CategoryId[] = [];
    for (const l of all) {
      const c = categoryArtId(l.category.slug);
      if (!seen.includes(c)) seen.push(c);
    }
    return seen;
  }, [all]);
  const items = useMemo(() => sortList(cat ? all.filter((l) => categoryArtId(l.category.slug) === cat) : all, sort), [all, cat, sort]);
  const loading = jobs.isLoading || !ready;

  const applyLocation = (k: string, r: Reach) => {
    setLocOpen(false);
    setKommune(k);
    setReach(r);
    toast.success(nb.oppdrag.showing(nb.oppdrag.reach[r].name, k), { icon: 'pin' });
  };

  return (
    <View style={styles.flex}>
      <Screen
        scroll
        header={
          <SubHeader
            title={nb.seAlle.title}
            onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            right={<IconButton icon="search" iconSize={18} accessibilityLabel={nb.seAlle.search} onPress={() => router.push('/sok')} />}
          />
        }
        scrollProps={{
          refreshControl: <RefreshControl refreshing={jobs.isFetching && !jobs.isLoading} onRefresh={() => jobs.refetch()} tintColor={colors.limeDeep} />,
        }}
      >
        <View style={styles.locline}>
          <View style={styles.row8}>
            <Icon name="pin" size={16} color={colors.faint} />
            <Text style={[text.bodySemi, styles.locText]} numberOfLines={1}>
              {municipality ? `${nb.oppdrag.kommune(municipality)} · ${nb.oppdrag.reach[reach].name}` : nb.oppdrag.reach[2].name}
            </Text>
          </View>
          <TextLink label={nb.seAlle.change} icon={null} onPress={() => setLocOpen(true)} />
        </View>

        <ChipRow style={styles.chips}>
          <Chip label={nb.seAlle.all} icon="annet" selected={cat === null} onPress={() => setCat(null)} />
          {present.map((c) => (
            <Chip key={c} label={categoryLabel(c)} category={c} selected={cat === c} onPress={() => setCat(c)} />
          ))}
        </ChipRow>

        <View style={styles.countRow}>
          <View style={styles.gap3}>
            {/* No count while loading or on error – "0 oppdrag" would be wrong. */}
            {!loading && !jobs.isError ? <Text style={[text.h3, { fontSize: 19 }]}>{nb.seAlle.count(items.length)}</Text> : null}
            <Text style={text.meta}>{nb.seAlle.sub(cat ? categoryLabel(cat) : null, nb.seAlle.sorts[sort])}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: menu }}
            onPress={() => setMenu((m) => !m)}
            style={styles.sortbtn}
          >
            <Icon name="sliders" size={16} color={colors.mute} />
            <Text style={[text.segment, { fontSize: 13.5 }]}>{nb.seAlle.sorts[sort]}</Text>
            <Icon name="down" size={16} color={colors.mute} />
          </Pressable>
          {menu ? (
            <ScaleIn style={[styles.menu, shadow.large]}>
              <View accessibilityRole="menu">
                <Text style={[text.eyebrow, styles.menuHead]}>{nb.seAlle.sortBy}</Text>
                {SORTS.map((s) => {
                  const on = sort === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      accessibilityRole="menuitem"
                      accessibilityState={{ checked: on }}
                      onPress={() => {
                        setSort(s.id);
                        setMenu(false);
                      }}
                      style={[styles.menuItem, on && styles.menuOn]}
                    >
                      <Icon name={s.icon} size={18} color={colors.faint} />
                      <Text style={[text.bodySemi, styles.flex, { fontSize: 14.5 }]}>{nb.seAlle.sorts[s.id]}</Text>
                      {on ? <Icon name="check" size={18} color={colors.ink} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScaleIn>
          ) : null}
        </View>

        <View style={styles.list}>
          {loading ? (
            <View style={styles.bleed}>
              <ListingListSkeleton count={4} />
            </View>
          ) : jobs.isError ? (
            <View style={styles.errorBox}>
              <ErrorState onRetry={() => void jobs.refetch()} retrying={jobs.isFetching} />
            </View>
          ) : items.length === 0 ? (
            <ScaleIn style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="clip" size={24} color={colors.limeDeep} />
              </View>
              <Text style={[text.label, { fontSize: 15.5, textAlign: 'center' }]}>
                {cat ? nb.seAlle.emptyTitle : nb.seAlle.emptyAll}
              </Text>
              <Text style={[text.meta, { textAlign: 'center' }]}>{nb.seAlle.emptyBody}</Text>
              {cat ? (
                <Button label={nb.seAlle.showAllCats} variant="ghost" size="sm" block={false} align="center" onPress={() => setCat(null)} />
              ) : (
                <Button label={nb.oppdrag.widen} variant="ghost" size="sm" block={false} align="center" onPress={() => setLocOpen(true)} />
              )}
            </ScaleIn>
          ) : (
            items.map((l, i) => (
              <FadeUp key={l.id} delay={Math.min(i + 1, 10) * 50}>
                <OppdragCard
                  listing={l}
                  statusBadge={undefined}
                  showVerified={false}
                  isNew={Date.parse(l.createdAt) >= openedAt - DAY_MS}
                />
              </FadeUp>
            ))
          )}
          <PaymentNote style={styles.note} />
        </View>
        <View style={styles.bottom} />
      </Screen>

      {menu ? (
        <Pressable accessibilityRole="button" accessibilityLabel={nb.seAlle.closeMenu} style={styles.mscrim} onPress={() => setMenu(false)} />
      ) : null}

      <LocationSheet
        visible={locOpen}
        onClose={() => setLocOpen(false)}
        kommune={municipality}
        reach={reach}
        onApply={applyLocation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap3: { gap: 3, flexShrink: 1 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  locline: {
    marginTop: 14,
    paddingHorizontal: screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locText: { fontSize: 13.5, color: colors.ink2, flexShrink: 1 },
  chips: { marginTop: 6 },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    marginTop: 14,
    marginBottom: 12,
    zIndex: 21,
  },
  sortbtn: {
    height: 40,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menu: {
    position: 'absolute',
    right: screenPadding,
    top: 46,
    width: 228,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line2,
    padding: 6,
    zIndex: 21,
  },
  menuHead: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 6 },
  menuItem: { minHeight: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  menuOn: { backgroundColor: colors.bg },
  mscrim: { ...StyleSheet.absoluteFill, zIndex: 20 },
  list: { paddingHorizontal: screenPadding, gap: 12 },
  bleed: { marginHorizontal: -screenPadding },
  errorBox: { height: 380 },
  empty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: radius.option,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  note: { justifyContent: 'center', marginTop: 8 },
  bottom: { height: 60 },
});
