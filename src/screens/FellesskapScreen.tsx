import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
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
import type { NoticeKind, Partner } from '@/domain/types';
import { formatPrice, nok } from '@/domain/price';
import { useDonations, useNeighbourhoodInfo, useNoticeboard, usePartners } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, motion, radius, screenPadding, shadow, text } from '@/theme/theme';
import { HomeTopBar } from '@/components/TopBar';
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
  Note,
  Pill,
  PressableScale,
  ScaleIn,
  Screen,
  SectionHeader,
  Sheet,
  type IconKey,
} from '@/components/ui';

const CARD_STEP = 162; // 150 card + 12 gap
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const KIND_PILL: Record<NoticeKind, { tone: 'ok' | 'warn' | 'offer' | 'neutral'; icon: IconKey }> = {
  GIVEAWAY: { tone: 'ok', icon: 'gift' },
  LOST_FOUND: { tone: 'warn', icon: 'key' },
  TOOL_LEND: { tone: 'offer', icon: 'montering' },
  GENERAL: { tone: 'neutral', icon: 'pinned' },
};
const DON_ICONS: IconKey[] = ['award', 'users', 'hand', 'mic'];

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

/** Dashed logo placeholder (`.logoph`) until partners deliver their logo. */
function LogoPlaceholder({ size = 68 }: { size?: number }) {
  return (
    <View style={[styles.logoph, { width: size, height: size, borderRadius: size * 0.29 }]}>
      <Icon name="building" size={size > 70 ? 32 : 24} color={colors.faint} />
      <Text style={styles.logoText}>{nb.fellesskap.logo}</Text>
    </View>
  );
}

/** Fellesskap tab (design/screens/Fellesskap.dc.html). */
export function FellesskapScreen() {
  const me = useCurrentUser();
  const { municipality, municipalities, ready } = useLocationScope();
  const partners = usePartners().data ?? [];
  const donations = useDonations().data ?? [];
  const postsData = useNoticeboard().data;
  const [car, setCar] = useState(0);
  const [donAll, setDonAll] = useState(false);
  const [sheet, setSheet] = useState<Partner | null>(null);
  const [openedAt] = useState(() => Date.now());

  const main = partners.filter((p) => p.featured).slice(0, 2);
  // Local supporters are scoped to the user's kommune; wait for the profile
  // so we never flash supporters from other kommuner.
  const supporters = !ready
    ? []
    : partners.filter(
        (p) => !p.featured && (municipalities.length === 0 || (p.municipality !== null && municipalities.includes(p.municipality))),
      );
  const maxCar = Math.max(0, supporters.length - 2);
  const trackX = useSharedValue(0);
  useEffect(() => {
    trackX.set(withTiming(-car * CARD_STEP, { duration: 550, easing: Easing.bezier(...motion.ease) }));
  }, [car, trackX]);
  const track = useAnimatedStyle(() => ({ transform: [{ translateX: trackX.value }] }));

  const scopedPosts = useMemo(
    () => (postsData ?? []).filter((p) => municipalities.length === 0 || municipalities.includes(p.municipality)),
    [postsData, municipalities],
  );
  const newPosts = scopedPosts.filter((p) => Date.parse(p.createdAt) >= openedAt - NEW_WINDOW_MS).length;
  const kinds = [...new Set(scopedPosts.map((p) => p.kind))].slice(0, 2);
  const kommune = me.municipality || municipality || '';
  const area = me.place || kommune;
  const { data: hood } = useNeighbourhoodInfo(kommune, area);
  const members = hood?.memberCount ?? 0;
  const shownDonations = donAll ? donations : donations.slice(0, 3);

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

      <View style={[styles.px, styles.links]}>
        <FadeUp delay={100}>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={`${nb.fellesskap.nabolag}. ${area ? nb.fellesskap.nabolagTitle(area) : nb.fellesskap.nabolagJoin}`}
            onPress={() => safePush('/nabolag')}
            scaleTo={0.985}
            style={[styles.linkcard, shadow.card]}
          >
            <View style={[styles.linkIcon, { backgroundColor: colors.limeTint }]}>
              <Icon name="home" size={22} color={colors.limeDeep} />
            </View>
            <View style={styles.linkBody}>
              <Text style={[text.eyebrow, { fontSize: 11 }]}>{nb.fellesskap.nabolag}</Text>
              <Text style={styles.linkTitle}>{area ? nb.fellesskap.nabolagTitle(area) : nb.fellesskap.nabolagJoin}</Text>
              <Text style={text.meta}>{area ? nb.fellesskap.members(members) : nb.fellesskap.joinHint}</Text>
            </View>
            <Icon name="right" size={20} color={colors.faint} />
          </PressableScale>
        </FadeUp>
        <FadeUp delay={150}>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={`${nb.fellesskap.oppslag}. ${nb.fellesskap.oppslagTitle(municipality ?? '')}${newPosts ? `, ${nb.fellesskap.newCount(newPosts)}` : ''}`}
            onPress={() => safePush('/oppslagstavle')}
            scaleTo={0.985}
            style={[styles.linkcard, shadow.card]}
          >
            <View style={[styles.linkIcon, { backgroundColor: colors.cyanTint }]}>
              <Icon name="pinned" size={22} color={colors.cyanDeep} />
            </View>
            <View style={styles.linkBody}>
              <Text style={[text.eyebrow, { fontSize: 11 }]}>{nb.fellesskap.oppslag}</Text>
              <Text style={styles.linkTitle}>{nb.fellesskap.oppslagTitle(municipality ?? '')}</Text>
              {kinds.length ? (
                <View style={styles.row6}>
                  {kinds.map((k) => (
                    <Pill key={k} label={nb.fellesskap.kinds[k]} tone={KIND_PILL[k].tone} icon={KIND_PILL[k].icon} size="sm" style={styles.pill22} />
                  ))}
                </View>
              ) : (
                <Text style={text.meta}>{nb.fellesskap.noNew}</Text>
              )}
            </View>
            {newPosts ? <Pill label={nb.fellesskap.newCount(newPosts)} tone="dark" style={styles.pill24} /> : null}
          </PressableScale>
        </FadeUp>
      </View>

      <FadeUp delay={200} style={[styles.px, styles.mt30]}>
        <View style={styles.partnerNote}>
          <View style={styles.noteIcon}>
            <Icon name="info" size={18} color={colors.ink2} />
          </View>
          <Text style={[text.explain, styles.flex]}>{nb.fellesskap.partnerNote}</Text>
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
          <Text style={[text.meta, styles.empty]}>{nb.fellesskap.noMain}</Text>
        ) : (
          main.map((p, i) => (
            <FadeUp key={p.id} delay={i * 50}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={nb.fellesskap.readAbout(p.name)}
                onPress={() => setSheet(p)}
                scaleTo={0.985}
                style={[styles.pcard, shadow.medium]}
              >
                <View style={styles.pglow} />
                <LogoPlaceholder />
                <View style={styles.pbody}>
                  <Pill label={nb.fellesskap.mainBadge} tone="accent" icon="award" size="sm" style={styles.pill22} />
                  <Text style={styles.pname}>{p.name}</Text>
                  <Text style={text.meta}>{p.tagline}</Text>
                </View>
                <Icon name="right" size={20} color={colors.faint} />
              </PressableScale>
            </FadeUp>
          ))
        )}
      </View>

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
        <Text style={[text.meta, styles.px, styles.empty]}>{nb.fellesskap.supNone(municipality ?? '')}</Text>
      ) : (
        <>
          <View style={styles.carView}>
            {/* No autoplay: the user moves the carousel (design: quiet supporters). */}
            <Animated.View style={[styles.carTrack, track]}>
              {supporters.map((s) => (
                <View key={s.id} style={styles.scard} accessible accessibilityLabel={`${s.name}, ${s.tagline}`}>
                  <View style={styles.scardLogo}>
                    <Icon name="building" size={22} color={colors.faint} />
                  </View>
                  <View style={styles.gap3}>
                    <Text style={[text.label, { fontSize: 14.5 }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={[text.meta, { fontSize: 12.5 }]} numberOfLines={1}>
                      {s.tagline}
                    </Text>
                  </View>
                  {s.municipality ? (
                    <View style={styles.row4}>
                      <Icon name="pin" size={14} color={colors.faint} />
                      <Text style={[text.meta, { fontSize: 12 }]}>{s.municipality}</Text>
                    </View>
                  ) : null}
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

      <SectionHeader icon="gift" title={nb.fellesskap.donTitle} subtitle={nb.fellesskap.donSub} style={styles.mt34} />
      <View style={styles.px}>
        {donations.length === 0 ? (
          <Text style={[text.meta, styles.empty]}>{nb.fellesskap.noDonations}</Text>
        ) : (
          <>
            <ListGroup>
              {shownDonations.map((d, i) => (
                <ListRow
                  key={d.id}
                  icon={DON_ICONS[i % DON_ICONS.length]}
                  iconColor={colors.ink2}
                  title={d.recipient}
                  subtitle={d.period}
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

      <View style={[styles.px, styles.mt26]}>
        <View style={styles.coming}>
          <View style={styles.comingIcon}>
            <Icon name="hourglass" size={18} color={colors.mute} />
          </View>
          <View style={[styles.flex, { gap: 6 }]}>
            <Pill label={nb.fellesskap.coming} size="sm" style={styles.pill22} />
            <Text style={[text.body, { fontSize: 14, lineHeight: 19.6, color: colors.mute }]}>{nb.fellesskap.redCross}</Text>
          </View>
        </View>
      </View>

      <Sheet visible={!!sheet} onClose={() => setSheet(null)}>
        {sheet ? (
          <View>
            <View style={styles.sheetHead}>
              <Pill label={nb.fellesskap.mainBadge} tone="accent" icon="award" />
            </View>
            <View style={styles.sheetTop}>
              <ScaleIn>
                <LogoPlaceholder size={84} />
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
                    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(sheet.url!)}>
                      <Text style={[text.kvValue, { color: colors.cyanDeep }]}>{sheet.url.replace(/^https?:\/\//, '')}</Text>
                    </Pressable>
                  }
                />
              ) : null}
              <KeyValueRow label={nb.fellesskap.area} value={sheet.municipality ?? 'Innlandet'} last />
            </Card>
            <Note style={styles.mt16}>{nb.fellesskap.partnerSheetNote}</Note>
            <Button
              label={nb.fellesskap.thanks}
              icon="heart"
              variant="ink"
              onPress={() => {
                toast.success(nb.fellesskap.thanked(sheet.name), { icon: 'heart' });
                setSheet(null);
              }}
              style={styles.mt18}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  px: { paddingHorizontal: screenPadding },
  mt10: { marginTop: 10 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  mt26: { marginTop: 26 },
  mt30: { marginTop: 30 },
  mt34: { marginTop: 34 },
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
  hero: { borderRadius: radius.nav, backgroundColor: colors.limeSoft, overflow: 'hidden', paddingTop: 22, paddingHorizontal: 20 },
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
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  noteIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
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
  pname: { fontFamily: text.h3.fontFamily, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.36, color: colors.ink },
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
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 4 },
  dotI: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.dashed },
  dotOn: { width: 24, backgroundColor: colors.ink },
  donRight: { alignItems: 'flex-end', gap: 6 },
  donToggle: { marginTop: 12, height: 46 },
  coming: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    padding: 18,
    borderRadius: radius.option,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    backgroundColor: colors.comingBg,
  },
  comingIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.neutralPill, alignItems: 'center', justifyContent: 'center' },
  sheetHead: { marginBottom: 16 },
  sheetTop: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  sheetCard: { marginTop: 16, paddingVertical: 4, paddingHorizontal: 16 },
});
