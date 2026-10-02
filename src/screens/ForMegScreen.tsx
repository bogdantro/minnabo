import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import nb from '@/i18n/nb';
import type { Listing } from '@/domain/types';
import { categoryArtId } from '@/domain/categories';
import { useIsSaved, useListings, useProfile } from '@/api/queries';
import { useSession } from '@/auth/session';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { useDismissedLeads } from '@/lib/dismissedLeads';
import { postedAgo } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import {
  categoryColors,
  categoryLabels,
  colors,
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
  ChipRow,
  ErrorState,
  FadeInView,
  FadeUp,
  Icon,
  IconButton,
  ListingCard,
  ListingListSkeleton,
  PaymentNote,
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
const km = (d: number) => d.toLocaleString('nb-NO', { maximumFractionDigits: 1 });

/** "Hvorfor dette passer" chips: skill match, distance, timing, trust – max three. */
function whyChips(l: Listing, cat: CategoryId, match: boolean): Why[] {
  const out: Why[] = [];
  if (match) out.push({ icon: 'check', text: nb.forMeg.why.fits(categoryLabels[cat]) });
  const when = `${l.task?.scheduledText ?? ''} ${l.task?.durationText ?? ''}`.toLowerCase();
  if (/kveld|etter kl/.test(when)) out.push({ icon: 'moon', text: nb.forMeg.why.evening });
  else if (/lør|søn|helg/.test(when)) out.push({ icon: 'sun', text: nb.forMeg.why.weekend });
  else if (/fleksib/.test(when)) out.push({ icon: 'cal', text: nb.forMeg.why.flexible });
  const d = l.location.distanceKm;
  if (typeof d === 'number') out.push({ icon: 'pin', text: nb.forMeg.why.away(km(d)) });
  if (l.owner.verifications.some((v) => v.verified)) out.push({ icon: 'verified', text: nb.forMeg.why.verified });
  else if (l.owner.rating?.count) out.push({ icon: 'star', text: nb.forMeg.why.rating(km(l.owner.rating.average)) });
  if (!out.length) out.push({ icon: 'pin', text: nb.forMeg.why.near });
  return out.slice(0, 3);
}

/**
 * Oppdrag for meg (design/screens/ForMeg.dc.html): open oppdrag ranked by the
 * user's skills (profile categories), distance and age, as a swipe-style
 * card stack or a list. "Ikke aktuelt" hides a suggestion (kept on device).
 */
export function ForMegScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const { userId } = useSession();
  const profile = useProfile(userId ?? '');
  const { municipality, municipalities, ready } = useLocationScope();
  const jobs = useListings({ type: 'TASK_REQUEST', municipalities }, 'NEWEST');
  const { dismissed, dismiss, restore } = useDismissedLeads();

  const [view, setView] = useState<View_>('stack');
  // Dismissed in this visit, in order – drives the counter, "Angre" and "Start på nytt".
  const [gone, setGone] = useState<string[]>([]);
  const [leaving, setLeaving] = useState(false);
  const [anim, setAnim] = useState<{ mode: 'rise' | 'back'; n: number }>({ mode: 'rise', n: 0 });
  const [savedHere, setSavedHere] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const skills = useMemo(() => {
    const seen: CategoryId[] = [];
    for (const s of profile.data?.categorySlugs ?? []) {
      const c = categoryArtId(s);
      if (!seen.includes(c)) seen.push(c);
    }
    return seen;
  }, [profile.data?.categorySlugs]);

  const ranked = useMemo<Suggestion[]>(() => {
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

  // The deck for this visit: everything not hidden earlier (this visit's hides stay counted).
  const deck = useMemo(() => ranked.filter((s) => !dismissed.has(s.listing.id) || gone.includes(s.listing.id)), [ranked, dismissed, gone]);
  const rem = useMemo(() => deck.filter((s) => !gone.includes(s.listing.id)), [deck, gone]);
  const [openedAt] = useState(() => Date.now());
  const newToday = deck.filter((s) => Date.parse(s.listing.createdAt) >= openedAt - DAY_MS).length;

  const loading = jobs.isLoading || !ready;
  const done = !loading && !jobs.isError && rem.length === 0;
  const idx = deck.length - rem.length;
  const top = rem[0];
  const firstName = (me.displayName || '').split(' ')[0];

  const hide = (id: string, fromList: boolean) => {
    if (fromList) {
      dismiss(id);
      setGone((g) => [...g, id]);
      toast.info(nb.forMeg.hiddenToast, { icon: 'x', action: { label: nb.forMeg.undo, onPress: undo }, bottom: 28 });
      return;
    }
    if (leaving) return;
    setLeaving(true);
    timer.current = setTimeout(() => {
      dismiss(id);
      setGone((g) => [...g, id]);
      setLeaving(false);
      setAnim((a) => ({ mode: 'rise', n: a.n + 1 }));
    }, LEAVE_MS);
  };

  function undo() {
    setGone((g) => {
      const last = g[g.length - 1];
      if (!last) return g;
      restore([last]);
      return g.slice(0, -1);
    });
    setAnim((a) => ({ mode: 'back', n: a.n + 1 }));
  }

  const restart = () => {
    restore(gone);
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
      <FadeUp delay={100}>
        <ChipRow style={styles.skills}>
          {skills.map((c) => (
            <View key={c} style={styles.skill}>
              <Icon name={c} size={15} color={colors.ink} />
              <Text style={styles.skillText}>{categoryLabels[c]}</Text>
            </View>
          ))}
          {municipality ? (
            <View style={styles.skill}>
              <Icon name="pin" size={15} color={colors.ink} />
              <Text style={styles.skillText}>{municipality}</Text>
            </View>
          ) : null}
          <TextLink label={nb.forMeg.change} icon={null} onPress={() => safePush('/profil/rediger')} style={styles.change} />
        </ChipRow>
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
            <View style={styles.bars}>
              {deck.map((s, i) => (
                <View key={s.listing.id} style={[styles.bar, i < idx && styles.barDone, i === idx && styles.barOn]} />
              ))}
            </View>
            <Text style={[text.num, styles.ctrNum]}>{nb.forMeg.counter(idx + 1, deck.length)}</Text>
          </View>
        ) : null}
      </FadeUp>

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
          onWiden={() => router.replace('/')}
          onRestart={restart}
        />
      ) : view === 'stack' && top ? (
        <View>
          <View style={styles.stackwrap}>
            {rem[2] ? <BackCard s={rem[2]} depth={2} /> : null}
            {rem[1] ? <BackCard s={rem[1]} depth={1} /> : null}
            <FrontCard key={`${top.listing.id}-${anim.n}`} s={top} mode={anim.mode} leaving={leaving} onPress={() => open(top.listing)} />
          </View>
          <View style={styles.controls}>
            <View style={styles.rcol}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={nb.forMeg.dismiss}
                onPress={() => hide(top.listing.id, false)}
                scaleTo={0.88}
                style={[styles.rbtn, shadow.medium]}
              >
                <Icon name="x" size={28} color={colors.danger} />
              </PressableScale>
              <Text style={styles.rlab}>{nb.forMeg.dismiss}</Text>
            </View>
            <Button
              label={nb.forMeg.seeAndOffer}
              iconRight="arrow"
              size="lg"
              block={false}
              onPress={() => open(top.listing)}
              style={styles.cta}
            />
            <SaveControl
              id={top.listing.id}
              onChange={(on) => setSavedHere((s) => (on ? [...s, top.listing.id] : s.filter((x) => x !== top.listing.id)))}
            />
          </View>
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

      <PaymentNote style={styles.note} />
      <View style={styles.bottom} />
    </Screen>
  );
}

/* ---------- stack cards ---------- */

function BackCard({ s, depth }: { s: Suggestion; depth: 1 | 2 }) {
  const t = depth === 1 ? styles.b1 : styles.b2;
  return (
    <View style={[styles.bcard, shadow.card, t]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.bart, { backgroundColor: categoryColors[s.cat].bg }]}>
        <Icon name={s.cat} size={depth === 1 ? 52 : 48} color={categoryColors[s.cat].fg} />
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
  onPress,
}: {
  s: Suggestion;
  mode: 'rise' | 'back';
  leaving: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const l = s.listing;
  const price = listingPrice(l);
  const when = listingSchedule(l);
  const c = categoryColors[s.cat];

  // .fcard.rise / .backA / .flyL from the design
  const x = useSharedValue(reduced ? 0 : mode === 'back' ? -420 : 0);
  const y = useSharedValue(reduced || mode === 'back' ? 0 : 18);
  const rot = useSharedValue(reduced ? 0 : mode === 'back' ? -14 : 0);
  const sc = useSharedValue(reduced || mode === 'back' ? 1 : 0.94);
  const op = useSharedValue(reduced ? 1 : mode === 'back' ? 0 : 0.9);

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
    x.set(withTiming(-480, cfg));
    rot.set(withTiming(-18, cfg));
    op.set(withTiming(0, cfg));
  }, [leaving, reduced, x, rot, op]);

  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rot.value}deg` }, { scale: sc.value }],
  }));

  return (
    <Animated.View style={[styles.fcard, shadow.stackFront, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${l.title}, ${l.owner.displayName}, ${price.label} ${price.value}`} onPress={onPress} style={styles.fill}>
        <View style={[styles.fart, { backgroundColor: c.bg }]}>
          <View style={[styles.deco, styles.deco1]} />
          <View style={[styles.deco, styles.deco2]} />
          <Icon name={s.cat} size={64} color={c.fg} />
          {l.images[0]?.url ? <CategoryArt category={s.cat} uri={l.images[0].url} style={StyleSheet.absoluteFill} /> : null}
          <Pill label={nb.forMeg.needHelp} tone="need" dot style={[styles.tl, shadow.whiteRing3]} />
          <Pill label={postedAgo(l.createdAt)} tone="line" icon="clock" style={styles.tr} />
        </View>
        <View style={styles.fbody}>
          <Text style={[text.h3, styles.ftitle]} numberOfLines={2}>
            {l.title}
          </Text>
          <View style={styles.row10}>
            <Avatar initials={l.owner.initials} uri={l.owner.avatarUrl} seed={l.owner.id} size={40} />
            <View style={styles.who}>
              <Text style={[text.label, styles.whoName]} numberOfLines={1}>
                {l.owner.displayName}
              </Text>
              <View style={styles.starsRow}>
                {l.owner.rating?.count ? (
                  <>
                    <Icon name="star" size={14} color={colors.star} filled />
                    <Text style={styles.starsVal}>{km(l.owner.rating.average)}</Text>
                    <Text style={styles.starsMeta} numberOfLines={1}>
                      {` (${l.owner.rating.count}) · ${categoryLabels[s.cat]}`}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.starsMeta}>{categoryLabels[s.cat]}</Text>
                )}
              </View>
            </View>
            <View style={styles.priceCol}>
              <Text style={styles.plabel}>{price.label || nb.forMeg.price}</Text>
              <Text style={[text.num, price.label ? null : styles.priceSmall]}>{price.value}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.lmeta}>
              <Icon name="pin" size={16} color={colors.faint} />
              <Text style={text.meta}>{listingPlace(l)}</Text>
            </View>
            {when ? (
              <View style={styles.lmeta}>
                <Icon name="cal" size={16} color={colors.faint} />
                <Text style={text.meta}>{when}</Text>
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
  );
}

function SaveControl({ id, onChange }: { id: string; onChange: (on: boolean) => void }) {
  const [saved, toggle] = useIsSaved(id);
  const press = () => {
    toggle();
    onChange(!saved);
    if (!saved) toast.success(nb.forMeg.savedToast, { icon: 'heart', bottom: 28 });
    else toast.info(nb.forMeg.unsavedToast, { icon: 'x', bottom: 28 });
  };
  return (
    <View style={styles.rcol}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={saved ? nb.forMeg.unsaveLabel : nb.forMeg.saveLabel}
        accessibilityState={{ selected: saved }}
        onPress={press}
        scaleTo={0.88}
        style={[styles.rbtn, shadow.medium, saved && styles.rbtnOn]}
      >
        <ScaleIn playKey={saved ? 1 : 0}>
          <Icon name="heart" size={24} color={saved ? colors.heart : colors.ink} filled={saved} />
        </ScaleIn>
      </PressableScale>
      <Text style={styles.rlab}>{saved ? nb.forMeg.saved : nb.forMeg.save}</Text>
    </View>
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
  skills: { marginTop: 12, paddingTop: 0 },
  skill: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.skillBg,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skillText: { ...text.bodySemi, fontSize: 13, lineHeight: 16 },
  change: { paddingHorizontal: 4, alignSelf: 'center' },
  toolbar: {
    paddingHorizontal: screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
    marginBottom: 16,
  },
  seg: { width: 190 },
  ctr: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  bars: { flexDirection: 'row', gap: 4, flexShrink: 1, overflow: 'hidden' },
  bar: { width: 14, height: 5, borderRadius: 3, backgroundColor: colors.barIdle },
  barOn: { width: 22, backgroundColor: colors.ink },
  barDone: { backgroundColor: colors.barDone },
  ctrNum: { fontSize: 15, lineHeight: 18 },
  errorBox: { height: 380 },

  stackwrap: { height: 492, marginHorizontal: screenPadding },
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
  tr: { position: 'absolute', right: 14, top: 14 },
  fbody: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 18, gap: 10, flex: 1 },
  ftitle: { fontSize: 22, lineHeight: 25 },
  row10: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  who: { flex: 1, minWidth: 0, gap: 3 },
  whoName: { fontSize: 14.5 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starsVal: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink },
  starsMeta: { fontFamily: text.meta.fontFamily, fontSize: 13, color: colors.mute, flexShrink: 1 },
  priceCol: { alignItems: 'flex-end', gap: 2 },
  plabel: { fontFamily: text.label.fontFamily, fontSize: 11.5, color: colors.mute },
  priceSmall: { fontSize: 17 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  lmeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 'auto' },
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

  controls: {
    paddingHorizontal: screenPadding,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  rcol: { alignItems: 'center' },
  rbtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rbtnOn: { backgroundColor: colors.savedBg },
  rlab: { fontFamily: text.label.fontFamily, fontSize: 11.5, color: colors.mute, textAlign: 'center', marginTop: 7 },
  cta: { flex: 1, marginTop: 3 },
  undoRow: { alignItems: 'center', marginTop: 14 },
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

  note: { justifyContent: 'center', marginTop: 22, marginHorizontal: screenPadding },
  bottom: { height: 48 },
});
