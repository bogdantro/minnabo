import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import Animated, { LinearTransition, ZoomOut } from 'react-native-reanimated';
import type { Listing } from '@/domain/types';
import type { SavedSearchRecord } from '@/api/ApiClient';
import { apiClient } from '@/api/client';
import {
  listingKeys,
  useAddSavedSearch,
  useMarkSavedSearchRun,
  useSetSavedSearchAlert,
  useFollowedProfileIds,
  useProfile,
  useRemoveSavedSearch,
  useSavedListingIds,
  useSavedSearches,
  useToggleSavedListing,
} from '@/api/queries';
import { categoryArtId, categoryBySlug } from '@/domain/categories';
import { isOpenListing, isTakenListing } from '@/domain/editing';
import nb from '@/i18n/nb';
import { dayMonth } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { listingPlace, listingPrice, listingSchedule } from '@/components/OppdragCard';
import {
  Avatar,
  Button,
  FadeUp,
  Icon,
  IconButton,
  ListGroup,
  ListingCard,
  ListingListSkeleton,
  ListRow,
  Note,
  PressableScale,
  PAYMENT_NOTE,
  Screen,
  Segmented,
  SubHeader,
  type IconName,
} from '@/components/ui';

type Tab = 'list' | 'search' | 'helpers';

/** Lagrede (design/screens/Lagrede.dc.html). */
export function SavedScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('list');

  const { data: savedIds = [], isLoading: idsLoading } = useSavedListingIds();
  const { data: searches = [] } = useSavedSearches();
  const { data: followedIds = [] } = useFollowedProfileIds();
  const toggleSaved = useToggleSavedListing();

  const listingQueries = useQueries({
    queries: savedIds.map((id) => ({
      queryKey: listingKeys.detail(id),
      queryFn: () => apiClient.getListing(id),
      retry: false,
    })),
  });
  const listings = listingQueries.map((q) => q.data).filter((l): l is Listing => !!l);
  const loading = idsLoading || listingQueries.some((q) => q.isLoading);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const unsave = (l: Listing) => {
    haptics.light();
    toggleSaved.mutate(l.id);
    toast.success(nb.saved.unsaved, {
      icon: 'heart',
      action: { label: nb.saved.undo, onPress: () => toggleSaved.mutate(l.id) },
    });
  };

  const tabs = [
    { value: 'list' as const, label: nb.saved.listingsTab(listings.length) },
    { value: 'search' as const, label: nb.saved.searchesTab(searches.length) },
    // Followed helpers aren't in the design, but following still exists on Profil – keep the list reachable.
    ...(followedIds.length ? [{ value: 'helpers' as const, label: nb.saved.helpersTab(followedIds.length) }] : []),
  ];

  return (
    <Screen
      scroll
      spacer="none"
      header={
        <SubHeader
          title={nb.saved.title}
          onBack={back}
          right={<IconButton icon="search" iconSize={18} accessibilityLabel={nb.saved.searchLabel} onPress={() => safePush('/sok')} />}
        />
      }
    >
      <FadeUp style={[styles.px, styles.pt8]}>
        <Text style={text.h1} accessibilityRole="header">
          {nb.saved.title}
        </Text>
        <Text style={[text.meta, styles.mt8]}>{nb.saved.sub}</Text>
      </FadeUp>

      <FadeUp delay={80} style={[styles.px, styles.mt18]}>
        <Segmented accessibilityLabel={nb.saved.segLabel} value={tab} onChange={setTab} options={tabs} />
      </FadeUp>

      {tab === 'list' ? (
        <View style={[styles.px, styles.stack12, styles.mt22]}>
          {loading && !listings.length ? (
            <ListingListSkeleton />
          ) : listings.length ? (
            listings.map((l) => {
              const price = listingPrice(l);
              return (
                <Animated.View key={l.id} exiting={ZoomOut.duration(300)} layout={LinearTransition.duration(300)}>
                  <ListingCard
                    title={l.title}
                    statusBadge={
                      isOpenListing(l.status)
                        ? undefined
                        : { label: isTakenListing(l.status) ? nb.saved.takenBadge : nb.saved.unavailableBadge, tone: 'dark' }
                    }
                    category={categoryArtId(l.category.slug)}
                    photoUri={l.images[0]?.url}
                    ownerName={l.owner.displayName}
                    ownerRating={l.owner.rating?.count ? l.owner.rating.average : null}
                    place={listingPlace(l)}
                    schedule={listingSchedule(l)}
                    priceLabel={price.label}
                    priceValue={price.value}
                    saved
                    onToggleSave={() => unsave(l)}
                    saveLabel={nb.saved.unsaveAria(l.title)}
                    onPress={() => safePush(`/oppdrag/${l.id}`)}
                  />
                </Animated.View>
              );
            })
          ) : (
            <EmptyCard
              icon="heart"
              bg={colors.savedBg}
              fg={colors.heart}
              title={nb.saved.emptyListTitle}
              body={nb.saved.emptyListText}
              cta={<Button label={nb.saved.explore} variant="ink" size="sm" iconRight="arrow" block={false} onPress={() => safePush('/')} />}
            />
          )}
          <Note style={[styles.center, styles.mt8]}>{PAYMENT_NOTE}</Note>
        </View>
      ) : tab === 'search' ? (
        <View style={[styles.px, styles.stack12, styles.mt18]}>
          {searches.length ? <Note icon="bell">{nb.saved.alertNote}</Note> : null}
          {searches.map((s) => (
            <Animated.View key={s.id} exiting={ZoomOut.duration(300)} layout={LinearTransition.duration(300)}>
              <SearchCard search={s} />
            </Animated.View>
          ))}
          {searches.length === 0 ? (
            <EmptyCard
              icon="bookmark"
              bg={colors.cyanTint}
              fg={colors.cyanDeep}
              title={nb.saved.emptySearchTitle}
              body={nb.saved.emptySearchText}
              cta={<Button label={nb.saved.goSearch} variant="ink" size="sm" icon="search" block={false} onPress={() => safePush('/sok')} />}
            />
          ) : null}
        </View>
      ) : (
        <View style={[styles.px, styles.mt18]}>
          {followedIds.length ? (
            <ListGroup style={shadow.card}>
              {followedIds.map((id) => (
                <FollowedRow key={id} profileId={id} />
              ))}
            </ListGroup>
          ) : (
            <Text style={text.meta}>{nb.saved.emptyHelpers}</Text>
          )}
        </View>
      )}

      <View style={styles.bottom} />
    </Screen>
  );
}

function FollowedRow({ profileId }: { profileId: string }) {
  const { data: p } = useProfile(profileId);
  return (
    <ListRow
      title={p?.displayName ?? '…'}
      subtitle={p?.location.place}
      leading={<Avatar uri={p?.avatarUrl} initials={p?.initials ?? '?'} seed={profileId} size={40} ring={false} />}
      chevron
      onPress={() => safePush(`/profil/${profileId}`)}
    />
  );
}

function filterChips(s: SavedSearchRecord): { icon: IconName; label: string }[] {
  const out: { icon: IconName; label: string }[] = [];
  const f = s.filter;
  if (f.categorySlug && f.categorySlug !== 'alle') {
    out.push({ icon: categoryArtId(f.categorySlug), label: categoryBySlug(f.categorySlug).label });
  }
  const m = f.municipalities ?? [];
  if (m.length === 1) out.push({ icon: 'pin', label: m[0] });
  else if (m.length > 1) out.push({ icon: 'pin', label: nb.saved.neighbours(m[0]) });
  if (f.verifiedOnly) out.push({ icon: 'shield', label: nb.saved.verifiedOnly });
  if (s.sort === 'NEWEST') out.push({ icon: 'clock', label: nb.saved.newest });
  if (s.sort === 'PRICE') out.push({ icon: 'tag', label: nb.saved.cheapest });
  return out;
}

function SearchCard({ search: s }: { search: SavedSearchRecord }) {
  const remove = useRemoveSavedSearch();
  const add = useAddSavedSearch();
  const setAlert = useSetSavedSearchAlert();
  const markRun = useMarkSavedSearchRun();
  // optimistic bell, falls back to the stored value if saving fails
  const [bell, setBell] = useState<boolean | null>(null);
  const alertOn = bell ?? !!s.alert;
  // "Nye treff" = matches posted since the search was last run (or saved).
  const [{ data: hits }] = useQueries({
    queries: [{ queryKey: listingKeys.list(s.filter, s.sort), queryFn: () => apiClient.listListings({ filter: s.filter, sort: s.sort }) }],
  });
  const since = s.lastRunAt ?? s.createdAt;
  const fresh = (hits ?? []).filter((l) => l.createdAt > since).length;
  const q = s.filter.query?.trim() || s.name;
  const chips = filterChips(s);
  const meta = [
    s.name !== q ? s.name : null,
    nb.saved.savedOn(dayMonth(s.createdAt)),
    s.lastRunAt ? nb.saved.lastRun(dayMonth(s.lastRunAt)) : null,
    alertOn ? nb.saved.alertOn : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const toggleBell = () => {
    const on = !alertOn;
    haptics.light();
    setBell(on);
    setAlert.mutate(
      { id: s.id, alert: on },
      {
        onSuccess: () => toast.success(on ? nb.saved.alertOnToast(q) : nb.saved.alertOffToast(q), { icon: on ? 'bell' : 'x' }),
        onError: () => {
          setBell(null);
          toast.error(nb.toast.genericError);
        },
      },
    );
  };

  const del = () => {
    haptics.light();
    remove.mutate(s.id);
    toast.success(nb.saved.deleted(q), {
      icon: 'trash',
      action: { label: nb.saved.undo, onPress: () => add.mutate({ name: s.name, filter: s.filter, sort: s.sort, alert: s.alert }) },
    });
  };
  const run = () => {
    markRun.mutate(s.id);
    const params = new URLSearchParams();
    if (s.filter.query) params.set('q', s.filter.query);
    if (s.filter.categorySlug && s.filter.categorySlug !== 'alle') params.set('category', s.filter.categorySlug);
    const qs = params.toString();
    safePush(qs ? `/sok?${qs}` : '/sok');
  };

  return (
    <FadeUp style={[styles.ss, shadow.card]}>
      <View style={styles.ssTop}>
        <View style={styles.ssIcon}>
          <Icon name="search" size={18} color={colors.ink} />
        </View>
        <View style={styles.ssBody}>
          <Text style={styles.q}>{`«${q}»`}</Text>
          {fresh > 0 ? (
            <View style={styles.newb}>
              <View style={styles.newDot} />
              <Text style={styles.newText}>{nb.saved.newHits(fresh)}</Text>
            </View>
          ) : (
            <Text style={[text.meta, styles.f125]}>{nb.saved.noNewHits}</Text>
          )}
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ selected: alertOn }}
          accessibilityLabel={alertOn ? nb.saved.alertOffAria(q) : nb.saved.alertOnAria(q)}
          onPress={toggleBell}
          scaleTo={0.9}
          style={[styles.bell, alertOn && styles.bellOn]}
        >
          <Icon name="bell" size={18} color={alertOn ? colors.limeDeep : colors.mute} />
        </PressableScale>
      </View>
      {chips.length ? (
        <View style={styles.fl}>
          {chips.map((c) => (
            <View key={c.label} style={styles.flChip}>
              <Icon name={c.icon} size={14} color={colors.ink2} />
              <Text style={styles.flText}>{c.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.ssFoot}>
        <Text style={[text.meta, styles.f125, styles.flex]}>{meta}</Text>
        <IconButton icon="trash" variant="ghost" iconSize={18} iconColor={colors.danger} accessibilityLabel={nb.saved.deleteAria(q)} onPress={del} />
        <Button label={nb.saved.runSearch} variant="ink" size="sm" iconRight="arrow" block={false} onPress={run} />
      </View>
    </FadeUp>
  );
}

function EmptyCard({ icon, bg, fg, title, body, cta }: { icon: IconName; bg: string; fg: string; title: string; body: string; cta: ReactNode }) {
  return (
    <FadeUp style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={24} color={fg} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={[text.meta, styles.emptyText]}>{body}</Text>
      <View style={styles.mt6}>{cta}</View>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  pt8: { paddingTop: 8 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt18: { marginTop: 18 },
  mt22: { marginTop: 22 },
  f125: { fontSize: 12.5 },
  stack12: { gap: 12 },
  center: { justifyContent: 'center' },
  bottom: { height: 60 },
  ss: { backgroundColor: colors.surface, borderRadius: 26, padding: 16, gap: 12 },
  ssTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellOn: { backgroundColor: colors.limeTint, borderColor: colors.chipLimeBorder },
  ssIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  ssBody: { flex: 1, minWidth: 0, gap: 6 },
  q: { fontFamily: fonts.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.36, color: colors.ink },
  newb: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
  },
  newDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink },
  newText: { fontFamily: fonts.bodyHeavy, fontSize: 11.5, color: colors.ink },
  fl: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radius.s,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  flText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink2 },
  ssFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.line2 },
  empty: {
    paddingVertical: 30,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: 20,
    backgroundColor: colors.dashedCardBg,
  },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.display, fontSize: 17, lineHeight: 21, color: colors.ink, textAlign: 'center' },
  emptyText: { maxWidth: 250, textAlign: 'center' },
});
