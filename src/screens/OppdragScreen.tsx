import { useMemo, useRef, useState } from 'react';
import { useNetworkState } from 'expo-network';
import {
  useListings,
  useMyAgreements,
  useMyNabolag,
  useNeighbourhoodHighlights,
  useSavedListingIds,
  useSavedSearches,
  useToggleSavedListing,
} from '@/api/queries';
import { useLocalSet } from '@/lib/localSet';
import { useDayWeather, OUTDOOR_SLUGS } from '@/lib/dayWeather';
import { shareInvite, shareListing } from '@/lib/share';
import { isUrgent } from '@/domain/urgent';
import { COMPACT_KEY, FeedContext, HIDDEN_CATS_KEY, HIDDEN_KEY, useFeedFacts } from '@/components/oppdrag/feed';
import {
  CardMenuSheet,
  CombineCard,
  InviteCard,
  MiniStrip,
  MonthHeroes,
  RehireCard,
  combineSuggestion,
  rehireCandidate,
} from '@/components/oppdrag/OppdragExtras';
import { ListingsMap } from '@/components/ListingsMap';
import type { Listing } from '@/domain/types';
import { useActiveCategories } from '@/hooks/useCategories';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { nearFirst, townLabel } from '@/lib/places';
import nb from '@/i18n/nb';
import { isEnabled } from '@/config/featureFlags';
import { useLocationScope, type Reach } from '@/lib/locationScope';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDismissedLeads } from '@/lib/dismissedLeads';
import { safePush } from '@/lib/nav';
import { useTabReselect } from '@/lib/tabReselect';
import { toast } from '@/lib/toast';
import { slugForArtId, categoryArtId, categoryLabel } from '@/domain/categories';
import { colors, radius, screenPadding, shadow, text, type CategoryId } from '@/theme/theme';
import { HomeTopBar } from '@/components/TopBar';
import { LocationSheet } from '@/components/LocationSheet';
import { OppdragCard } from '@/components/OppdragCard';
import { DraftCard } from '@/components/DraftCard';
import { PhotoNudgeCard } from '@/components/PhotoNudgeCard';
import { useNewOppdragWidget } from '@/lib/widgetSync';
import { SeasonalRow } from '@/components/SeasonalRow';
import { JobDayCard } from '@/components/JobDayCard';
import { kommuneGroup, kommuneGroupNames } from '@/data/kommuner';
import {
  Button,
  CategoryArt,
  Chip,
  ChipRow,
  ErrorState,
  FadeUp,
  Icon,
  ListingListSkeleton,
  PaymentNote,
  Pill,
  ScaleIn,
  Screen,
  SectionHeader,
  Segmented,
} from '@/components/ui';

/** Oppdrag (or «Tilbyr hjelp») on the home list before «Se alle» (at least 14, asked 2026-11-12). */
const SHOWN = 14;

/** 15. nov 2026 -> '2026-11-15', in the phone's own time zone. */
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** "N nye" on the Oppdrag for meg card = open oppdrag in reach from the last 48 hours. */
const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Oppdrag – home and default route (design/screens/Oppdrag.dc.html). */
export function OppdragScreen() {
  const CATS = useActiveCategories();
  const me = useCurrentUser();
  const { municipality, municipalities, reach, setReach, setKommune, ready, town } = useLocationScope();
  const { dismissed } = useDismissedLeads();
  const [cat, setCat] = useState<CategoryId | null>(null);
  const [locOpen, setLocOpen] = useState(false);
  // Captured once per visit so the 'nye' count is stable while scrolling.
  const [openedAt] = useState(() => Date.now());

  // «Trenger hjelp» (oppdrag) or «Tilbyr hjelp» (naboer who offer, 0076)
  const [kind, setKind] = useState<'need' | 'offer'>('need');
  const tasks = useListings({ type: 'TASK_REQUEST', municipalities }, 'NEWEST');
  // the home screen widget shows the newest of these
  useNewOppdragWidget(tasks.data, municipality ?? undefined, me.id);
  const offers = useListings({ type: 'SERVICE_OFFER', municipalities }, 'NEWEST', kind === 'offer');
  const jobs = kind === 'offer' ? offers : tasks;
  const others = useMemo(() => (jobs.data ?? []).filter((l) => l.owner.id !== me.id), [jobs.data, me.id]);
  // «Oppdrag for meg» counts oppdrag only, whichever tab is open
  const newForMe = useMemo(() => {
    const since = openedAt - NEW_WINDOW_MS;
    return (tasks.data ?? []).filter((l) => l.owner.id !== me.id && !dismissed.has(l.id) && Date.parse(l.createdAt) >= since).length;
  }, [tasks.data, me.id, dismissed, openedAt]);

  // ---- 0110: sorting, the lists kept on the phone, the extra sections
  const [sort, setSort] = useState<'near' | 'newest' | 'urgent'>('near');
  const [limit, setLimit] = useState(SHOWN);
  const [hidden, toggleHidden, setHidden] = useLocalSet(HIDDEN_KEY);
  const [hiddenCats, toggleHiddenCat, setHiddenCats] = useLocalSet(HIDDEN_CATS_KEY);
  const [compactIds, toggleCompact] = useLocalSet(COMPACT_KEY);
  const compact = compactIds.includes('on');
  const [menuFor, setMenuFor] = useState<Listing | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const savedIds = useSavedListingIds().data ?? [];
  const toggleSaved = useToggleSavedListing();
  const weather = useDayWeather(municipality ?? undefined).data;
  const agenda = useMyAgreements().data ?? [];
  const myNabolag = useMyNabolag(!!me.id).data ?? [];
  const heroes = useNeighbourhoodHighlights(municipality).data ?? [];
  const savedSearches = useSavedSearches().data ?? [];
  const net = useNetworkState();
  const { width } = useWindowDimensions();
  const twoCols = width >= 900;
  const todayKey = localDay(new Date(openedAt));
  const tomorrowKey = localDay(new Date(openedAt + 86_400_000));
  // a new category, sort or kind starts the list from the top again
  const listKey = `${kind}|${cat ?? ''}|${sort}`;
  const [seenListKey, setSeenListKey] = useState(listKey);
  if (seenListKey !== listKey) {
    setSeenListKey(listKey);
    setLimit(SHOWN);
  }
  const visible = useMemo(
    () => others.filter((l) => !hidden.includes(l.id) && !hiddenCats.includes(l.category.slug)),
    [others, hidden, hiddenCats],
  );
  const sorted = useMemo(() => {
    const pool = cat ? visible.filter((l) => categoryArtId(l.category.slug) === cat) : visible;
    if (sort === 'newest') return [...pool].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (sort === 'urgent') return [...pool].sort((a, b) => Number(isUrgent(b)) - Number(isUrgent(a)) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const near = nearFirst(pool, town);
    // a sunny day: outdoor jobs first (after hasteoppdrag)
    return weather?.today === 'sun' && kind === 'need'
      ? [...near].sort((a, b) => Number(isUrgent(b)) - Number(isUrgent(a)) || Number(OUTDOOR_SLUGS.includes(b.category.slug)) - Number(OUTDOOR_SLUGS.includes(a.category.slug)))
      : near;
  }, [visible, cat, sort, town, weather, kind]);
  const feedList = sorted.slice(0, limit);
  const facts = useFeedFacts(feedList);
  const catCount = (c: CategoryId) => visible.filter((l) => categoryArtId(l.category.slug) === c).length;
  const needs = kind === 'need' ? visible : [];
  const urgentList = needs.filter(isUrgent);
  const soonList = needs.filter((l) => (l.task?.scheduledDays ?? []).some((d) => d === todayKey || d === tomorrowKey));
  const lastChance = needs.filter((l) => {
    const days = l.task?.scheduledDays ?? [];
    return days.length > 0 && days[days.length - 1] >= todayKey && days[days.length - 1] <= tomorrowKey;
  });
  const weekendOutdoor = weather?.weekendSun ? needs.filter((l) => OUTDOOR_SLUGS.includes(l.category.slug)) : [];
  const helpedIds = new Set(agenda.filter((a) => a.role === 'HELPER').map((a) => a.counterpartId));
  const helpedBefore = needs.filter((l) => helpedIds.has(l.owner.id));
  const combine = kind === 'need' ? combineSuggestion(needs, todayKey) : null;
  const rehire = rehireCandidate(agenda, new Date(openedAt));
  const hour = new Date(openedAt).getHours();
  const hello = hour < 10 ? nb.op.greeting.morning : hour >= 18 ? nb.op.greeting.evening : nb.op.greeting.day;
  const feedInfo = {
    offerCounts: facts.offerCounts,
    fast: facts.fast,
    nabolagPlaces: new Set(myNabolag.map((n) => n.place)),
    kommune: municipality ?? undefined,
    compact,
    onMenu: setMenuFor,
  };

  const loading = jobs.isLoading || !ready;
  const refreshing = jobs.isFetching && !jobs.isLoading;
  const first = me.displayName.split(' ')[0] ?? '';
  const kommuneLabel = municipality ? townLabel(town, municipality) : nb.oppdrag.pickKommune;
  // 'Lillehammer' -> 'Øyer og Gausdal': the kommuner that count as one area with mine
  const groupMates = municipality ? kommuneGroup(municipality).slice(1) : [];
  const alongKommuner = groupMates.length > 1 ? `${groupMates.slice(0, -1).join(', ')} og ${groupMates[groupMates.length - 1]}` : groupMates[0];

  // tap «Oppdrag» again: back to the top, with the newest oppdrag
  const scrollRef = useRef<ScrollView>(null);
  useTabReselect('oppdrag', () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    void jobs.refetch();
  });

  const applyLocation = (k: string, r: Reach, place?: string) => {
    setLocOpen(false);
    setKommune(k, place);
    setReach(r);
    toast.success(nb.oppdrag.showing(nb.oppdrag.reach[r].name, k), { icon: 'pin' });
  };

  return (
    <Screen
      scroll
      spacer="nav"
      scrollRef={scrollRef}
      header={
        <View>
          <HomeTopBar
            avatar={{ uri: me.avatarUrl, initials: me.initials }}
            onProfilePress={() => safePush('/profil')}
            onNotificationsPress={() => safePush('/varsler')}
          />
          {/* the job day: pinned under the top bar while scrolling */}
          <JobDayCard />
        </View>
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
        <Text style={text.eyebrow}>
          {nb.op.greeting.line(hello, first)}
          {weather?.today && municipality ? ` – ${nb.op.greeting.weather[weather.today](municipality)}` : ''}
        </Text>
        <Text style={[text.h1, styles.h1]} accessibilityRole="header">
          {nb.oppdrag.title}
        </Text>
      </FadeUp>

      <FadeUp delay={100} style={styles.px}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${kommuneLabel}, ${nb.oppdrag.reach[reach].name}${reach === 0 && alongKommuner ? `, ${nb.oppdrag.withKommuner(alongKommuner)}` : ''}. ${nb.oppdrag.change}`}
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
            {/* one short line: what «Bare min kommune» covers is counted here and named in the sheet */}
            <Text style={text.meta} numberOfLines={1}>
              {reach === 0 && groupMates.length
                ? `${nb.oppdrag.reach[0].short} · ${nb.oppdrag.alongCount(groupMates.length)}`
                : nb.oppdrag.reach[reach].name}
            </Text>
          </View>
          {/* text only: the slider icon belongs to the filter button right below */}
          <View style={styles.change}>
            <Text style={styles.changeText}>{nb.oppdrag.change}</Text>
          </View>
        </Pressable>
      </FadeUp>

      {/* a half-written oppdrag is never forgotten */}
      <DraftCard style={[styles.px, styles.mt12]} />
      {/* no profile picture yet: naboer answer someone they can see */}
      <PhotoNudgeCard style={[styles.px, styles.mt12]} />

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

      {savedSearches.length ? (
        <View style={styles.mt12}>
          <ChipRow>
            {savedSearches.slice(0, 6).map((sv) => {
              const since = sv.lastRunAt ? Date.parse(sv.lastRunAt) : 0;
              const fresh = (tasks.data ?? []).filter(
                (l) =>
                  Date.parse(l.createdAt) > since &&
                  (!sv.filter.query || `${l.title} ${l.task?.description ?? ''}`.toLowerCase().includes(sv.filter.query.toLowerCase())) &&
                  (!sv.filter.categorySlugs?.length || sv.filter.categorySlugs.includes(l.category.slug)),
              ).length;
              const q = [sv.filter.query ? `q=${encodeURIComponent(sv.filter.query)}` : '', sv.filter.categorySlugs?.length ? `cats=${sv.filter.categorySlugs.join(',')}` : ''].filter(Boolean).join('&');
              return (
                <Chip
                  key={sv.id}
                  label={sv.name}
                  icon="bookmark"
                  size="sm"
                  onPress={() => safePush(q ? `/sok?${q}` : '/sok')}
                  trailing={fresh ? <Pill label={String(fresh)} tone="accent" /> : undefined}
                />
              );
            })}
          </ChipRow>
        </View>
      ) : null}

      {/* what neighbours usually need this time of year – one tap starts Legg ut with it chosen */}
      {kind === 'need' ? <SeasonalRow style={styles.mt18} /> : null}

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
              trailing={catCount(c) ? <Pill label={String(catCount(c))} tone={cat === c ? 'accent' : 'neutral'} /> : undefined}
            />
          ))}
        </ChipRow>
      </FadeUp>

      <View style={[styles.px, styles.mt18]}>
        <Segmented
          accessibilityLabel={nb.oppdrag.title}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setCat(null);
          }}
          options={[
            { value: 'need', label: nb.offer.segNeed },
            { value: 'offer', label: nb.offer.segOffer },
          ]}
        />
      </View>
      {kind === 'need' && !cat ? (
        <>
          {rehire ? <RehireCard item={rehire} /> : null}
          <MiniStrip icon="zap" tone="warn" title={nb.op.sections.urgent} sub={nb.op.sections.urgentSub} listings={urgentList} testID="strip-urgent" />
          <MiniStrip icon="cal" tone="lime" title={nb.op.sections.soon} sub={nb.op.sections.soonSub} listings={soonList} testID="strip-soon" />
          {weekendOutdoor.length ? <MiniStrip icon="sun" tone="cyan" title={nb.op.sections.weekend(weekendOutdoor.length)} sub={nb.op.sections.weekendSub} listings={weekendOutdoor} /> : null}
          <MiniStrip icon="hourglass" tone="ink" title={nb.op.sections.lastChance} sub={nb.op.sections.lastChanceSub} listings={lastChance} testID="strip-last" />
          <MiniStrip icon="heart" tone="lime" title={nb.op.sections.helpedBefore} listings={helpedBefore} />
          {combine ? <CombineCard s={combine} /> : null}
          {municipality ? <MonthHeroes heroes={heroes} kommune={municipality} /> : null}
        </>
      ) : null}

      {kind === 'need' ? (
        <SectionHeader icon="clip" title={nb.oppdrag.needsTitle} subtitle={nb.oppdrag.needsSub} />
      ) : (
        <SectionHeader icon="hand" title={nb.offer.offersTitle} subtitle={nb.offer.offersSub} />
      )}

      <View style={[styles.px, styles.tools]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolsRow} accessibilityRole="radiogroup" accessibilityLabel={nb.op.sort.label}>
          {(['near', 'newest', 'urgent'] as const).map((k) => (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: sort === k }} onPress={() => setSort(k)} style={[styles.sortChip, sort === k && styles.sortChipOn]}>
              <Text style={[styles.sortText, sort === k && styles.sortTextOn]}>{nb.op.sort[k]}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel={compact ? nb.op.view.cards : nb.op.view.compact} onPress={() => toggleCompact('on')} style={styles.toolBtn}>
            <Icon name={compact ? 'image' : 'list'} size={16} color={colors.ink} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={nb.op.map(visible.length)} onPress={() => setMapOpen(true)} style={styles.toolBtn}>
            <Icon name="map" size={16} color={colors.ink} />
          </Pressable>
        </ScrollView>
        {hiddenCats.length || hidden.length ? (
          <Pressable accessibilityRole="button" onPress={() => { setHiddenCats([]); setHidden([]); }} style={styles.hiddenLine}>
            <Icon name="eyeoff" size={14} color={colors.mute} />
            <Text style={[text.hint, styles.flex1]}>{hiddenCats.length ? nb.op.hiddenCats(hiddenCats.length) : nb.op.hiddenItems(hidden.length)}</Text>
            <Text style={styles.showHidden}>{nb.op.showHidden}</Text>
          </Pressable>
        ) : null}
        {net.isConnected === false && (jobs.data ?? []).length ? (
          <View style={styles.hiddenLine}>
            <Icon name="wifioff" size={14} color={colors.warn} />
            <Text style={[text.hint, styles.flex1]}>{nb.op.offline}</Text>
          </View>
        ) : null}
      </View>

      <FeedContext.Provider value={feedInfo}>
      <View style={styles.list}>
        {loading ? (
          <View style={styles.bleed}>
            <ListingListSkeleton count={3} />
          </View>
        ) : jobs.isError ? (
          <View style={styles.errorBox}>
            <ErrorState onRetry={() => void jobs.refetch()} retrying={jobs.isFetching} />
          </View>
        ) : cat && feedList.length === 0 ? (
          <ScaleIn style={[styles.empty, shadow.card]} testID="empty-category">
            <CategoryArt category={cat} width={72} height={72} radius={36} iconSize={30} />
            <Text style={styles.emptyTitle}>{nb.op.emptyCat(categoryLabel(cat))}</Text>
            <Text style={[text.meta, styles.center, styles.emptyBody]}>{nb.op.emptyCatSub}</Text>
          </ScaleIn>
        ) : feedList.length === 0 && kind === 'offer' ? (
          <ScaleIn style={[styles.empty, shadow.card]}>
            <View style={[styles.emptyIcon, styles.emptyIconOffer]}>
              <Icon name="hand" size={26} color={colors.cyanDeep} />
            </View>
            <Text style={styles.emptyTitle}>{nb.offer.emptyOffers(municipality ?? '')}</Text>
            <Text style={[text.meta, styles.center, styles.emptyBody]}>{nb.offer.emptyOffersBody}</Text>
            <Button label={nb.offer.offerCta} icon="hand" variant="ink" size="sm" block={false} align="center" onPress={() => safePush('/legg-ut/tilbyr')} style={styles.emptyCta} />
          </ScaleIn>
        ) : feedList.length === 0 ? (
          <ScaleIn style={[styles.empty, shadow.card]}>
            <View style={[styles.emptyIcon, !municipality && styles.emptyIconPin]}>
              <Icon name={municipality ? 'clip' : 'pin'} size={26} color={municipality ? colors.limeDeep : colors.cyanDeep} />
            </View>
            <Text style={styles.emptyTitle}>{municipality ? nb.oppdrag.empty(reach === 0 ? kommuneGroupNames(municipality) : municipality) : nb.oppdrag.noKommuneTitle}</Text>
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
          <View style={twoCols ? styles.twoCols : styles.oneCol}>
            {feedList.map((l, i) => (
              <FadeUp key={l.id} delay={Math.min(i, 9) * 50} style={twoCols ? styles.col : undefined}>
                <OppdragCard listing={l} />
                {kind === 'offer' && !me.isYouth ? (
                  <Button label={nb.op.askHelp} variant="ghost" size="sm" icon="msg" block={false} onPress={() => safePush(`/chat/start?listing=${l.id}`)} style={styles.askHelp} />
                ) : null}
              </FadeUp>
            ))}
          </View>
        )}
        {sorted.length > limit ? (
          <Button label={nb.op.more} variant="soft" icon="down" onPress={() => setLimit((n) => n + SHOWN)} testID="feed-more" />
        ) : null}
        <Button
          label={kind === 'offer' ? nb.offer.seeAllOffers : nb.oppdrag.seeAll}
          variant="ghost"
          iconRight="arrow"
          onPress={() => {
            const q = [kind === 'offer' ? 'type=tilbud' : '', cat ? `category=${slugForArtId(cat)}` : ''].filter(Boolean).join('&');
            safePush(q ? `/oppdrag-liste?${q}` : '/oppdrag-liste');
          }}
          style={styles.seeAll}
        />
      </View>
      </FeedContext.Provider>

      {/* few oppdrag here yet: help the place grow */}
      {municipality && !loading && kind === 'need' && visible.length < 3 && me.id ? (
        <InviteCard kommune={municipality} onShare={() => void shareInvite(me.id)} />
      ) : null}

      {isEnabled('forMeOnHome') ? (
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
      ) : null}

      <View style={[styles.px, styles.mt22]}>
        <PaymentNote />
      </View>

      <CardMenuSheet
        listing={menuFor}
        saved={!!menuFor && savedIds.includes(menuFor.id)}
        onClose={() => setMenuFor(null)}
        onSave={() => {
          if (menuFor) toggleSaved.mutate(menuFor.id);
          setMenuFor(null);
        }}
        onShare={() => {
          if (menuFor) void shareListing(menuFor.id, menuFor.title);
          setMenuFor(null);
        }}
        onHide={() => {
          if (!menuFor) return;
          const id = menuFor.id;
          toggleHidden(id);
          setMenuFor(null);
          toast.success(nb.op.menu.hidden, { icon: 'eyeoff', action: { label: nb.op.menu.undo, onPress: () => toggleHidden(id) } });
        }}
        onHideCat={() => {
          if (!menuFor) return;
          const slug = menuFor.category.slug;
          toggleHiddenCat(slug);
          setMenuFor(null);
          toast.success(nb.op.menu.hiddenCat(categoryLabel(categoryArtId(slug))), { icon: 'eyeoff', action: { label: nb.op.menu.undo, onPress: () => toggleHiddenCat(slug) } });
        }}
        onReport={() => {
          if (menuFor) safePush(`/rapporter?listing=${menuFor.id}`);
          setMenuFor(null);
        }}
      />
      {mapOpen ? <ListingsMap listings={visible} onClose={() => setMapOpen(false)} /> : null}
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
  tools: { marginTop: 4, marginBottom: 6, gap: 8 },
  toolsRow: { gap: 8, alignItems: 'center' },
  sortChip: { height: 38, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line2, justifyContent: 'center' },
  sortChipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  sortText: { fontFamily: text.label.fontFamily, fontSize: 13.5, color: colors.ink },
  sortTextOn: { color: colors.white },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, minWidth: 44, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line2, justifyContent: 'center' },
  hiddenLine: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  flex1: { flex: 1 },
  showHidden: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink, textDecorationLine: 'underline' },
  oneCol: { gap: 12 },
  twoCols: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  col: { width: '48.5%' },
  askHelp: { alignSelf: 'flex-end', marginTop: 6 },
  px: { paddingHorizontal: screenPadding },
  mt12: { marginTop: 12 },
  mt18: { marginTop: 18 },
  mt22: { marginTop: 22 },
  mt30: { marginTop: 30 },
  center: { textAlign: 'center' },
  heading: { paddingHorizontal: screenPadding, paddingTop: 14, paddingBottom: 18, gap: 8 },
  h1: { fontSize: 33, lineHeight: 35, letterSpacing: -0.99 },
  loc: {
    minHeight: 60,
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
  changeText: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink },
  change: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
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
  emptyIconOffer: { backgroundColor: colors.cyanTint },
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
});
