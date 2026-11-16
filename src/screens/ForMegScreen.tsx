import { useEffect, useMemo, useRef, useState } from 'react';
import { useCategoryCatalog } from '@/hooks/useCategories';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import nb from '@/i18n/nb';
import type { Listing } from '@/domain/types';
import { categoryArtId, categoryLabel, categoryArtColors } from '@/domain/categories';
import { useListings, useProfile, useSavedListingIds, useToggleSavedListing } from '@/api/queries';
import { useSession } from '@/auth/session';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { useDismissedLeads } from '@/lib/dismissedLeads';
import { safePush, leaveFlow } from '@/lib/nav';
import { useOnceTip } from '@/lib/onceTips';
import { CoachTip } from '@/components/ui/CoachTip';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import {
  categoryColors,
  colors,
  fonts,
  motion,
  radius,
  screenPadding,
  shadow,
  text,
  type CategoryId,
} from '@/theme/theme';
import { listingPlace, listingPrice, listingSchedule } from '@/components/OppdragCard';
import {
  Avatar,
  Button,
  CategoryArt,
  ErrorState,
  FadeInView,
  FadeUp,
  Icon,
  IconButton,
  ListingCard,
  ListingListSkeleton,
  Pill,
  PressableScale,
  ScaleIn,
  Screen,
  Segmented,
  SubHeader,
  TextLink,
  type IconKey,
} from '@/components/ui';

type View_ = 'stack' | 'list';
type Why = { icon: IconKey; text: string };
type Suggestion = { listing: Listing; cat: CategoryId; match: boolean; why: Why[] };

const DAY_MS = 24 * 60 * 60 * 1000;
const LEAVE_MS = 430;
/** left = "Ikke aktuelt", right = "Lagre" */
type Dir = 'left' | 'right';
const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 900;
const km = (d: number) => d.toLocaleString('nb-NO', { maximumFractionDigits: 1 });

/** "Hvorfor dette passer" chips: skill match and timing; the distance only when nothing else fits. */
function whyChips(l: Listing, cat: CategoryId, match: boolean): Why[] {
  const out: Why[] = [];
  if (match) out.push({ icon: 'check', text: nb.forMeg.why.fits(categoryLabel(cat)) });
  const when = `${l.task?.scheduledText ?? ''} ${l.task?.durationText ?? ''}`.toLowerCase();
  if (/kveld|etter kl/.test(when)) out.push({ icon: 'moon', text: nb.forMeg.why.evening });
  else if (/lør|søn|helg/.test(when)) out.push({ icon: 'sun', text: nb.forMeg.why.weekend });
  else if (/fleksib/.test(when)) out.push({ icon: 'cal', text: nb.forMeg.why.flexible });
  // distance and stars are on the card already (the «Hvor» box, next to the name), so they are not repeated here;
  // the list view has no such box, so it still gets the distance as its line
  if (!out.length) {
    const d = l.location.distanceKm;
    out.push({ icon: 'pin', text: typeof d === 'number' ? nb.forMeg.why.away(km(d)) : nb.forMeg.why.near });
  }
  return out.slice(0, 3);
}

/**
 * Oppdrag for meg (design/screens/ForMeg.dc.html): open oppdrag ranked by the
 * user's skills (profile categories), distance and age, as a swipe-style
 * card stack or a list. Swipe (or use the buttons): left = "Ikke aktuelt" hides
 * the suggestion (kept on device), right = "Lagre" puts it in Lagrede. Either way
 * the card leaves the stack; "Angre" brings the last one back.
 */
export function ForMegScreen() {
  useCategoryCatalog(); // labels and colours follow the website's settings
  const router = useRouter();
  const me = useCurrentUser();
  const { userId } = useSession();
  const profile = useProfile(userId ?? '');
  const { municipality, municipalities, ready } = useLocationScope();
  const jobs = useListings({ type: 'TASK_REQUEST', municipalities }, 'NEWEST');
  const { dismissed, dismiss, restore } = useDismissedLeads();
  const savedIds = useSavedListingIds().data;
  const toggleSaved = useToggleSavedListing();

  const [view, setView] = useState<View_>('stack');
  // Dismissed in this visit, in order – drives the counter, "Angre" and "Start på nytt".
  const [gone, setGone] = useState<string[]>([]);
  const [leaving, setLeaving] = useState<Dir | null>(null);
  const [anim, setAnim] = useState<{ mode: 'rise' | 'back' | 'backRight'; n: number }>({ mode: 'rise', n: 0 });
  const [savedHere, setSavedHere] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // the first time: how the stack works (once per phone)
  const swipeTip = useOnceTip('forMegSwipe');
  useEffect(() => () => clearTimeout(timer.current), []);
  // «Angre» lives in a toast that outlives this render: it must read the newest state, not a stale copy
  const goneRef = useRef<string[]>([]);
  const savedHereRef = useRef<string[]>([]);
  useEffect(() => {
    goneRef.current = gone;
    savedHereRef.current = savedHere;
  }, [gone, savedHere]);
  // a swipe and a button at the same moment must not count one card twice
  const decided = useRef(new Set<string>());

  const skills = useMemo(() => {
    const seen: CategoryId[] = [];
    for (const s of profile.data?.categorySlugs ?? []) {
      const c = categoryArtId(s);
      if (!seen.includes(c)) seen.push(c);
    }
    return seen;
  }, [profile.data?.categorySlugs]);

  // The order is fixed for the visit: a refresh in the background never swaps the card you're looking at.
  // Oppdrag that arrive later join at the back.
  const sorted = useMemo<Suggestion[]>(() => {
    return (jobs.data ?? [])
      .filter((l) => l.owner.id !== me.id)
      .map((l) => {
        const cat = categoryArtId(l.category.slug);
        const match = skills.includes(cat);
        return { listing: l, cat, match, why: whyChips(l, cat, match) };
      })
      .sort((a, b) => {
        if (a.match !== b.match) return a.match ? -1 : 1;
        const da = a.listing.location.distanceKm ?? 999;
        const db = b.listing.location.distanceKm ?? 999;
        if (da !== db) return da - db;
        return Date.parse(b.listing.createdAt) - Date.parse(a.listing.createdAt);
      });
  }, [jobs.data, me.id, skills]);
  // only fix the order once the person's skills are known too, or «passer deg» would be sorted without them
  const settled = !!profile.data && !jobs.isLoading;
  const [order, setOrder] = useState<string[]>([]);
  const missing = settled ? sorted.filter((x) => !order.includes(x.listing.id)).map((x) => x.listing.id) : [];
  if (missing.length) setOrder([...order, ...missing]);
  const ranked = useMemo(
    () => (settled ? [...sorted].sort((a, b) => order.indexOf(a.listing.id) - order.indexOf(b.listing.id)) : sorted),
    [sorted, settled, order],
  );

  // The deck for this visit: everything not hidden or saved earlier (what leaves the
  // stack during this visit stays counted).
  const deck = useMemo(
    () =>
      ranked.filter(
        (s) => gone.includes(s.listing.id) || (!dismissed.has(s.listing.id) && !(savedIds ?? []).includes(s.listing.id)),
      ),
    [ranked, dismissed, gone, savedIds],
  );
  const rem = useMemo(() => deck.filter((s) => !gone.includes(s.listing.id)), [deck, gone]);
  const [openedAt] = useState(() => Date.now());
  const newToday = deck.filter((s) => Date.parse(s.listing.createdAt) >= openedAt - DAY_MS).length;

  const loading = jobs.isLoading || !ready || savedIds === undefined;
  const done = !loading && !jobs.isError && rem.length === 0;
  const idx = deck.length - rem.length;
  const top = rem[0];
  const firstName = (me.displayName || '').split(' ')[0];

  /** The card has left the stack: store the choice and bring up the next one. */
  const commit = (id: string, dir: Dir) => {
    if (decided.current.has(id)) return;
    decided.current.add(id);
    clearTimeout(timer.current);
    if (dir === 'right') {
      toggleSaved.mutate(id);
      setSavedHere((s) => [...s, id]);
      toast.success(nb.forMeg.savedToast, { icon: 'heart', action: { label: nb.forMeg.undo, onPress: undo }, bottom: 28 });
    } else {
      dismiss(id);
    }
    setGone((g) => [...g, id]);
    setLeaving(null);
    setAnim((a) => ({ mode: 'rise', n: a.n + 1 }));
  };

  /** A button was pressed: fly the card out, then commit. */
  const pass = (id: string, dir: Dir) => {
    if (leaving) return;
    setLeaving(dir);
    timer.current = setTimeout(() => commit(id, dir), LEAVE_MS);
  };

  const hide = (id: string, fromList: boolean) => {
    if (fromList) {
      if (decided.current.has(id)) return;
      decided.current.add(id);
      dismiss(id);
      setGone((g) => [...g, id]);
      toast.info(nb.forMeg.hiddenToast, { icon: 'x', action: { label: nb.forMeg.undo, onPress: undo }, bottom: 28 });
      return;
    }
    pass(id, 'left');
  };

  function undo() {
    const last = goneRef.current[goneRef.current.length - 1];
    if (!last) return;
    const wasSaved = savedHereRef.current.includes(last);
    if (wasSaved) {
      toggleSaved.mutate(last);
      setSavedHere((s) => s.filter((x) => x !== last));
    } else {
      restore([last]);
    }
    decided.current.delete(last);
    goneRef.current = goneRef.current.slice(0, -1);
    setGone((g) => g.filter((x) => x !== last));
    // it comes back from the side it left on
    setAnim((a) => ({ mode: wasSaved ? 'backRight' : 'back', n: a.n + 1 }));
  }

  const restart = () => {
    // "Start på nytt" shows the hidden ones again; what you saved stays in Lagrede
    restore(gone.filter((id) => !savedHere.includes(id)));
    decided.current.clear();
    setGone([]);
    setView('stack');
    setAnim((a) => ({ mode: 'back', n: a.n + 1 }));
  };

  const open = (l: Listing) => safePush(`/oppdrag/${l.id}`);

  return (
    <Screen
      scroll
      header={
        <SubHeader
          title={nb.forMeg.title}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          right={<IconButton icon="bell" iconSize={18} accessibilityLabel={nb.forMeg.bell} onPress={() => router.push('/varslinger')} />}
        />
      }
    >
      {/* intro */}
      <FadeUp style={styles.intro}>
        {newToday > 0 ? <Pill label={nb.forMeg.newToday(newToday)} tone="accent" icon="sparkle" style={styles.selfStart} /> : null}
        <Text style={[text.h2, styles.h1]} accessibilityRole="header">
          {nb.forMeg.heading(firstName)}
        </Text>
        <Text style={[text.meta, styles.sub]}>{nb.forMeg.sub}</Text>
      </FadeUp>
      <FadeUp delay={100} style={[styles.basis, shadow.card]}>
        <View style={styles.basisHead}>
          <View style={styles.basisIc}>
            <Icon name="check" size={14} color={colors.limeDeep} />
          </View>
          <Text style={[styles.basisLabel, styles.flex1]}>{nb.forMeg.basedOn}</Text>
          <TextLink label={nb.forMeg.change} icon={null} onPress={() => safePush('/profil/rediger')} style={styles.change} />
        </View>
        <View style={styles.skills}>
          {skills.map((c) => (
            <View key={c} style={styles.skill}>
              <Icon name={c} size={14} color={colors.ink} />
              <Text style={styles.skillText}>{categoryLabel(c)}</Text>
            </View>
          ))}
          {municipality ? (
            <View style={[styles.skill, styles.skillPlace]}>
              <Icon name="pin" size={14} color={colors.cyanDeep} />
              <Text style={[styles.skillText, styles.skillPlaceText]}>{municipality}</Text>
            </View>
          ) : null}
        </View>
      </FadeUp>

      {/* view toggle + counter */}
      <FadeUp delay={150} style={styles.toolbar}>
        <Segmented
          options={[
            { value: 'stack', label: nb.forMeg.stack },
            { value: 'list', label: nb.forMeg.list },
          ]}
          value={view}
          onChange={setView}
          style={styles.seg}
        />
        {!done && !loading && deck.length > 0 ? (
          <View style={styles.ctr} accessibilityLiveRegion="polite" accessibilityLabel={nb.forMeg.counter(idx + 1, deck.length)}>
            <Text style={styles.ctrNum} numberOfLines={1}>
              {nb.forMeg.counter(idx + 1, deck.length)}
            </Text>
          </View>
        ) : null}
      </FadeUp>
      {view === 'stack' && !done && !loading && deck.length > 1 ? (
        <View style={styles.bars} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {deck.map((s, i) => (
            <View key={s.listing.id} style={[styles.bar, i < idx && styles.barDone, i === idx && styles.barOn]} />
          ))}
        </View>
      ) : null}

      {loading ? (
        <ListingListSkeleton count={3} />
      ) : jobs.isError ? (
        <View style={styles.errorBox}>
          <ErrorState onRetry={() => void jobs.refetch()} retrying={jobs.isFetching} />
        </View>
      ) : done ? (
        <DoneCard
          empty={deck.length === 0}
          savedCount={savedHere.length}
          onWiden={() => leaveFlow('/')}
          onRestart={restart}
        />
      ) : view === 'stack' && top ? (
        <View>
          {swipeTip.show ? (
            <CoachTip
              icon="swipe"
              motion="swipe"
              title={nb.tips.forMegTitle}
              body={nb.tips.forMegBody}
              okLabel={nb.tips.ok}
              hints={{ left: nb.tips.swipeSkip, right: nb.tips.swipeSave }}
              onDone={swipeTip.done}
              style={styles.tip}
              testID="tip-for-meg"
            />
          ) : null}
          <View style={styles.stackwrap}>
            {rem[2] ? <BackCard s={rem[2]} depth={2} /> : null}
            {rem[1] ? <BackCard s={rem[1]} depth={1} /> : null}
            <FrontCard
              key={`${top.listing.id}-${anim.n}`}
              s={top}
              mode={anim.mode}
              leaving={leaving}
              onSwipe={(dir) => commit(top.listing.id, dir)}
              onPress={() => open(top.listing)}
            />
          </View>
          {/* skip · open · save: three of one height, each its own shape – the round ones say what they do with
              icon and colour, the screen reader with words */}
          <View style={styles.actions}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={nb.forMeg.dismiss}
              onPress={() => {
                haptics.light();
                hide(top.listing.id, false);
              }}
              scaleTo={0.88}
              style={[styles.rbtn, styles.rbtnSkip, shadow.card]}
            >
              <Icon name="x" size={24} color={colors.ink2} strokeWidth={2.4} />
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={nb.forMeg.seeAndOffer}
              onPress={() => open(top.listing)}
              scaleTo={0.96}
              style={styles.cta}
            >
              <Text style={styles.ctaText} numberOfLines={1}>
                {nb.forMeg.seeAndOffer}
              </Text>
              <View style={styles.ctaGo}>
                <Icon name="arrow" size={18} color={colors.lime} />
              </View>
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={nb.forMeg.saveLabel}
              onPress={() => {
                haptics.success();
                pass(top.listing.id, 'right');
              }}
              scaleTo={0.88}
              style={[styles.rbtn, styles.rbtnSave, shadow.card]}
            >
              <Icon name="heart" size={22} color={colors.heart} filled />
            </PressableScale>
          </View>
          <Text style={[text.meta, styles.swipeHint]}>{nb.forMeg.swipeHint}</Text>
          <View style={styles.undoRow}>
            <UndoButton label={nb.forMeg.undo} disabled={gone.length === 0} onPress={undo} />
          </View>
        </View>
      ) : (
        <View style={styles.list}>
          {rem.map((s, i) => (
            <FadeUp key={s.listing.id} delay={Math.min(i, 8) * 50}>
              <View>
                <ListingCard
                  title={s.listing.title}
                  category={s.cat}
                  photoUri={s.listing.images[0]?.url}
                  ownerName={s.listing.owner.displayName}
                  ownerRating={s.listing.owner.rating?.count ? s.listing.owner.rating.average : null}
                  place={listingPlace(s.listing)}
                  schedule={s.why[0]?.text}
                  scheduleIcon="sparkle"
                  priceLabel={listingPrice(s.listing).label}
                  priceValue={listingPrice(s.listing).value}
                  onPress={() => open(s.listing)}
                />
                <IconButton
                  icon="x"
                  iconSize={18}
                  accessibilityLabel={nb.forMeg.dismissItem(s.listing.title)}
                  onPress={() => hide(s.listing.id, true)}
                  style={styles.lx}
                />
              </View>
            </FadeUp>
          ))}
          {gone.length > 0 ? <UndoButton label={nb.forMeg.undoLast} onPress={undo} style={styles.selfCenter} /> : null}
        </View>
      )}

      <View style={styles.bottom} />
    </Screen>
  );
}

/* ---------- stack cards ---------- */

function BackCard({ s, depth }: { s: Suggestion; depth: 1 | 2 }) {
  const t = depth === 1 ? styles.b1 : styles.b2;
  return (
    <View style={[styles.bcard, shadow.card, t]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.bart, { backgroundColor: categoryArtColors(s.cat).bg }]}>
        <Icon name={s.cat} size={depth === 1 ? 52 : 48} color={categoryArtColors(s.cat).fg} />
      </View>
      {depth === 1 ? (
        <View style={styles.bbody}>
          <Text style={styles.btitle} numberOfLines={1}>
            {s.listing.title}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function FrontCard({
  s,
  mode,
  leaving,
  onSwipe,
  onPress,
}: {
  s: Suggestion;
  mode: 'rise' | 'back' | 'backRight';
  leaving: Dir | null;
  onSwipe: (dir: Dir) => void;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const l = s.listing;
  const price = listingPrice(l);
  const when = listingSchedule(l);
  const c = categoryArtColors(s.cat);

  // .fcard.rise / .backA / .flyL from the design
  const back = mode !== 'rise';
  const side = mode === 'backRight' ? 1 : -1;
  const x = useSharedValue(reduced ? 0 : back ? side * 420 : 0);
  const y = useSharedValue(reduced || back ? 0 : 18);
  const rot = useSharedValue(reduced ? 0 : back ? side * 14 : 0);
  const sc = useSharedValue(reduced || back ? 1 : 0.94);
  const op = useSharedValue(reduced ? 1 : back ? 0 : 0.9);

  useEffect(() => {
    if (reduced) return;
    x.set(withSpring(0, motion.spring));
    y.set(withSpring(0, motion.spring));
    rot.set(withSpring(0, motion.spring));
    sc.set(withSpring(1, motion.spring));
    op.set(withTiming(1, { duration: 300 }));
  }, [reduced, x, y, rot, sc, op]);

  useEffect(() => {
    if (!leaving) return;
    const cfg = { duration: 450, easing: Easing.in(Easing.ease) };
    if (reduced) {
      op.set(withTiming(0, { duration: 200 }));
      return;
    }
    const d = leaving === 'right' ? 1 : -1;
    x.set(withTiming(d * 480, cfg));
    rot.set(withTiming(d * 18, cfg));
    op.set(withTiming(0, cfg));
  }, [leaving, reduced, x, rot, op]);

  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rot.value}deg` }, { scale: sc.value }],
  }));
  // the stamps fade in with the drag: right = Lagre, left = Ikke aktuelt
  const saveStamp = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [10, 90], [0, 1], 'clamp') }));
  const skipStamp = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-90, -10], [1, 0], 'clamp') }));

  // Drag the card sideways; let go past the threshold (or with a flick) to decide.
  const pan = Gesture.Pan()
    .enabled(!leaving)
    .activeOffsetX([-14, 14])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      x.set(e.translationX);
      rot.set(e.translationX / 18);
    })
    .onEnd((e) => {
      const far = Math.abs(e.translationX) > SWIPE_DISTANCE || Math.abs(e.velocityX) > SWIPE_VELOCITY;
      if (!far) {
        x.set(withSpring(0, motion.spring));
        rot.set(withSpring(0, motion.spring));
        return;
      }
      const d = e.translationX > 0 ? 1 : -1;
      rot.set(withTiming(d * 18, { duration: 220 }));
      op.set(withTiming(0, { duration: 220 }));
      x.set(
        withTiming(d * 480, { duration: 220 }, (finished) => {
          if (finished) runOnJS(onSwipe)(d > 0 ? 'right' : 'left');
        }),
      );
    });

  return (
    <GestureDetector gesture={pan}>
    <Animated.View style={[styles.fcard, shadow.stackFront, style]}>
      <Animated.View style={[styles.stamp, styles.stampSave, saveStamp]} pointerEvents="none">
        <Icon name="heart" size={16} color={colors.limeDeep} />
        <Text style={[styles.stampText, { color: colors.limeDeep }]}>{nb.forMeg.save}</Text>
      </Animated.View>
      <Animated.View style={[styles.stamp, styles.stampSkip, skipStamp]} pointerEvents="none">
        <Icon name="x" size={16} color={colors.danger} />
        <Text style={[styles.stampText, { color: colors.danger }]}>{nb.forMeg.dismiss}</Text>
      </Animated.View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${l.title}, ${l.owner.displayName}, ${price.label} ${price.value}`} onPress={onPress} style={styles.fill}>
        <View style={[styles.fart, { backgroundColor: c.bg }]}>
          <View style={[styles.deco, styles.deco1]} />
          <View style={[styles.deco, styles.deco2]} />
          <Icon name={s.cat} size={64} color={c.fg} />
          {l.images[0]?.url ? <CategoryArt category={s.cat} uri={l.images[0].url} style={StyleSheet.absoluteFill} /> : null}
          <Pill label={nb.forMeg.needHelp} tone="need" dot style={[styles.tl, shadow.whiteRing3]} />
        </View>
        <View style={styles.fbody}>
          <Text style={[text.h3, styles.ftitle]} numberOfLines={2}>
            {l.title}
          </Text>
          {/* who asks, and the price in its own box */}
          <View style={styles.person}>
            <Avatar initials={l.owner.initials} uri={l.owner.avatarUrl} seed={l.owner.id} size={44} />
            <View style={styles.who}>
              <Text style={[text.label, styles.whoName]} numberOfLines={1}>
                {l.owner.displayName}
              </Text>
              {l.owner.rating?.count ? (
                <View style={styles.starsRow}>
                  <Icon name="star" size={14} color={colors.star} filled />
                  <Text style={styles.starsVal}>{km(l.owner.rating.average)}</Text>
                  <Text style={styles.starsMeta} numberOfLines={1}>
                    {nb.forMeg.reviews(l.owner.rating.count)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.starsMeta}>{nb.forMeg.newOwner}</Text>
              )}
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.plabel}>{price.label || nb.forMeg.price}</Text>
              <Text style={[styles.priceVal, price.label ? null : styles.priceSmall]} numberOfLines={1}>
                {price.value}
              </Text>
            </View>
          </View>
          {/* where and when, as two small facts with room for two lines */}
          <View style={styles.facts}>
            <View style={styles.fact}>
              <View style={[styles.factIc, styles.factIcPlace]}>
                <Icon name="pin" size={15} color={colors.cyanDeep} />
              </View>
              <View style={styles.factText}>
                <Text style={styles.factLabel}>{nb.forMeg.factWhere}</Text>
                <Text style={styles.factValue} numberOfLines={2}>
                  {listingPlace(l)}
                </Text>
              </View>
            </View>
            {when ? (
              <View style={styles.fact}>
                <View style={[styles.factIc, styles.factIcWhen]}>
                  <Icon name="cal" size={15} color={colors.warn} />
                </View>
                <View style={styles.factText}>
                  <Text style={styles.factLabel}>{nb.forMeg.factWhen}</Text>
                  <Text style={styles.factValue} numberOfLines={2}>
                    {when}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
          <View style={styles.whyRow}>
            {s.why.map((w) => (
              <View key={w.text} style={styles.why}>
                <Icon name={w.icon} size={14} color={colors.limeDeep} />
                <Text style={styles.whyText}>{w.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
    </Animated.View>
    </GestureDetector>
  );
}

function UndoButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nb.forMeg.undoLast}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.undo, disabled && styles.undoOff, style]}
    >
      <Icon name="undo" size={16} color={colors.ink} />
      <Text style={styles.undoText}>{label}</Text>
    </Pressable>
  );
}

/* ---------- done ---------- */

function DoneCard({
  empty,
  savedCount,
  onWiden,
  onRestart,
}: {
  empty: boolean;
  savedCount: number;
  onWiden: () => void;
  onRestart: () => void;
}) {
  const body = `${nb.forMeg.doneBody}${savedCount ? ` ${nb.forMeg.doneSaved(savedCount)}` : ''}`;
  return (
    <ScaleIn style={styles.donePad}>
      <View style={[styles.done, shadow.card]}>
        <View style={styles.doneBlob} />
        <View style={styles.illu}>
          <View style={[styles.paper, styles.paperL, shadow.card]} />
          <View style={[styles.paper, styles.paperR, shadow.card]} />
          <ScaleIn delay={150} style={styles.doneArtWrap}>
            <View style={[styles.doneArt, shadow.medium]}>
              <Icon name="check" size={32} color={categoryColors.hage.fg} />
            </View>
          </ScaleIn>
          <FadeInView delay={300} style={styles.sparkle}>
            <Icon name="sparkle" size={16} color={colors.ink} />
          </FadeInView>
          <FadeInView delay={400} style={styles.dot} />
        </View>
        <Text style={[text.h3, styles.center]} accessibilityRole="header">
          {empty ? nb.forMeg.emptyTitle : nb.forMeg.doneTitle}
        </Text>
        <Text style={[text.meta, styles.center, styles.doneBody]}>{body}</Text>
        <View style={styles.doneActions}>
          <Button label={nb.forMeg.widen} icon="locate" onPress={onWiden} />
          {!empty ? <Button label={nb.forMeg.restart} icon="refresh" variant="ghost" onPress={onRestart} /> : null}
          <TextLink label={nb.forMeg.seeSaved} icon="right" onPress={() => safePush('/lagrede')} style={styles.selfCenter} />
        </View>
      </View>
    </ScaleIn>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  selfStart: { alignSelf: 'flex-start' },
  selfCenter: { alignSelf: 'center' },
  center: { textAlign: 'center' },
  intro: { marginTop: 6, paddingHorizontal: screenPadding, gap: 6 },
  h1: { fontSize: 26, lineHeight: 28, marginTop: 4 },
  sub: { fontSize: 14, lineHeight: 20 },
  basis: { marginTop: 14, marginHorizontal: screenPadding, padding: 12, gap: 10, borderRadius: radius.card, backgroundColor: colors.white },
  basisHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  basisIc: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  basisLabel: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink2 },
  flex1: { flex: 1, minWidth: 0 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skill: {
    height: 32,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skillPlace: { backgroundColor: colors.cyanTint },
  skillText: { ...text.bodySemi, fontSize: 13, lineHeight: 16 },
  skillPlaceText: { color: colors.cyanDeep },
  change: { minHeight: 32, justifyContent: 'center' },
  toolbar: {
    paddingHorizontal: screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  seg: { flex: 1 },
  ctr: { flexShrink: 0, height: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.ink, justifyContent: 'center' },
  ctrNum: { fontFamily: text.label.fontFamily, fontSize: 14, color: colors.white },
  bars: { flexDirection: 'row', gap: 4, marginHorizontal: screenPadding, marginTop: 12 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.barIdle },
  barOn: { backgroundColor: colors.ink },
  barDone: { backgroundColor: colors.barDone },
  errorBox: { height: 380 },

  stackwrap: { height: 492, marginHorizontal: screenPadding },
  tip: { marginHorizontal: screenPadding, marginBottom: 14 },
  bcard: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 452,
    borderRadius: 30,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stackBorder,
    overflow: 'hidden',
  },
  // transform-origin: 50% 100% → shift down by half the shrink
  b1: { zIndex: 2, opacity: 0.92, transform: [{ translateY: 18 + (452 * 0.06) / 2 }, { scale: 0.94 }] },
  b2: { zIndex: 1, opacity: 0.6, transform: [{ translateY: 36 + (452 * 0.12) / 2 }, { scale: 0.88 }] },
  bart: { height: 150, alignItems: 'center', justifyContent: 'center' },
  bbody: { paddingVertical: 16, paddingHorizontal: 20 },
  btitle: { fontFamily: text.h3.fontFamily, fontSize: 19, color: colors.ink2 },
  fcard: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 452,
    borderRadius: 30,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    zIndex: 3,
  },
  fart: { height: 168, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  deco: { position: 'absolute', borderRadius: radius.pill, backgroundColor: colors.artDeco },
  deco1: { width: 120, height: 120, left: -30, bottom: -50 },
  deco2: { width: 60, height: 60, right: 40, top: 30 },
  tl: { position: 'absolute', left: 14, top: 14 },
  fbody: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 18, gap: 10, flex: 1 },
  ftitle: { fontSize: 22, lineHeight: 25 },
  who: { flex: 1, minWidth: 0, gap: 3 },
  whoName: { fontSize: 14.5 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starsVal: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink },
  starsMeta: { fontFamily: text.meta.fontFamily, fontSize: 13, color: colors.mute, flexShrink: 1 },
  plabel: { fontFamily: text.label.fontFamily, fontSize: 11.5, color: colors.limeDeep },
  priceSmall: { fontSize: 17 },
  whyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 'auto' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  priceBox: { alignItems: 'flex-end', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.limeTint, maxWidth: '46%' },
  priceVal: { fontFamily: text.num.fontFamily, fontSize: 22, lineHeight: 26, color: colors.ink },
  facts: { flexDirection: 'row', gap: 8 },
  fact: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 16, backgroundColor: colors.bg },
  factIc: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  factIcPlace: { backgroundColor: colors.cyanTint },
  factIcWhen: { backgroundColor: colors.warnTint },
  factText: { flex: 1, minWidth: 0 },
  factLabel: { fontFamily: text.label.fontFamily, fontSize: 11, color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.4 },
  factValue: { fontFamily: text.bodySemi.fontFamily, fontSize: 13, lineHeight: 17, color: colors.ink },
  why: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  whyText: { fontFamily: text.bodySemi.fontFamily, fontSize: 12.5, color: colors.ink2 },

  actions: { marginHorizontal: screenPadding, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rbtn: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  rbtnSkip: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line },
  rbtnSave: { backgroundColor: colors.ink },
  cta: {
    flex: 1,
    height: 58,
    paddingLeft: 22,
    paddingRight: 7,
    borderRadius: 29,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ctaText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  ctaGo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  undoRow: { alignItems: 'center', marginTop: 14 },
  swipeHint: { textAlign: 'center', marginTop: 12 },
  stamp: {
    position: 'absolute',
    top: 58,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 2,
    backgroundColor: colors.white,
  },
  stampSave: { left: 16, borderColor: colors.limeDeep, transform: [{ rotate: '-8deg' }] },
  stampSkip: { right: 16, borderColor: colors.danger, transform: [{ rotate: '8deg' }] },
  stampText: { fontFamily: text.label.fontFamily, fontSize: 14, letterSpacing: 0.4, textTransform: 'uppercase' },
  undo: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  undoOff: { opacity: 0.4 },
  undoText: { fontFamily: text.label.fontFamily, fontSize: 13.5, color: colors.ink },

  list: { paddingHorizontal: screenPadding, gap: 12 },
  lx: { position: 'absolute', top: 10, right: 10 },

  donePad: { paddingHorizontal: screenPadding, marginTop: 4 },
  done: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    paddingTop: 30,
    paddingHorizontal: 22,
    paddingBottom: 22,
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  doneBlob: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 300,
    height: 220,
    borderRadius: 150,
    backgroundColor: colors.limeSoft,
  },
  illu: { width: 150, height: 128, marginBottom: 8 },
  paper: { position: 'absolute', width: 76, height: 96, borderRadius: 18, backgroundColor: colors.white },
  paperL: { left: 22, top: 16, transform: [{ rotate: '-12deg' }] },
  paperR: { left: 52, top: 8, transform: [{ rotate: '9deg' }] },
  doneArtWrap: { position: 'absolute', left: 36, top: 12 },
  doneArt: {
    width: 78,
    height: 100,
    borderRadius: 18,
    backgroundColor: categoryColors.hage.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    right: 6,
    top: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { position: 'absolute', left: 4, bottom: 16, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.cyan },
  doneBody: { maxWidth: 290, fontSize: 14, lineHeight: 20 },
  doneActions: { gap: 10, alignSelf: 'stretch', marginTop: 10 },

  bottom: { height: 48 },
});
