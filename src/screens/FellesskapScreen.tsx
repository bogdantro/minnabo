import { useFocusEffect, useRouter } from 'expo-router';
import { PartnerArt } from '@/components/art/Scenes';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dimensions, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from '@/components/ui/Image';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { MAX_NABOLAG } from '@/domain/nabolag';
import { MyNabolagCards } from '@/components/community/MyNabolagCards';
import { CommunityLinkCard } from '@/components/community/CommunityLinkCard';
import { EVENT_ICON, NOTICE_STYLE, eventTypeOf, noticeType } from '@/components/community/noticeKinds';
import { postedAgo } from '@/lib/datetime';
import type { Donation, NoticeboardPost, Partner } from '@/domain/types';
import { categoryBySlug } from '@/domain/categories';
import { formatPrice, nok } from '@/domain/price';
import { isEnabled } from '@/config/featureFlags';
import { upcomingEvents } from '@/components/community/EventsCalendar';
import { HelperPerks, activeHelperOffers } from '@/components/community/HelperPerks';
import {
  FellesSearchLink,
  NabolagFilter,
  NeighbourOffers,
  SupportCard,
  WeatherAlertCard,
  WeekCard,
  YouthCorner,
} from '@/components/community/FellesTop';
import { useAppSettings, useDonations, useMyNabolag, useNoticeboard, usePartners, useProfile } from '@/api/queries';
import { ImpressionWatcher, impressionLogged, logPartnerClick, logPartnerImpression, setPartnerStatsKommune, visibleRatio } from '@/lib/partnerStats';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { safePush } from '@/lib/nav';
import { useTabReselect } from '@/lib/tabReselect';
import { openWebsite } from '@/config/links';
import { colors, motion, radius, screenPadding, shadow, text } from '@/theme/theme';
import { HomeTopBar } from '@/components/TopBar';
import { ThanksButton, ThanksCount } from '@/components/PartnerThanks';
import {
  Avatar,
  Button,
  Card,
  FadeInView,
  FadeUp,
  Icon,
  IconButton,
  KeyValueRow,
  ListGroup,
  ListRow,
  Pill,
  PressableScale,
  ScaleIn,
  Screen,
  SectionHeader,
  SubHeader,
  Sheet,
  type IconKey,
  TextLink,
  pullRefreshControl,
  usePullRefresh,
} from '@/components/ui';

const CARD_STEP = 162; // 150 card + 12 gap
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DON_ICONS: IconKey[] = ['award', 'users', 'hand', 'mic'];
const DON_TONES = [
  { bg: colors.limeTint, fg: colors.limeDeep },
  { bg: colors.cyanTint, fg: colors.cyanDeep },
  { bg: colors.warnTint, fg: colors.warn },
];

/** `.float` / `.float2` drift for the hero collage. */
function Float({ period, children }: { period: number; children: ReactNode }) {
  const y = useSharedValue(0);
  useEffect(() => {
    const half = { duration: period / 2, easing: Easing.inOut(Easing.ease) };
    y.set(withRepeat(withSequence(withTiming(-9, half), withTiming(0, half)), -1));
    return () => cancelAnimation(y);
  }, [period, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}

/** Decorative collage in the hero (initials are illustration, not real people). */
function HeroArt() {
  return (
    <View style={styles.heroArt} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <FadeInView delay={100} style={[styles.blob, { left: 8, top: 46, width: 150, height: 150, backgroundColor: colors.heroBlobLime }]} />
      <FadeInView delay={150} style={[styles.blob, { right: -10, top: 18, width: 180, height: 180, backgroundColor: colors.heroBlobCyan }]} />
      <FadeInView delay={200} style={[styles.blob, styles.dashRing]} />
      <ScaleIn delay={150} style={[styles.heroCore, shadow.heroCore]}>
        <Float period={5000}>
          <View style={styles.heroHand}>
            <Icon name="hand" size={28} color={colors.ink} />
          </View>
        </Float>
      </ScaleIn>
      <FadeUp delay={200} style={{ position: 'absolute', left: 40, top: 56 }}>
        <Float period={6000}>
          <Avatar initials="JL" colorKey="b" size={48} />
        </Float>
      </FadeUp>
      <FadeUp delay={250} style={{ position: 'absolute', left: 88, top: 132 }}>
        <Float period={5000}>
          <Avatar initials="SN" colorKey="a" size={40} />
        </Float>
      </FadeUp>
      <FadeUp delay={300} style={{ position: 'absolute', right: 44, top: 42 }}>
        <Float period={6000}>
          <Avatar initials="KH" colorKey="c" size={48} />
        </Float>
      </FadeUp>
      <FadeUp delay={350} style={{ position: 'absolute', right: 86, top: 138 }}>
        <Float period={5000}>
          <Avatar initials="AS" colorKey="g" size={40} />
        </Float>
      </FadeUp>
      <FadeUp delay={400} style={{ position: 'absolute', right: 22, top: 122 }}>
        <Avatar initials="MH" me size={32} />
      </FadeUp>
      <FadeInView delay={400} style={[styles.dot, { left: 22, top: 150, width: 10, height: 10, backgroundColor: colors.lime }]} />
      <FadeInView delay={500} style={[styles.dot, { right: 140, top: 30, width: 8, height: 8, backgroundColor: colors.accentBlue, opacity: 0.6 }]} />
      <FadeInView delay={500} style={[styles.dot, { left: 150, top: 60, width: 6, height: 6, backgroundColor: colors.confettiGreen }]} />
    </View>
  );
}

/** «Innlandet Sparebank» -> 'IS', «Fjellbygg AS» -> 'F'. */
const monogram = (name: string) => {
  const words = name.replace(/\b(AS|ASA|SA|DA|BA|ANS)\b/g, '').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 1)).toUpperCase();
};

/**
 * Partner logo on a white tile. Until a partner delivers a logo it shows their initials on lime – a
 * «LOGO» placeholder looked unfinished (2026-11-10).
 */
function PartnerLogo({ uri, size = 68, name }: { uri?: string | null; size?: number; name?: string }) {
  const radiusFor = { width: size, height: size, borderRadius: size * 0.29 };
  if (uri) {
    return (
      <View style={[styles.logo, radiusFor]}>
        <Image source={{ uri }} resizeMode="contain" style={styles.logoImg} accessibilityIgnoresInvertColors />
      </View>
    );
  }
  if (name) {
    return (
      <View style={[styles.mono, radiusFor]}>
        <Text style={[styles.monoText, { fontSize: size * 0.34 }]}>{monogram(name)}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.logoph, radiusFor]}>
      <Icon name="building" size={size > 70 ? 32 : 24} color={colors.faint} />
      <Text style={styles.logoText}>{nb.fellesskap.logo}</Text>
    </View>
  );
}

/** A quiet card for an empty section: an icon disc, one line, and (for partner sections) «Bli partner». */
function EmptyNote({ icon, textValue, cta }: { icon: IconKey; textValue: string; cta?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.emptyNote}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={20} color={colors.ink2} />
      </View>
      <Text style={[text.meta, styles.flex]}>{textValue}</Text>
      {cta ? (
        <Pressable accessibilityRole="link" onPress={cta.onPress} hitSlop={8} style={styles.emptyCta}>
          <Text style={styles.emptyCtaText}>{cta.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Under the name in the støttespiller carousel: the line of business (category), else the partner's own line. */
const supporterLine = (p: Partner): string => (p.categorySlug ? categoryBySlug(p.categorySlug).label : p.tagline);

/** Fellesskap tab (design/screens/Fellesskap.dc.html). */
export function FellesskapScreen() {
  const pull = usePullRefresh();
  // tap «Fellesskap» again: back to the top
  const scrollRef = useRef<ScrollView>(null);
  useTabReselect('fellesskap', () => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  const router = useRouter();
  const me = useCurrentUser();
  const { municipality, municipalities, ready } = useLocationScope();
  const partnersQuery = usePartners();
  const partners = useMemo(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const settings = useAppSettings();
  const donations = useDonations().data ?? [];
  const postsData = useNoticeboard().data;
  const [carRaw, setCar] = useState(0);
  const [donAll, setDonAll] = useState(false);
  const [sheet, setSheet] = useState<Partner | null>(null);
  const [openedAt] = useState(() => Date.now());
  // «Tips en bedrift» and a donation's story (0108)
  const [story, setStory] = useState<Donation | null>(null);
  // one of my nabolag only, when I am in more than one (0108)
  const [onlyNabolag, setOnlyNabolag] = useState<string | null>(null);

  const main = partners.filter((p) => p.featured).slice(0, settings.maxHovedpartnere);
  // Lokale helter and støttespillere are scoped to the user's kommune; wait for
  // the profile so we never flash partners from other kommuner.
  const local = !ready
    ? []
    : partners.filter(
        // no kommune = «Hele Innlandet» in admin: shown in every kommune
        (p) => !p.featured && (municipalities.length === 0 || !p.municipality || municipalities.includes(p.municipality)),
      );
  const heroes = local.filter((p) => p.localHero);
  // «Fordeler for hjelpere» (0101): every partner in the kommune with a running offer
  const perks = activeHelperOffers([...main, ...local]);
  const supporters = local.filter((p) => !p.localHero);
  const maxCar = Math.max(0, supporters.length - 2);
  // the list can get shorter (kommune change, a partner switched off) – never past the end
  const car = Math.min(carRaw, maxCar);
  const trackX = useSharedValue(0);
  useEffect(() => {
    trackX.set(withTiming(-car * CARD_STEP, { duration: 550, easing: Easing.bezier(...motion.ease) }));
  }, [car, trackX]);
  const track = useAnimatedStyle(() => ({ transform: [{ translateX: trackX.value }] }));

  const scopedPosts = useMemo(
    () =>
      (postsData ?? []).filter(
        (p) => (municipalities.length === 0 || municipalities.includes(p.municipality)) && (!onlyNabolag || p.neighbourhoodId === onlyNabolag),
      ),
    [postsData, municipalities, onlyNabolag],
  );
  const newPosts = scopedPosts.filter((p) => Date.parse(p.createdAt) >= openedAt - NEW_WINDOW_MS).length;
  // the newest oppslag as a preview, and the faces of the neighbours who wrote lately
  const byNewest = useMemo(() => [...scopedPosts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [scopedPosts]);
  const latest = byNewest[0];
  const authors = [...new Set(byNewest.map((p) => p.authorProfileId))];
  const kommune = me.municipality || municipality || '';
  // nabolag are picked here, on Fellesskap → Nabolag (not at sign-up)
  const myNabolag = useMyNabolag(!!me.id).data ?? [];
  const shownDonations = donAll ? donations : donations.slice(0, 3);
  const donatedKr = donations.reduce((sum, d) => sum + d.amountKr, 0);

  // Partners are managed on the website: fresh every time the tab is opened (and live through
  // PlatformRealtime while it is open).
  const refetchPartners = partnersQuery.refetch;
  useFocusEffect(
    useCallback(() => {
      void refetchPartners();
    }, [refetchPartners]),
  );

  // Statistics for partners: a card at least half visible for a second counts once per session.
  const cards = useRef(new Map<string, View>());
  const [watcher] = useState(() => new ImpressionWatcher((id) => logPartnerImpression(id)));
  useEffect(() => {
    setPartnerStatsKommune(kommune || undefined);
  }, [kommune]);
  const checkVisible = useCallback(() => {
    const win = Dimensions.get('window');
    cards.current.forEach((node, id) => {
      if (impressionLogged(id) || typeof node.measureInWindow !== 'function') return;
      node.measureInWindow((x, y, width, height) => watcher.update(id, visibleRatio({ x, y, width, height }, win)));
    });
  }, [watcher]);
  const card = useCallback(
    (id: string) => (node: View | null) => {
      if (node) cards.current.set(id, node);
      else {
        cards.current.delete(id);
        watcher.update(id, 0);
      }
    },
    [watcher],
  );
  useEffect(() => () => watcher.dispose(), [watcher]);
  // after the list, the kommune or the carousel position changes (the carousel slides for ~550 ms)
  useEffect(() => {
    const t = setTimeout(checkVisible, 700);
    return () => clearTimeout(t);
  }, [checkVisible, partners, car, ready]);

  return (
    <Screen
      scroll
      spacer="nav"
      scrollRef={scrollRef}
      scrollProps={{ onScroll: checkVisible, scrollEventThrottle: 200, refreshControl: pullRefreshControl(pull) }}
      header={
        me.isYouth ? (
          <SubHeader title={nb.youth.community} onBack={() => (router.canGoBack() ? router.back() : router.replace('/ung'))} />
        ) : (
          <HomeTopBar
            avatar={{ uri: me.avatarUrl, initials: me.initials }}
            onProfilePress={() => safePush('/profil')}
            onNotificationsPress={() => safePush('/varsler')}
          />
        )
      }
    >
      <FadeUp style={[styles.px, styles.mt10]}>
        <View style={[styles.hero, shadow.card]}>
          <Text style={[text.eyebrow, { color: colors.limeDeep }]}>{nb.fellesskap.eyebrow(municipality ?? '')}</Text>
          <Text style={[text.h1, styles.heroTitle]} accessibilityRole="header">
            {nb.fellesskap.title}
          </Text>
          <Text style={[text.body, styles.heroLead]}>{nb.fellesskap.lead}</Text>
          <HeroArt />
        </View>
      </FadeUp>

      <FellesSearchLink />
      <WeatherAlertCard kommune={kommune} youth={me.isYouth} />
      <WeekCard kommune={kommune} />
      <NabolagFilter nabolag={myNabolag} value={onlyNabolag} onChange={setOnlyNabolag} />

      <View style={[styles.px, styles.links]}>
        <FadeUp delay={100}>
          {/* youth can join nabolag too (0103) */}
          {myNabolag.length ? (
            // the nabolag I chose: each opens directly
            <View style={styles.mine}>
              <MyNabolagCards nabolag={myNabolag} posts={postsData ?? []} now={openedAt} />
              <View style={styles.mineLinks}>
                <TextLink label={myNabolag.length < MAX_NABOLAG ? nb.fellesskap.addNabolag : nb.fellesskap.changeNabolag} onPress={() => safePush('/nabolag')} />
              </View>
            </View>
          ) : (
            <CommunityLinkCard
              tone="ink"
              icon="home"
              eyebrow={nb.fellesskap.nabolag}
              title={nb.fellesskap.nabolagCardTitle}
              body={nb.fellesskap.joinHint}
              faces={authors.slice(3, 6)}
              cta={nb.fellesskap.nabolagJoin}
              a11y={`${nb.fellesskap.nabolag}. ${nb.fellesskap.nabolagJoin}. ${nb.fellesskap.joinHint}`}
              onPress={() => safePush('/nabolag')}
              testID="fellesskap-nabolag"
            />
          )}
        </FadeUp>
        <FadeUp delay={150}>
          <CommunityLinkCard
            tone="cyan"
            icon="pinned"
            eyebrow={nb.fellesskap.oppslag}
            title={nb.fellesskap.oppslagTitle(municipality ?? '')}
            body={latest ? undefined : nb.fellesskap.oppslagEmpty}
            badge={newPosts ? nb.fellesskap.newCount(newPosts) : undefined}
            faces={authors.slice(0, 3)}
            preview={latest ? <LatestNotice post={latest} now={openedAt} /> : null}
            cta={nb.fellesskap.oppslagOpen}
            a11y={`${nb.fellesskap.oppslag}. ${nb.fellesskap.oppslagTitle(municipality ?? '')}${newPosts ? `, ${nb.fellesskap.newCount(newPosts)}` : ''}`}
            onPress={() => safePush('/oppslagstavle')}
            testID="fellesskap-oppslag"
          />
        </FadeUp>
      </View>

      {me.isYouth ? <YouthCorner events={upcomingEvents(scopedPosts, openedAt)} /> : null}
      {isEnabled('neighbourOffers') ? <NeighbourOffers partners={[...main, ...local]} /> : null}


      <FadeUp delay={200} style={[styles.px, styles.mt30]}>
        <View style={styles.partnerNote}>
          <View style={styles.noteIcon}>
            <Icon name="heart" size={20} color={colors.limeDeep} filled />
          </View>
          <View style={styles.flex}>
            <Text style={styles.noteTitle}>{nb.fellesskap.freeTitle}</Text>
            <Text style={[text.explain, styles.ink2]}>{nb.fellesskap.partnerNote}</Text>
          </View>
        </View>
      </FadeUp>

      <SectionHeader
        icon="award"
        iconBg={colors.ink}
        iconColor={colors.lime}
        title={nb.fellesskap.mainTitle}
        subtitle={nb.fellesskap.mainSub}
      />
      <View style={[styles.px, styles.gap12]}>
        {main.length === 0 ? (
          <EmptyNote icon="award" textValue={nb.fellesskap.noMain} />
        ) : (
          main.map((p, i) => (
            <FadeUp key={p.id} delay={i * 50}>
             <View ref={card(p.id)} collapsable={false} onLayout={checkVisible}>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={nb.fellesskap.readAbout(p.name)}
                onPress={() => safePush(`/partner/${p.id}`)}
                scaleTo={0.985}
                style={[styles.mcard, shadow.medium]}
              >
                <View style={styles.mcover}>
                  {p.coverUrl ? (
                    <Image source={{ uri: p.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
                  ) : (
                    <>
                      <View style={styles.mglow1} />
                      <View style={styles.mglow2} />
                    </>
                  )}
                  <Pill label={nb.fellesskap.mainBadge} tone="accent" icon="award" size="sm" style={styles.mbadge} />
                </View>
                <View style={styles.mbody}>
                  <View style={styles.mlogo}>
                    <PartnerLogo uri={p.logoUrl} size={72} name={p.name} />
                  </View>
                  <Text style={styles.mname}>{p.name}</Text>
                  <Text style={[text.body, styles.ink2]}>{p.tagline}</Text>
                  {p.about ? (
                    <Text style={[text.meta, styles.mabout]} numberOfLines={3}>
                      {p.about}
                    </Text>
                  ) : null}
                  <ThanksCount partnerId={p.id} style={styles.mthanks} />
                  {/* straight to the partner, without opening the page first; both count as a click in their statistics */}
                  {p.url || p.phone ? (
                    <View style={styles.mactions}>
                      {p.url ? (
                        <Button
                          label={nb.fellesskap.visit}
                          icon="arrowur"
                          variant="ink"
                          size="sm"
                          accessibilityLabel={nb.fellesskap.visitAria(p.name)}
                          onPress={() => {
                            logPartnerClick(p.id, kommune || undefined);
                            void Linking.openURL(p.url!);
                          }}
                          style={styles.flex}
                        />
                      ) : null}
                      {p.phone ? (
                        <Button
                          label={nb.fellesskap.call}
                          icon="phone"
                          variant="ghost"
                          size="sm"
                          accessibilityLabel={nb.fellesskap.callAria(p.name)}
                          onPress={() => {
                            logPartnerClick(p.id, kommune || undefined);
                            void Linking.openURL(`tel:${p.phone!.replace(/\s/g, '')}`);
                          }}
                          style={styles.flex}
                        />
                      ) : null}
                    </View>
                  ) : null}
                  <View style={styles.mmore}>
                    <Text style={styles.mmoreText}>{nb.fellesskap.readMore}</Text>
                    <View style={styles.mmoreIcon}>
                      <Icon name="arrow" size={16} color={colors.ink} />
                    </View>
                  </View>
                </View>
              </PressableScale>
             </View>
            </FadeUp>
          ))
        )}
      </View>

      <SectionHeader
        icon="heart"
        iconBg={colors.limeTint}
        iconColor={colors.limeDeep}
        title={nb.fellesskap.heroTitle}
        subtitle={nb.fellesskap.heroSub(municipality ?? '')}
      />
      {heroes.length === 0 ? (
        <View style={styles.px}>
          <EmptyNote icon="heart" textValue={nb.fellesskap.heroNone(municipality ?? '')} />
        </View>
      ) : (
          <View style={[styles.px, styles.gap12]}>
            {heroes.map((p, i) => (
              <FadeUp key={p.id} delay={i * 50}>
               <View ref={card(p.id)} collapsable={false} onLayout={checkVisible}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={nb.fellesskap.readAbout(p.name)}
                  onPress={() => setSheet(p)}
                  scaleTo={0.985}
                  style={[styles.pcard, shadow.card]}
                >
                  <PartnerLogo uri={p.logoUrl} name={p.name} />
                  <View style={styles.pbody}>
                    <Text style={styles.pname}>{p.name}</Text>
                    <Text style={text.meta}>{p.tagline}</Text>
                  </View>
                  <Icon name="right" size={20} color={colors.faint} />
                </PressableScale>
               </View>
              </FadeUp>
            ))}
          </View>
      )}

      <View style={[styles.supHead, styles.mt34]}>
        <SectionHeader
          inset={false}
          style={styles.noMargin}
          icon="building"
          iconBg={colors.cyanTint}
          iconColor={colors.cyanDeep}
          title={nb.fellesskap.supTitle}
          subtitle={
            supporters.length > 1
              ? nb.fellesskap.supRange(car + 1, car + 2, supporters.length)
              : supporters.length === 1
                ? nb.fellesskap.supOne
                : undefined
          }
        />
        {supporters.length > 2 ? (
          <View style={styles.row8}>
            <IconButton
              icon="left"
              iconSize={18}
              accessibilityLabel={nb.fellesskap.prev}
              disabled={car === 0}
              onPress={() => setCar((c) => Math.max(0, c - 1))}
              style={car === 0 && styles.dim}
            />
            <IconButton
              icon="right"
              iconSize={18}
              accessibilityLabel={nb.fellesskap.next}
              disabled={car >= maxCar}
              onPress={() => setCar((c) => Math.min(maxCar, c + 1))}
              style={car >= maxCar && styles.dim}
            />
          </View>
        ) : null}
      </View>
      {supporters.length === 0 ? (
        <View style={styles.px}>
          <EmptyNote icon="building" textValue={nb.fellesskap.supNone(municipality ?? '')} />
        </View>
      ) : (
        <>
          <View style={styles.carView}>
            {/* No autoplay: the user moves the carousel (design: quiet supporters). */}
            <Animated.View style={[styles.carTrack, track]}>
              {supporters.map((s) => (
                <View
                  key={s.id}
                  ref={card(s.id)}
                  collapsable={false}
                  onLayout={checkVisible}
                  style={styles.scard}
                  accessible
                  accessibilityLabel={`${s.name}, ${supporterLine(s)}`}
                >
                  {s.logoUrl ? (
                    <View style={styles.scardLogoImg} testID={`supporter-logo-${s.id}`}>
                      <Image source={{ uri: s.logoUrl }} resizeMode="contain" style={styles.logoImg} accessibilityIgnoresInvertColors />
                    </View>
                  ) : (
                    <PartnerLogo size={44} name={s.name} />
                  )}
                  <View style={styles.gap3}>
                    {/* two lines, so a longer company name is never cut to nothing */}
                    <Text style={[text.label, styles.scardName]} numberOfLines={2}>
                      {s.name}
                    </Text>
                    {supporterLine(s) ? (
                      <Text style={[text.meta, { fontSize: 12.5 }]} numberOfLines={2}>
                        {supporterLine(s)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </Animated.View>
          </View>
          {maxCar > 0 ? (
            <View style={styles.dots}>
              {Array.from({ length: maxCar + 1 }).map((_, i) => (
                <View key={i} style={[styles.dotI, i === car && styles.dotOn]} />
              ))}
            </View>
          ) : null}
        </>
      )}

      {/* businesses become partners on the website (packages and payment live there, never in the app) */}
      {!me.isYouth ? (
        <View style={[styles.px, styles.mt22]}>
          <View style={[styles.pcta, shadow.medium]} testID="partner-cta">
            <View style={styles.pctaScene}>
              <PartnerArt />
            </View>
            <View style={styles.pctaBody}>
              <Text style={styles.pctaTitle} accessibilityRole="header">
                {nb.fellesskap.partnerCtaTitle}
              </Text>
              <Text style={styles.pctaText}>{nb.fellesskap.partnerCtaBody}</Text>
              <View style={styles.pctaPoints}>
                {nb.fellesskap.partnerCtaPoints.map((p) => (
                  <View key={p} style={styles.pctaPoint}>
                    <View style={styles.pctaTick}>
                      <Icon name="check" size={13} color={colors.ink} strokeWidth={3} />
                    </View>
                    <Text style={styles.pctaPointText}>{p}</Text>
                  </View>
                ))}
              </View>
              <Button
                label={nb.fellesskap.partnerCtaButton}
                iconRight="arrow"
                variant="lime"
                size="lg"
                flat
                accessibilityLabel={nb.fellesskap.partnerCtaA11y}
                onPress={() => openWebsite('bedrifter')}
              />
              <Text style={styles.pctaNote}>{nb.fellesskap.partnerCtaNote}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* «Fordeler for hjelpere» (0101): at the end, just before the donations (asked 2026-11-12) */}
      {isEnabled('helperPerks') && perks.length && !me.isYouth ? (
        <>
          <SectionHeader icon="tag" iconBg={colors.lime} iconColor={colors.ink} title={nb.perks.title} subtitle={nb.perks.sub} />
          <View style={styles.px}>
            <HelperPerks partners={perks} kommune={kommune || undefined} />
          </View>
        </>
      ) : null}

      <SectionHeader icon="gift" title={nb.fellesskap.donTitle} subtitle={nb.fellesskap.donSub} style={styles.mt34} />
      <SupportCard kommune={kommune} />
      <View style={[styles.px, styles.mt12]}>
        {donations.length === 0 ? (
          <EmptyNote icon="gift" textValue={nb.fellesskap.noDonations} />
        ) : (
          <>
            <View style={[styles.donTotal, shadow.card]} accessible accessibilityLabel={`${nb.fellesskap.donTotalLabel}: ${formatPrice(nok(donatedKr))}`}>
              <View style={styles.donBlob} />
              <View style={styles.donIcon}>
                <Icon name="gift" size={22} color={colors.limeDeep} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.donTotalLabel}>{nb.fellesskap.donTotalLabel}</Text>
                <Text style={styles.donTotalNum}>{formatPrice(nok(donatedKr))}</Text>
                <Text style={text.meta}>{nb.fellesskap.donTotalSub(donations.length)}</Text>
              </View>
            </View>
            <ListGroup>
              {shownDonations.map((d, i) => (
                <ListRow
                  key={d.id}
                  icon={DON_ICONS[i % DON_ICONS.length]}
                  iconBg={DON_TONES[i % DON_TONES.length].bg}
                  iconColor={DON_TONES[i % DON_TONES.length].fg}
                  title={d.recipient}
                  subtitle={d.storyTitle ? `${d.period} · ${nb.felles.support.story}` : d.period}
                  onPress={d.storyTitle ? () => setStory(d) : undefined}
                  right={
                    <View style={styles.donRight}>
                      <Text style={[text.num, { fontSize: 17, lineHeight: 19 }]}>{formatPrice(nok(d.amountKr))}</Text>
                      <Pill label={nb.fellesskap.transferred} tone="ok" icon="check" size="sm" style={styles.pill22} />
                    </View>
                  }
                />
              ))}
            </ListGroup>
            {donations.length > 3 ? (
              <Button
                label={donAll ? nb.fellesskap.showFewer : nb.fellesskap.showAll}
                iconRight={donAll ? 'up' : 'down'}
                variant="ghost"
                size="sm"
                onPress={() => setDonAll((v) => !v)}
                style={styles.donToggle}
              />
            ) : null}
          </>
        )}
      </View>

      <Sheet visible={!!story} onClose={() => setStory(null)} title={nb.felles.support.storyTitle} titleSize="h2" scroll>
        {story ? (
          <View style={styles.storyBody}>
            {story.storyImageUrl ? (
              <Image source={{ uri: story.storyImageUrl }} style={styles.storyImage} resizeMode="cover" accessibilityIgnoresInvertColors />
            ) : null}
            <Text style={text.h3}>{story.storyTitle}</Text>
            <Text style={text.meta}>{`${story.recipient} · ${formatPrice(nok(story.amountKr))}`}</Text>
            {story.storyBody ? <Text style={text.body}>{story.storyBody}</Text> : null}
          </View>
        ) : null}
      </Sheet>
      <Sheet visible={!!sheet} onClose={() => setSheet(null)}>
        {sheet ? (
          <View>
            <View style={styles.sheetTop}>
              <ScaleIn>
                <PartnerLogo uri={sheet.logoUrl} size={84} name={sheet.name} />
              </ScaleIn>
              <View style={[styles.flex, { gap: 6 }]}>
                <Text style={text.h2}>{sheet.name}</Text>
                <Text style={text.meta}>{[sheet.tagline, sheet.municipality].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
            <Card flat style={styles.sheetCard}>
              {sheet.url ? (
                <KeyValueRow
                  label={nb.fellesskap.website}
                  value={
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => {
                        logPartnerClick(sheet.id, kommune || undefined);
                        void Linking.openURL(sheet.url!);
                      }}
                    >
                      <Text style={[text.kvValue, { color: colors.cyanDeep }]}>{sheet.url.replace(/^https?:\/\//, '')}</Text>
                    </Pressable>
                  }
                />
              ) : null}
              <KeyValueRow label={nb.fellesskap.area} value={sheet.municipality ?? 'Innlandet'} last />
            </Card>
            <ThanksCount partnerId={sheet.id} style={styles.sheetThanks} />
            <ThanksButton partner={sheet} variant="ink" onThanked={() => setSheet(null)} style={styles.mt18} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

/** The newest oppslag inside the Oppslagstavla card: who, the type, the title and when. */
function LatestNotice({ post, now }: { post: NoticeboardPost; now: number }) {
  const { data: author } = useProfile(post.authorProfileId);
  const type = noticeType(post);
  const k = NOTICE_STYLE[type];
  const ev = eventTypeOf(post);
  const kindIcon = ev ? EVENT_ICON[ev] : k.icon;
  const kindLabel = ev ? nb.events.types[ev] : nb.noticeboard.kindsShort[type];
  return (
    <View style={styles.latest}>
      <Avatar initials={author?.initials ?? '·'} uri={author?.avatarUrl} seed={post.authorProfileId} size={40} ring={false} />
      <View style={styles.flex}>
        <View style={styles.latestTop}>
          <View style={[styles.latestKind, { backgroundColor: k.bg }]}>
            <Icon name={kindIcon} size={11} color={k.fg} />
            <Text style={[styles.latestKindText, { color: k.fg }]}>{kindLabel}</Text>
          </View>
          <Text style={styles.latestWhen} numberOfLines={1}>
            {postedAgo(post.createdAt, new Date(now))}
          </Text>
        </View>
        <Text style={styles.latestTitle} numberOfLines={1}>
          {post.title}
        </Text>
        <Text style={styles.latestWho} numberOfLines={1}>
          {author?.displayName ?? ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  storyBody: { gap: 10, paddingBottom: 8 },
  storyImage: { width: '100%', aspectRatio: 1.6, borderRadius: radius.tile },
  mt12: { marginTop: 12 },
  latest: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, padding: 12, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.white },
  latestTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  latestKind: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 20, paddingHorizontal: 7, borderRadius: radius.pill },
  latestKindText: { fontFamily: text.pill.fontFamily, fontSize: 11 },
  latestWhen: { ...text.small, flexShrink: 1 },
  latestTitle: { fontFamily: text.label.fontFamily, fontSize: 15, lineHeight: 20, color: colors.ink, marginTop: 3 },
  latestWho: { ...text.small, color: colors.ink2 },
  flex: { flex: 1 },
  px: { paddingHorizontal: screenPadding },
  mt10: { marginTop: 10 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  mt26: { marginTop: 26 },
  mt30: { marginTop: 30 },
  mt34: { marginTop: 34 },
  mt22: { marginTop: 22 },
  pcta: { borderRadius: radius.listingCard, backgroundColor: colors.ink, overflow: 'hidden' },
  pctaScene: { height: 150 },
  pctaBody: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20, gap: 10 },
  pctaTitle: { ...text.h2, fontSize: 25, lineHeight: 29, color: colors.white },
  pctaText: { ...text.body, fontSize: 15, lineHeight: 21, color: colors.onInk78 },
  pctaPoints: { gap: 9, marginTop: 4, marginBottom: 6 },
  pctaPoint: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pctaTick: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  pctaPointText: { flex: 1, fontFamily: text.bodySemi.fontFamily, fontSize: 14.5, lineHeight: 20, color: colors.white },
  pctaNote: { ...text.meta, color: colors.onInk62, textAlign: 'center' },
  gap3: { gap: 3 },
  gap12: { gap: 12 },
  row4: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row6: { flexDirection: 'row', gap: 6 },
  row8: { flexDirection: 'row', gap: 8 },
  pill22: { height: 22 },
  pill24: { height: 24 },
  dim: { opacity: 0.4 },
  empty: { paddingVertical: 8 },
  noMargin: { marginTop: 0, marginBottom: 0, flex: 1 },
  hero: { borderRadius: radius.nav, backgroundColor: colors.limeSoft, overflow: 'hidden', paddingTop: 22, paddingHorizontal: 20, paddingBottom: 16 },
  mono: { backgroundColor: colors.limeTint, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  monoText: { fontFamily: text.h2.fontFamily, color: colors.limeDeep, letterSpacing: -0.5 },
  emptyNote: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.white },
  emptyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  emptyCta: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.lime },
  emptyCtaText: { fontFamily: text.label.fontFamily, fontSize: 13, color: colors.ink },
  donTotal: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginBottom: 12, borderRadius: radius.card, backgroundColor: colors.white, overflow: 'hidden' },
  donBlob: { position: 'absolute', right: -40, top: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: colors.limeTint },
  donIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.limeTint, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  donTotalLabel: { ...text.eyebrow, fontSize: 11, color: colors.limeDeep },
  donTotalNum: { ...text.num, fontSize: 28, lineHeight: 32, marginTop: 2 },
  heroTitle: { marginTop: 10, fontSize: 32, lineHeight: 34, letterSpacing: -0.96 },
  heroLead: { marginTop: 8, color: colors.ink2 },
  heroArt: { height: 178, marginTop: 6, marginHorizontal: -20 },
  blob: { position: 'absolute', borderRadius: 999 },
  dashRing: {
    left: '50%',
    top: 40,
    marginLeft: -88,
    width: 176,
    height: 176,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.heroDash,
  },
  heroCore: {
    position: 'absolute',
    left: '50%',
    top: 76,
    marginLeft: -52,
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHand: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', borderRadius: 999 },
  links: { gap: 12, marginTop: 16 },
  mine: { gap: 10 },
  mineLinks: { flexDirection: 'row', gap: 18, paddingHorizontal: 4 },
  linkcard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  linkIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  linkBody: { flex: 1, minWidth: 0, gap: 6 },
  linkTitle: { fontFamily: text.h3.fontFamily, fontSize: 17, lineHeight: 20.4, letterSpacing: -0.34, color: colors.ink },
  partnerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    backgroundColor: colors.limeTint,
  },
  noteIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  noteTitle: { fontFamily: text.label.fontFamily, fontSize: 15.5, color: colors.ink, marginBottom: 2 },
  pcard: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    padding: 18,
    borderRadius: 26,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.navHairline,
    overflow: 'hidden',
  },
  pglow: {
    position: 'absolute',
    right: -50,
    top: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.lime,
    opacity: 0.14,
  },
  pbody: { flex: 1, minWidth: 0, gap: 6 },
  ink2: { color: colors.ink2 },
  // hovedpartner: one large card each
  mcard: { borderRadius: radius.listingCard, backgroundColor: colors.white, overflow: 'hidden' },
  mcover: { height: 96, backgroundColor: colors.ink, overflow: 'hidden' },
  mglow1: { position: 'absolute', right: -50, top: -70, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.lime, opacity: 0.35 },
  mglow2: { position: 'absolute', left: -40, bottom: -90, width: 170, height: 170, borderRadius: 85, backgroundColor: colors.cyan, opacity: 0.2 },
  mbadge: { position: 'absolute', right: 14, top: 14, height: 24 },
  mbody: { paddingHorizontal: 18, paddingBottom: 18, gap: 6 },
  mlogo: { marginTop: -36, marginBottom: 6, alignSelf: 'flex-start', borderRadius: 22, ...shadow.card },
  mname: { fontFamily: text.h2.fontFamily, fontSize: 22, lineHeight: 26, letterSpacing: -0.5, color: colors.ink },
  mabout: { marginTop: 4, fontSize: 14, lineHeight: 20 },
  mmore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, height: 48, paddingLeft: 18, paddingRight: 6, borderRadius: radius.pill, backgroundColor: colors.bg },
  mmoreIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  mthanks: { marginTop: 6 },
  mactions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  sheetThanks: { marginTop: 14, alignSelf: 'center' },
  mmoreText: { fontFamily: text.label.fontFamily, fontSize: 15, color: colors.ink },
  pname: { fontFamily: text.h3.fontFamily, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.36, color: colors.ink },
  logo: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  logoImg: { width: '100%', height: '100%' },
  logoph: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.logoDash,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    position: 'absolute',
    bottom: 6,
    fontFamily: text.label.fontFamily,
    fontSize: 9,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    color: colors.faint,
  },
  supHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: screenPadding, marginBottom: 14 },
  carView: { overflow: 'hidden', paddingTop: 4, paddingHorizontal: screenPadding, paddingBottom: 10 },
  carTrack: { flexDirection: 'row', gap: 12 },
  scard: {
    width: 150,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10,
  },
  scardLogo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scardLogoImg: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  scardName: { fontSize: 14.5, lineHeight: 18 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 4 },
  dotI: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.dashed },
  dotOn: { width: 24, backgroundColor: colors.ink },
  donRight: { alignItems: 'flex-end', gap: 6 },
  donToggle: { marginTop: 12, height: 46 },
  sheetHead: { marginBottom: 16 },
  sheetTop: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  sheetCard: { marginTop: 16, paddingVertical: 4, paddingHorizontal: 16 },
});
