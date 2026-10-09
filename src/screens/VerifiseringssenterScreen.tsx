import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { PublicProfile, Review } from '@/domain/types';
import nb from '@/i18n/nb';
import { useListingsByIds, useProfile, useReviews, useVerify } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { longDate } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { useTrustedContacts } from '@/lib/trustedContacts';
import { categoryColors, colors, fonts, motion, radius, screenPadding, shadow, text } from '@/theme/theme';
import { FallbackScreen } from '@/components/FallbackScreen';
import {
  Button,
  Checkbox,
  FadeUp,
  GrowBar,
  Icon,
  Pill,
  PressableScale,
  Screen,
  SectionHeader,
  SubHeader,
  TextLink,
  type IconName,
} from '@/components/ui';

type RowId = 'VIPPS' | 'PHONE' | 'EMAIL' | 'BUSINESS';
type Line = { icon: IconName; t: string };
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

const ROW_ART: Record<RowId, { icon: IconName; bg: string; fg: string }> = {
  VIPPS: { icon: 'shield', bg: colors.vippsIdBg, fg: colors.vippsIdFg },
  PHONE: { icon: 'phone', bg: colors.cyanTint, fg: colors.cyanDeep },
  EMAIL: { icon: 'mail', bg: colors.limeTint, fg: colors.limeDeep },
  BUSINESS: { icon: 'building', bg: colors.line2, fg: colors.ink2 },
};

/** "+47 934 56 789" → "+47 9•• •• 789" */
function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '').replace(/^47(?=\d{8}$)/, '');
  return d.length < 4 ? phone : `+47 ${d[0]}•• •• ${d.slice(-3)}`;
}

/** Vurderinger og verifisering (design/screens/Verifisering.dc.html). */
export function VerifiseringssenterScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const { data: profile, isLoading, isError, refetch } = useProfile(me.id);
  const { data: reviews } = useReviews(me.id);
  const verify = useVerify();
  const { contacts } = useTrustedContacts();
  const [open, setOpen] = useState<RowId | null>('VIPPS');

  if (!profile) {
    return (
      <FallbackScreen
        status={isError ? 'error' : isLoading ? 'loading' : 'empty'}
        onRetry={() => refetch()}
        title={nb.verificationCenter.title}
      />
    );
  }

  const v = (k: 'PHONE' | 'EMAIL' | 'BUSINESS') => profile.verifications.find((x) => x.kind === k);
  const isOk = (k: RowId) => k === 'VIPPS' || !!v(k)?.verified;
  const dateLine = (k: 'PHONE' | 'EMAIL' | 'BUSINESS'): Line[] => {
    const at = v(k)?.verifiedAt;
    return at ? [{ icon: 'cal', t: nb.verificationCenter.lines.confirmedOn(longDate(at)) }] : [];
  };
  const L = nb.verificationCenter.lines;
  const rows: { id: RowId; sub: string; lines: Line[] }[] = [
    {
      id: 'VIPPS',
      sub: [profile.displayName, me.isYouth ? null : nb.verificationCenter.over18].filter(Boolean).join(' · '),
      lines: [
        { icon: 'check', t: L.vippsName(profile.displayName) },
        ...(me.isYouth ? [] : [{ icon: 'check' as IconName, t: L.vippsAge }]),
        { icon: 'lock', t: L.vippsPrivate },
      ],
    },
    {
      id: 'PHONE',
      sub: profile.phone ? maskPhone(profile.phone) : nb.verificationCenter.fromVippsProfile,
      lines: [{ icon: 'check', t: L.phoneFrom }, { icon: 'lock', t: L.phonePrivate }, ...dateLine('PHONE')],
    },
    {
      id: 'EMAIL',
      sub: nb.verificationCenter.fromVippsProfile,
      lines: [{ icon: 'check', t: L.emailFrom }, { icon: 'lock', t: L.emailPrivate }, ...dateLine('EMAIL')],
    },
    {
      id: 'BUSINESS',
      sub: isOk('BUSINESS') ? (v('BUSINESS')?.explanation ?? '') : nb.verificationCenter.notRegistered,
      lines: [{ icon: 'info', t: L.bizWho }, { icon: 'info', t: L.bizCheck }, ...dateLine('BUSINESS')],
    },
  ];
  const levels: RowId[] = ['VIPPS', 'PHONE', 'EMAIL'];
  const doneLevels = levels.filter(isOk);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const doVerify = (k: 'PHONE' | 'EMAIL') =>
    verify.mutate(k, {
      onSuccess: () => {
        haptics.success();
        toast.success(nb.verificationCenter.verifiedToast);
      },
      onError: () => toast.error(nb.toast.genericError),
    });

  return (
    <Screen scroll spacer="none" header={<SubHeader title={nb.verificationCenter.title} onBack={back} />}>
      {/* trust header */}
      <FadeUp style={[styles.px, styles.pt6]}>
        <View style={styles.trust}>
          <View style={styles.glow} />
          <View style={styles.trustTop}>
            <Pulse />
            <View style={styles.flex}>
              <Text style={[text.eyebrow, styles.onInk60]}>{profile.displayName}</Text>
              <Text style={[text.h2, styles.white, styles.mt6]} accessibilityRole="header">
                {nb.verificationCenter.youAre}
              </Text>
              <Text style={styles.trustSub}>{doneLevels.length === levels.length ? nb.verificationCenter.fully : nb.verificationCenter.partly}</Text>
            </View>
          </View>
          <View
            style={styles.lvl}
            accessible
            accessibilityLabel={nb.verificationCenter.levelAria(doneLevels.map((k) => nb.verificationCenter.levels[k as 'VIPPS']).join(', '))}
          >
            {levels.map((k, i) => (
              <GrowBar key={k} fill={isOk(k) ? 1 : 0} color={colors.lime} trackColor={colors.onInk16b} delay={i * 150} style={styles.flex} />
            ))}
          </View>
          <View style={styles.lvlLabels}>
            {levels.map((k) => (
              <Text key={k} style={styles.lvlLabel}>
                {nb.verificationCenter.levels[k as 'VIPPS']}
              </Text>
            ))}
          </View>
        </View>
      </FadeUp>

      <SectionHeader
        title={nb.verificationCenter.verifsTitle}
        subtitle={nb.verificationCenter.verifsSub}
        icon="verified"
        iconBg={colors.cyanTint}
        iconColor={colors.cyanDeep}
      />
      <View style={[styles.px, styles.stack10]}>
        {rows.map((r, i) => {
          const art = ROW_ART[r.id];
          const ok = isOk(r.id);
          const expanded = open === r.id;
          const pill =
            r.id === 'BUSINESS' && !ok
              ? { label: nb.verificationCenter.notRelevant, tone: 'neutral' as const }
              : ok
                ? { label: nb.verificationCenter.verified, tone: 'ok' as const }
                : { label: nb.verificationCenter.notVerified, tone: 'warn' as const };
          return (
            <FadeUp key={r.id} delay={i * 40} style={[styles.vrow, shadow.card]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${nb.verificationCenter.rows[r.id]}, ${pill.label}`}
                onPress={() => setOpen(expanded ? null : r.id)}
                style={styles.vhead}
              >
                <View style={[styles.vIcon, { backgroundColor: art.bg }]}>
                  <Icon name={art.icon} size={22} color={art.fg} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.vTitle}>{nb.verificationCenter.rows[r.id]}</Text>
                  {r.sub ? <Text style={styles.vSub}>{r.sub}</Text> : null}
                </View>
                <Pill label={pill.label} tone={pill.tone} />
                <Chevron up={expanded} />
              </Pressable>
              {expanded ? (
                <FadeUp style={styles.vbody}>
                  <Text style={[text.eyebrow, styles.f11]}>{nb.verificationCenter.whatChecked}</Text>
                  {r.lines.map((l) => (
                    <View key={l.t} style={styles.li}>
                      <Icon name={l.icon} size={16} color={l.icon === 'check' ? colors.ink : colors.mute} />
                      <Text style={styles.liText}>{l.t}</Text>
                    </View>
                  ))}
                  {r.id === 'BUSINESS' && !ok ? (
                    <Button
                      label={nb.verificationCenter.registerBusiness}
                      variant="ghost"
                      size="sm"
                      icon="building"
                      block={false}
                      onPress={() => safePush('/bedrift')}
                      style={styles.bodyBtn}
                    />
                  ) : null}
                  {(r.id === 'PHONE' || r.id === 'EMAIL') && !ok ? (
                    <Button
                      label={nb.verificationCenter.verifyNow}
                      variant="ink"
                      size="sm"
                      block={false}
                      loading={verify.isPending && verify.variables === r.id}
                      onPress={() => doVerify(r.id as 'PHONE' | 'EMAIL')}
                      style={styles.bodyBtn}
                    />
                  ) : null}
                </FadeUp>
              ) : null}
            </FadeUp>
          );
        })}
      </View>

      <Ratings profile={profile} reviews={reviews ?? []} />

      <SectionHeader title={nb.verificationCenter.howTitle} icon="info" iconBg={colors.limeTint} iconColor={colors.limeDeep} />
      <FadeUp style={styles.px}>
        <View style={[styles.card, styles.howCard, shadow.card]}>
          {(
            [
              ['hand', nb.verificationCenter.how.parties],
              ['checks', nb.verificationCenter.how.once],
              ['eye', nb.verificationCenter.how.blind],
              ['reply', nb.verificationCenter.how.reply],
            ] as [IconName, string][]
          ).map(([icon, t]) => (
            <View key={t} style={styles.how}>
              <View style={styles.howIcon}>
                <Icon name={icon} size={16} color={colors.ink} />
              </View>
              <Text style={styles.howText}>{t}</Text>
            </View>
          ))}
          <View style={[styles.how, styles.howLast]}>
            <View style={styles.howIcon}>
              <Icon name="flag" size={16} color={colors.ink} />
            </View>
            <Text style={styles.howText}>
              {nb.verificationCenter.how.reportPre}
              <Text style={styles.link} accessibilityRole="link" onPress={() => safePush('/rapporter')}>
                {nb.verificationCenter.how.reportLink}
              </Text>
              .
            </Text>
          </View>
        </View>
      </FadeUp>

      <Tips profile={profile} hasContacts={contacts.length > 0} />
      <View style={styles.bottom} />
    </Screen>
  );
}

function Ratings({ profile, reviews }: { profile: PublicProfile; reviews: Review[] }) {
  const listings = useListingsByIds(Array.from(new Set(reviews.map((r) => r.listingId))));
  const total = reviews.length;
  const avg = profile.rating?.average ?? (total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0);
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => Math.round(r.rating) === s).length }));
  const byRole = (role: 'helper' | 'client') =>
    reviews.filter((r) => {
      const l = listings[r.listingId];
      if (!l) return false;
      const client = l.owner.id === profile.id;
      return role === 'client' ? client : !client;
    });
  const helper = byRole('helper');
  const client = byRole('client');
  const mean = (rs: Review[]) => (rs.length ? (rs.reduce((s, r) => s + r.rating, 0) / rs.length).toFixed(1).replace('.', ',') : '–');
  const completed = profile.completedTasks ?? 0;

  return (
    <>
      <SectionHeader
        title={nb.verificationCenter.ratingsTitle}
        subtitle={nb.verificationCenter.ratingsSub(completed)}
        icon="star"
        iconBg={colors.warnTint}
        iconColor={colors.warn}
      />
      <FadeUp style={styles.px}>
        <View style={[styles.card, styles.pad, shadow.card]}>
          {total ? (
            <>
              <View style={styles.sumRow}>
                <View style={styles.avgCol}>
                  <Text style={styles.avg}>{avg.toFixed(1).replace('.', ',')}</Text>
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Icon key={i} name="star" size={14} color={i <= Math.round(avg) ? colors.star : colors.starOff} filled />
                    ))}
                  </View>
                  <Text style={[text.meta, styles.f12]}>{nb.verificationCenter.reviewsCount(total)}</Text>
                </View>
                <View style={styles.distCol}>
                  {dist.map((d) => (
                    <View key={d.s} style={styles.distRow}>
                      <Text style={[styles.distNum, styles.w10]}>{d.s}</Text>
                      <GrowBar fill={d.n / total} color={colors.star} height={7} style={styles.flex} />
                      <Text style={[styles.distNum, styles.w16]}>{d.n}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.split}>
                <View style={styles.splitBox}>
                  <Text style={styles.splitNum}>{mean(helper)}</Text>
                  <Text style={[text.meta, styles.f12, styles.mt3]}>{nb.verificationCenter.asHelper(helper.length)}</Text>
                </View>
                <View style={styles.splitBox}>
                  <Text style={styles.splitNum}>{mean(client)}</Text>
                  <Text style={[text.meta, styles.f12, styles.mt3]}>{nb.verificationCenter.asClient(client.length)}</Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={text.meta}>{nb.verificationCenter.noRatings}</Text>
          )}
          <TextLink label={nb.verificationCenter.seeAll} onPress={() => safePush('/profil')} style={styles.mt6} />
        </View>
      </FadeUp>
    </>
  );
}

function Tips({ profile, hasContacts }: { profile: PublicProfile; hasContacts: boolean }) {
  const T = nb.verificationCenter.tips;
  const portN = profile.portfolio?.length ?? 0;
  const tips: { id: string; label: string; sub: string; done: boolean; href: string }[] = [
    { id: 'photo', label: T.photo.label, sub: T.photo.sub, done: !!profile.avatarUrl, href: '/profil/rediger' },
    { id: 'bio', label: T.bio.label, sub: T.bio.sub, done: !!profile.presentation?.trim(), href: '/profil/rediger' },
    { id: 'cats', label: T.cats.label, sub: T.cats.sub, done: (profile.categorySlugs?.length ?? 0) > 0, href: '/profil/rediger' },
    { id: 'port', label: T.port.label, sub: T.port.sub(portN), done: portN > 0, href: '/profil/rediger' },
    { id: 'notes', label: T.notes.label, sub: T.notes.sub, done: !!profile.homeNotes?.trim(), href: '/profil/rediger' },
    { id: 'contacts', label: T.contacts.label, sub: T.contacts.sub, done: hasContacts, href: '/trygge-kontakter' },
  ];
  const done = tips.filter((t) => t.done).length;
  const pct = Math.round((done / tips.length) * 100);

  return (
    <>
      <SectionHeader
        title={nb.verificationCenter.tipsTitle}
        subtitle={nb.verificationCenter.tipsSub}
        icon="sparkle"
        iconBg={categoryColors.maling.bg}
        iconColor={categoryColors.maling.fg}
      />
      <FadeUp style={styles.px}>
        <View style={[styles.card, styles.pad, shadow.card]}>
          <View style={styles.tipTop}>
            <Ring pct={pct} />
            <View style={styles.flex}>
              <Text style={styles.tipDone}>{nb.verificationCenter.tipsDone(done, tips.length)}</Text>
              <Text style={[text.meta, styles.mt4]}>{done === tips.length ? nb.verificationCenter.tipsHintAll : nb.verificationCenter.tipsHint}</Text>
            </View>
          </View>
          <View style={styles.tipList}>
            {tips.map((t) => (
              <PressableScale
                key={t.id}
                accessibilityRole="button"
                accessibilityState={{ checked: t.done }}
                accessibilityLabel={t.label}
                onPress={() => safePush(t.href)}
                disabled={t.done}
                style={[styles.tip, !t.done && styles.tipTodo]}
              >
                <View pointerEvents="none">
                  <Checkbox checked={t.done} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.tipLabel, t.done && styles.tipLabelDone]}>{t.label}</Text>
                  <Text style={[text.meta, styles.f12, styles.mt2]}>{t.sub}</Text>
                </View>
                {!t.done ? <Icon name="right" size={18} color={colors.faint} /> : null}
              </PressableScale>
            ))}
          </View>
          <View style={styles.tipBtns}>
            <Button label={nb.verificationCenter.editProfile} variant="ink" size="sm" onPress={() => safePush('/profil/rediger')} style={styles.flex} />
            <Button label={nb.verificationCenter.trustedContacts} variant="ghost" size="sm" onPress={() => safePush('/trygge-kontakter')} style={styles.flex} />
          </View>
        </View>
      </FadeUp>
    </>
  );
}

function Ring({ pct }: { pct: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? pct / 100 : 0);
  useEffect(() => {
    p.set(reduced ? pct / 100 : withTiming(pct / 100, { duration: 1000, easing: Easing.bezier(...motion.ease) }));
  }, [pct, reduced, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: RING_C * (1 - p.value) }));
  return (
    <View style={styles.ring} accessible accessibilityLabel={`${pct} %`}>
      <Svg width={72} height={72} viewBox="0 0 72 72" style={styles.ringSvg}>
        <Circle cx={36} cy={36} r={RING_R} fill="none" stroke={colors.line2} strokeWidth={8} />
        <AnimatedCircle
          cx={36}
          cy={36}
          r={RING_R}
          fill="none"
          stroke={colors.toggleOn}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={RING_C}
          animatedProps={props}
        />
      </Svg>
      <Text style={styles.ringNum}>{`${pct} %`}</Text>
    </View>
  );
}

function Chevron({ up }: { up: boolean }) {
  const r = useSharedValue(up ? 180 : 0);
  useEffect(() => {
    r.set(withTiming(up ? 180 : 0, { duration: 300, easing: Easing.bezier(...motion.ease) }));
  }, [up, r]);
  const s = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={s}>
      <Icon name="down" size={18} color={colors.faint} />
    </Animated.View>
  );
}

/** `.pulse` ring behind the shield. */
function Pulse() {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!reduced) s.set(withRepeat(withTiming(1.15, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduced, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <View style={styles.shieldWrap}>
      <Animated.View style={[styles.pulse, anim]} />
      <View style={styles.shield}>
        <Icon name="shield" size={28} color={colors.ink} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  pt6: { paddingTop: 6 },
  mt2: { marginTop: 2 },
  mt3: { marginTop: 3 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  f11: { fontSize: 11 },
  f12: { fontSize: 12 },
  white: { color: colors.white },
  onInk60: { color: colors.onInk62 },
  bottom: { height: 60 },
  stack10: { gap: 10 },
  trust: { overflow: 'hidden', borderRadius: 30, backgroundColor: colors.ink, paddingTop: 22, paddingHorizontal: 20, paddingBottom: 20 },
  glow: { position: 'absolute', right: -60, top: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.lime, opacity: 0.38 },
  trustTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  trustSub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18, color: colors.onInk78 },
  shieldWrap: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 33, backgroundColor: colors.halo },
  shield: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  lvl: { flexDirection: 'row', gap: 6, marginTop: 16 },
  lvlLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  lvlLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.onInk55 },
  vrow: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' },
  vhead: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingRight: 14, paddingLeft: 16, minHeight: 68 },
  vIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  vTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5, lineHeight: 19, color: colors.ink },
  vSub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 16, color: colors.mute, marginTop: 3 },
  vbody: { paddingRight: 16, paddingBottom: 16, paddingLeft: 74, gap: 8 },
  li: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  liText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19.6, color: colors.ink2 },
  bodyBtn: { alignSelf: 'flex-start', marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card },
  pad: { padding: 18 },
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  avgCol: { width: 92, alignItems: 'center', gap: 4 },
  avg: { fontFamily: fonts.display, fontSize: 46, lineHeight: 46, letterSpacing: -0.92, color: colors.ink },
  stars: { flexDirection: 'row', gap: 1 },
  distCol: { flex: 1, gap: 7 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distNum: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.mute },
  w10: { width: 10 },
  w16: { width: 16, textAlign: 'right' },
  split: { flexDirection: 'row', gap: 8, marginTop: 16 },
  splitBox: { flex: 1, padding: 12, borderRadius: radius.m, backgroundColor: colors.surface2 },
  splitNum: { fontFamily: fonts.display, fontSize: 18, lineHeight: 20, color: colors.ink },
  howCard: { paddingVertical: 6, paddingHorizontal: 18 },
  how: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line2 },
  howLast: { borderBottomWidth: 0 },
  howIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  howText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20.3, color: colors.ink, paddingTop: 6 },
  link: { fontFamily: fonts.bodyBold, color: colors.cyanDeep, textDecorationLine: 'underline' },
  tipTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tipDone: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 20, color: colors.ink },
  ring: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  ringSvg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  ringNum: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  tipList: { gap: 6, marginTop: 16 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 56, borderRadius: radius.m },
  tipTodo: { backgroundColor: colors.surface2 },
  tipLabel: { fontFamily: fonts.bodySemi, fontSize: 14.5, lineHeight: 19, color: colors.ink },
  tipLabelDone: { color: colors.mute, textDecorationLine: 'line-through', textDecorationColor: colors.strike },
  tipBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
