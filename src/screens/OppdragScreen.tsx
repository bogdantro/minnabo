import { useMemo, useState } from 'react';
import { useActiveCategories } from '@/hooks/useCategories';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { useListings } from '@/api/queries';
import { useLocationScope, type Reach } from '@/lib/locationScope';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDismissedLeads } from '@/lib/dismissedLeads';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { slugForArtId, categoryArtId, categoryLabel } from '@/domain/categories';
import { colors, radius, screenPadding, shadow, text, type CategoryId } from '@/theme/theme';
import { HomeTopBar } from '@/components/TopBar';
import { LocationSheet } from '@/components/LocationSheet';
import { OppdragCard } from '@/components/OppdragCard';
import {
  Button,
  CategoryArt,
  Chip,
  ChipRow,
  ErrorState,
  FadeUp,
  Icon,
  ListingListSkeleton,
  Note,
  Pill,
  ScaleIn,
  Screen,
  SectionHeader,
} from '@/components/ui';

const SHOWN = 6;
/** "N nye" on the Oppdrag for meg card = open oppdrag in reach from the last 48 hours. */
const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Oppdrag – home and default route (design/screens/Oppdrag.dc.html). */
export function OppdragScreen() {
  const CATS = useActiveCategories();
  const me = useCurrentUser();
  const { municipality, municipalities, reach, setReach, setKommune, ready } = useLocationScope();
  const { dismissed } = useDismissedLeads();
  const [cat, setCat] = useState<CategoryId | null>(null);
  const [locOpen, setLocOpen] = useState(false);
  // Captured once per visit so the 'nye' count is stable while scrolling.
  const [openedAt] = useState(() => Date.now());

  const jobs = useListings({ type: 'TASK_REQUEST', municipalities }, 'NEWEST');
  const others = useMemo(() => (jobs.data ?? []).filter((l) => l.owner.id !== me.id), [jobs.data, me.id]);
  const shown = useMemo(
    () => (cat ? others.filter((l) => categoryArtId(l.category.slug) === cat) : others).slice(0, SHOWN),
    [others, cat],
  );
  const newForMe = useMemo(() => {
    const since = openedAt - NEW_WINDOW_MS;
    return others.filter((l) => !dismissed.has(l.id) && Date.parse(l.createdAt) >= since).length;
  }, [others, dismissed, openedAt]);

  const loading = jobs.isLoading || !ready;
  const refreshing = jobs.isFetching && !jobs.isLoading;
  const first = me.displayName.split(' ')[0] ?? '';
  const kommuneLabel = municipality ? nb.oppdrag.kommune(municipality) : nb.oppdrag.pickKommune;

  const applyLocation = (k: string, r: Reach) => {
    setLocOpen(false);
    setKommune(k);
    setReach(r);
    toast.success(nb.oppdrag.showing(nb.oppdrag.reach[r].name, k), { icon: 'pin' });
  };

  return (
    <Screen
      scroll
      spacer="nav"
      header={
        <HomeTopBar
          avatar={{ uri: me.avatarUrl, initials: me.initials }}
          onProfilePress={() => safePush('/profil')}
          onNotificationsPress={() => safePush('/varsler')}
        />
      }
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => jobs.refetch()}
            tintColor={colors.limeDeep}
            colors={[colors.limeDeep]}
          />
        ),
      }}
    >
      <FadeUp style={styles.heading}>
        <Text style={text.eyebrow}>{nb.oppdrag.hello(first)}</Text>
        <Text style={[text.h1, styles.h1]} accessibilityRole="header">
          {nb.oppdrag.title}
        </Text>
      </FadeUp>

      <FadeUp delay={100} style={styles.px}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${kommuneLabel}, ${nb.oppdrag.reach[reach].name}. ${nb.oppdrag.change}`}
          onPress={() => setLocOpen(true)}
          style={styles.loc}
        >
          <View style={styles.locIcon}>
            <Icon name="pin" size={18} color={colors.limeDeep} />
          </View>
          <View style={styles.locText}>
            <Text style={[text.bodySemi, styles.locTitle]} numberOfLines={1}>
              {kommuneLabel}
            </Text>
            <Text style={text.meta}>{nb.oppdrag.reach[reach].name}</Text>
          </View>
          <View style={styles.change}>
            <Text style={[text.pill, { color: colors.ink2 }]}>{nb.oppdrag.change}</Text>
            <Icon name="down" size={14} color={colors.ink2} />
          </View>
        </Pressable>
      </FadeUp>

      <FadeUp delay={150} style={[styles.px, styles.mt12]}>
        <Pressable
          accessibilityRole="search"
          accessibilityLabel={nb.oppdrag.searchA11y}
          onPress={() => safePush('/sok')}
          style={[styles.search, shadow.card]}
        >
          <Icon name="search" size={20} color={colors.mute} />
          <Text style={styles.searchPh} numberOfLines={1}>
            {nb.oppdrag.searchPh}
          </Text>
          <View style={styles.filt}>
            <Icon name="sliders" size={18} color={colors.white} />
          </View>
        </Pressable>
      </FadeUp>

      <FadeUp delay={200} style={styles.mt18}>
        <ChipRow>
          <Chip label={nb.oppdrag.all} icon="annet" selected={cat === null} onPress={() => setCat(null)} />
          {CATS.map((c) => (
            <Chip
              key={c}
              label={categoryLabel(c)}
              category={c}
              selected={cat === c}
              onPress={() => setCat(cat === c ? null : c)}
            />
          ))}
        </ChipRow>
      </FadeUp>

      <SectionHeader icon="clip" title={nb.oppdrag.needsTitle} subtitle={nb.oppdrag.needsSub} />

      <View style={styles.list}>
        {loading ? (
          <View style={styles.bleed}>
            <ListingListSkeleton count={3} />
          </View>
        ) : jobs.isError ? (
          <View style={styles.errorBox}>
            <ErrorState onRetry={() => void jobs.refetch()} retrying={jobs.isFetching} />
          </View>
        ) : shown.length === 0 ? (
          <ScaleIn style={[styles.empty, shadow.card]}>
            <View style={[styles.emptyIcon, !municipality && styles.emptyIconPin]}>
              <Icon name={municipality ? 'clip' : 'pin'} size={26} color={municipality ? colors.limeDeep : colors.cyanDeep} />
            </View>
            <Text style={styles.emptyTitle}>{municipality ? nb.oppdrag.empty(municipality) : nb.oppdrag.noKommuneTitle}</Text>
            <Text style={[text.meta, styles.center, styles.emptyBody]}>
              {!municipality ? nb.oppdrag.noKommuneBody : reach < 2 ? nb.oppdrag.emptyHint : nb.oppdrag.emptyHintWide}
            </Text>
            {!municipality ? (
              <Button label={nb.oppdrag.pickKommune} icon="pin" variant="ink" size="sm" block={false} align="center" onPress={() => setLocOpen(true)} style={styles.emptyCta} />
            ) : (
              <View style={styles.emptyBtns}>
                {reach < 2 ? (
                  <Button label={nb.oppdrag.widen} icon="locate" variant="ink" size="sm" block={false} onPress={() => setLocOpen(true)} />
                ) : null}
                <Button label={nb.oppdrag.emptyPost} icon="plus" variant={reach < 2 ? 'ghost' : 'ink'} size="sm" block={false} onPress={() => safePush('/legg-ut')} />
              </View>
            )}
          </ScaleIn>
        ) : (
          shown.map((l, i) => (
            <FadeUp key={l.id} delay={Math.min(i, 9) * 50}>
              <OppdragCard listing={l} />
            </FadeUp>
          ))
        )}
        <Button
          label={nb.oppdrag.seeAll}
          variant="ghost"
          iconRight="arrow"
          onPress={() => safePush(cat ? `/oppdrag-liste?category=${slugForArtId(cat)}` : '/oppdrag-liste')}
          style={styles.seeAll}
        />
      </View>

      <View style={[styles.px, styles.mt30]}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${nb.oppdrag.forMe}. ${nb.oppdrag.forMeSub}${newForMe ? `. ${nb.oppdrag.newCount(newForMe)}` : ''}`}
          onPress={() => safePush('/oppdrag-for-meg')}
          style={({ pressed }) => [styles.lead, pressed && styles.pressed]}
        >
          <View style={styles.leadGlow} />
          <View style={styles.leadArt}>
            <View style={styles.leadBack} />
            <CategoryArt category="montering" width={50} height={62} radius={12} iconSize={22} style={styles.leadFront} />
          </View>
          <View style={styles.leadText}>
            {newForMe ? <Pill label={nb.oppdrag.newCount(newForMe)} tone="accent" icon="sparkle" size="sm" style={styles.leadPill} /> : null}
            <Text style={[text.h3, styles.leadTitle]}>{nb.oppdrag.forMe}</Text>
            <Text style={[text.body, styles.leadSub]}>{nb.oppdrag.forMeSub}</Text>
          </View>
          <View style={styles.leadArrow}>
            <Icon name="arrow" size={20} color={colors.ink} />
          </View>
        </Pressable>
      </View>

      <View style={[styles.px, styles.mt22]}>
        <Note style={styles.noteCenter}>{nb.oppdrag.paymentNote}</Note>
      </View>

      <LocationSheet
        visible={locOpen}
        onClose={() => setLocOpen(false)}
        kommune={municipality}
        reach={reach}
        onApply={applyLocation}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding },
  mt12: { marginTop: 12 },
  mt18: { marginTop: 18 },
  mt22: { marginTop: 22 },
  mt30: { marginTop: 30 },
  center: { textAlign: 'center' },
  heading: { paddingHorizontal: screenPadding, paddingTop: 14, paddingBottom: 18, gap: 8 },
  h1: { fontSize: 33, lineHeight: 35, letterSpacing: -0.99 },
  loc: {
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.locButtonBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 8,
    paddingRight: 14,
  },
  locIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.limeTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locText: { flex: 1, minWidth: 0, gap: 2 },
  locTitle: { fontFamily: text.label.fontFamily, lineHeight: 18 },
  change: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  search: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 18,
    paddingRight: 6,
  },
  searchPh: { ...text.input, flex: 1, fontSize: 15.5, color: colors.mute },
  filt: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: screenPadding, gap: 12 },
  bleed: { marginHorizontal: -screenPadding },
  errorBox: { height: 360 },
  empty: {
    borderRadius: radius.listingCard,
    backgroundColor: colors.surface,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.limeTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyIconPin: { backgroundColor: colors.cyanTint },
  emptyTitle: { ...text.h3, fontSize: 18, lineHeight: 22, textAlign: 'center' },
  emptyBody: { maxWidth: 270 },
  emptyCta: { marginTop: 8 },
  emptyBtns: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  seeAll: { marginTop: 2 },
  lead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 26,
    backgroundColor: colors.ink,
    overflow: 'hidden',
  },
  pressed: { transform: [{ scale: 0.985 }] },
  leadGlow: {
    position: 'absolute',
    right: -40,
    top: -60,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: colors.lime,
    opacity: 0.35,
  },
  leadArt: { width: 62, height: 70 },
  leadBack: {
    position: 'absolute',
    left: 8,
    top: 0,
    width: 50,
    height: 62,
    borderRadius: 12,
    backgroundColor: colors.onInk14,
    transform: [{ rotate: '8deg' }],
  },
  leadFront: { position: 'absolute', left: 0, top: 6 },
  leadText: { flex: 1, gap: 5 },
  leadPill: { height: 22 },
  leadTitle: { color: colors.white, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.36 },
  leadSub: { fontSize: 13.5, lineHeight: 18.9, color: colors.onInk78 },
  leadArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCenter: { justifyContent: 'center' },
});
