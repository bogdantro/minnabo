import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { MOCK_ADULT, MOCK_YOUTH, mockVipps } from '@/auth/mockVipps';
import { toast } from '@/lib/toast';
import { colors, radius, safeTopExtra, screenPadding, shadow, text } from '@/theme/theme';
import {
  Avatar,
  Button,
  DrawnCheck,
  FadeUp,
  Icon,
  IconButton,
  KeyValueRow,
  Note,
  Pill,
  ScaleIn,
  Screen,
  Sheet,
  Spinner,
  VerifiedBadge,
} from '@/components/ui';

const logo = require('../../../assets/logo-icon.png');

type VippsStep = 'opening' | 'confirm' | 'done';

/** Vipps logo mark: white rounded square with an orange ring (`.vmark`). */
function VippsMark({ size = 28, inverted = false }: { size?: number; inverted?: boolean }) {
  const ring = Math.round(size * 0.43);
  return (
    <View
      style={[
        styles.vmark,
        { width: size, height: size, borderRadius: size * 0.32, backgroundColor: inverted ? colors.vipps : colors.white },
      ]}
    >
      <View
        style={{
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: Math.max(2, size * 0.1),
          borderColor: inverted ? colors.white : colors.vipps,
        }}
      />
    </View>
  );
}

/** `.float` – gentle vertical drift. */
function useFloat(period: number) {
  const y = useSharedValue(0);
  useEffect(() => {
    const half = { duration: period / 2, easing: Easing.inOut(Easing.ease) };
    y.set(withRepeat(withSequence(withTiming(-9, half), withTiming(0, half)), -1));
    return () => cancelAnimation(y);
  }, [period, y]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
}

/** Pulsing orange ring behind the phone (`.vring`). */
function Ring({ delay }: { delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }), -1)));
    return () => cancelAnimation(p);
  }, [delay, p]);
  const anim = useAnimatedStyle(() => ({ opacity: 1 - p.value, transform: [{ scale: 0.55 + 1.1 * p.value }] }));
  return <Animated.View style={[styles.vring, anim]} />;
}

/** Phone with the Vipps approve screen; the OK button "taps" itself (`.vok`). */
function VippsPhone() {
  const float = useFloat(5000);
  const tap = useSharedValue(1);
  useEffect(() => {
    tap.set(
      withRepeat(
        withSequence(withTiming(1, { duration: 1080 }), withTiming(0.88, { duration: 180 }), withTiming(1, { duration: 540 })),
        -1,
      ),
    );
    return () => cancelAnimation(tap);
  }, [tap]);
  const tapStyle = useAnimatedStyle(() => ({ transform: [{ scale: tap.value }] }));
  return (
    <View style={styles.phoneStage}>
      <Ring delay={0} />
      <Ring delay={1100} />
      <Animated.View style={float}>
        <View style={[styles.vphone, shadow.phoneMock]}>
          <View style={styles.vscreen}>
            <View style={styles.vbar} />
            <View style={styles.vline} />
            <View style={[styles.vline, styles.vlineShort]} />
            <View style={styles.vline} />
            <Animated.View style={[styles.vok, tapStyle]}>
              <Icon name="check" size={14} color={colors.white} />
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

/** Three bouncing orange dots (`.wdots`). */
function WaitDots() {
  return (
    <View style={styles.wdots}>
      {[0, 150, 300].map((d) => (
        <Dot key={d} delay={d} />
      ))}
    </View>
  );
}
function Dot({ delay }: { delay: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.set(
      withDelay(
        delay,
        withRepeat(withSequence(withTiming(-5, { duration: 360 }), withTiming(0, { duration: 360 }), withTiming(0, { duration: 480 })), -1),
      ),
    );
    return () => cancelAnimation(y);
  }, [delay, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.wdot, anim]} />;
}

/** Three 5 px bars showing the sheet's progress (`.steps`). */
function Steps({ n }: { n: number }) {
  return (
    <View style={styles.steps} accessible accessibilityLabel={`Steg ${n} av 3`}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.step, i <= n && styles.stepOn]} />
      ))}
    </View>
  );
}

/**
 * Onboarding · Logg inn (design/screens/LoggInn.dc.html). Vipps only.
 * The Vipps round-trip is MOCKED (timers + sample identity) until Vipps login
 * is wired; see `src/auth/mockVipps.ts`.
 */
export function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [vipps, setVipps] = useState<VippsStep | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const logoFloat = useFloat(5000);
  const id = MOCK_ADULT;

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);

  const start = () => {
    clear();
    setVipps('opening');
    timers.current.push(setTimeout(() => setVipps('confirm'), 1600));
    timers.current.push(setTimeout(() => setVipps('done'), 3400));
  };

  const cancel = () => {
    clear();
    const was = vipps;
    setVipps(null);
    if (was && was !== 'done') toast.info(nb.login.cancelled, { icon: 'x' });
  };

  const proceed = (youth: boolean) => {
    clear();
    mockVipps.signIn(youth ? MOCK_YOUTH : MOCK_ADULT);
    setVipps(null);
    router.replace(youth ? '/ungdomskonto' : '/samtykker');
  };

  const step = vipps === 'opening' ? 1 : vipps === 'confirm' ? 2 : 3;

  return (
    <Screen white scroll contentStyle={styles.scroll}>
      <View style={[styles.lhead, { paddingTop: insets.top + safeTopExtra }]}>
        <IconButton
          icon="back"
          accessibilityLabel={nb.login.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/velkommen'))}
        />
      </View>

      <View style={styles.start}>
        <ScaleIn delay={50} style={[styles.logobox, shadow.loginLogo]}>
          <Animated.View style={logoFloat}>
            <Image source={logo} style={styles.logo} accessibilityLabel="MinNabo" />
          </Animated.View>
        </ScaleIn>
        <FadeUp delay={100}>
          <Text style={[text.h1, styles.title]} accessibilityRole="header">
            {nb.login.title}
          </Text>
        </FadeUp>
        <FadeUp delay={150}>
          <Text style={[text.body, styles.lead]}>{nb.login.lead}</Text>
        </FadeUp>
        <FadeUp delay={200} style={styles.ctaBlock}>
          <Button label={nb.login.cta} variant="vipps" size="lg" leading={<VippsMark />} onPress={start} />
          <Text style={[text.meta, styles.center]}>{nb.login.onlyVipps}</Text>
        </FadeUp>
        <FadeUp delay={300} style={styles.trust}>
          <View style={styles.trustIcon}>
            <Icon name="shield" size={16} color={colors.ok} />
          </View>
          <Text style={[text.tipBox, styles.trustText]}>{nb.login.neverPayment}</Text>
        </FadeUp>
        <FadeUp delay={350}>
          <Text style={[text.note, styles.legal]}>
            {nb.login.legalPre}
            <Text style={styles.legalLink} accessibilityRole="link" onPress={() => router.push('/vilkar')}>
              {nb.login.legalTerms}
            </Text>
            {nb.login.legalMid}
            <Text style={styles.legalLink} accessibilityRole="link" onPress={() => router.push('/personvern')}>
              {nb.login.legalPrivacy}
            </Text>
            .
          </Text>
        </FadeUp>
      </View>

      <Sheet visible={!!vipps} onClose={cancel} dismissible={vipps !== 'done'}>
        <View style={styles.sheetHead}>
          <Pill label={nb.login.sheetPill} tone="line" leading={<VippsMark size={18} inverted />} style={styles.sheetPill} />
          <Steps n={step} />
        </View>

        {vipps === 'opening' ? (
          <FadeUp key="opening" style={styles.stage}>
            <View style={styles.spinWrap}>
              <Spinner size={72} thickness={4} color={colors.vipps} trackColor={colors.vippsTrack} />
              <View style={styles.spinMark}>
                <View style={styles.spinMarkBg}>
                  <VippsMark size={34} />
                </View>
              </View>
            </View>
            <Text style={[text.h2, styles.stageTitle]} accessibilityLiveRegion="polite">
              {nb.login.opening}
            </Text>
            <Text style={[text.body, styles.stageBody]}>{nb.login.openingBody}</Text>
          </FadeUp>
        ) : null}

        {vipps === 'confirm' ? (
          <FadeUp key="confirm" style={[styles.stage, styles.stageConfirm]}>
            <VippsPhone />
            <Text style={[text.h2, styles.mt8]} accessibilityLiveRegion="polite">
              {nb.login.confirm}
            </Text>
            <Text style={[text.body, styles.stageBody]}>{nb.login.confirmBody}</Text>
            <View style={styles.waiting}>
              <Text style={[text.pillLg, { color: colors.vippsDeep }]}>{nb.login.waiting}</Text>
              <WaitDots />
            </View>
          </FadeUp>
        ) : null}

        {vipps === 'done' ? (
          <View>
            <View style={styles.doneHead}>
              <DrawnCheck size={84} bg={colors.ok} tickColor={colors.white} ring={shadow.okBadge} tickSize={44} />
              <FadeUp delay={150}>
                <Text style={[text.h2, styles.doneTitle]} accessibilityLiveRegion="polite">
                  {nb.login.done}
                </Text>
              </FadeUp>
              <FadeUp delay={200}>
                <Text style={[text.body, styles.doneBody]}>{nb.login.doneBody(id.firstName)}</Text>
              </FadeUp>
            </View>
            <FadeUp delay={250} style={styles.idcard}>
              <View style={styles.idTop}>
                <Avatar initials={id.initials} me size={48} />
                <View style={styles.idName}>
                  <Text style={[text.cardTitle]}>{nb.login.born(id.name, id.birthYear)}</Text>
                  <VerifiedBadge label={nb.login.confirmedVipps} />
                </View>
              </View>
              <KeyValueRow label={nb.login.phone} value={id.phoneMasked} />
              <KeyValueRow label={nb.login.age} value={nb.login.over18} last />
            </FadeUp>
            <FadeUp delay={300}>
              <Note style={styles.mt12}>{nb.login.fetchNote}</Note>
            </FadeUp>
            <FadeUp delay={350} style={styles.mt18}>
              <Button label={nb.login.continue} size="lg" iconRight="arrow" onPress={() => proceed(false)} />
            </FadeUp>
            <Button label={nb.login.under18} variant="text" onPress={() => proceed(true)} style={styles.under18} />
            <Pressable accessibilityRole="button" onPress={cancel} style={styles.notYou}>
              <Text style={[text.bodySemi, styles.notYouText]}>{nb.login.notYou}</Text>
            </Pressable>
          </View>
        ) : null}

        {vipps === 'opening' || vipps === 'confirm' ? (
          <>
            <Button label={nb.login.cancel} variant="ghost" onPress={cancel} style={styles.mt20} />
            <Note icon="lock" style={styles.pendingNote}>
              {nb.login.neverPayment}
            </Note>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  center: { textAlign: 'center' },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt18: { marginTop: 18 },
  mt20: { marginTop: 20 },
  lhead: { flexDirection: 'row', paddingHorizontal: 16 },
  start: { alignItems: 'center', paddingHorizontal: screenPadding, paddingTop: 6, paddingBottom: 36 },
  logobox: {
    width: 104,
    height: 104,
    borderRadius: 32,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 78, height: 78 },
  title: { marginTop: 24, fontSize: 32, lineHeight: 34, letterSpacing: -0.96, textAlign: 'center' },
  lead: { marginTop: 12, color: colors.ink2, maxWidth: 320, textAlign: 'center' },
  ctaBlock: { alignSelf: 'stretch', marginTop: 30, gap: 14 },
  vmark: { alignItems: 'center', justifyContent: 'center' },
  trust: {
    alignSelf: 'stretch',
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.locButtonBg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  trustIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.okTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustText: { flex: 1, color: colors.ink2, lineHeight: 18 },
  legal: { marginTop: 22, maxWidth: 310, textAlign: 'center', lineHeight: 18.75 },
  legalLink: { fontFamily: text.label.fontFamily, color: colors.ink, textDecorationLine: 'underline' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sheetPill: { gap: 8 },
  steps: { flexDirection: 'row', gap: 5, width: 90 },
  step: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.progressTrack },
  stepOn: { backgroundColor: colors.ink },
  stage: { alignItems: 'center', paddingTop: 30, paddingHorizontal: 6, paddingBottom: 8 },
  stageConfirm: { paddingTop: 18 },
  spinWrap: { width: 72, height: 72 },
  spinMark: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  spinMarkBg: { borderRadius: 11, backgroundColor: colors.vippsTint },
  stageTitle: { marginTop: 22, textAlign: 'center' },
  stageBody: { marginTop: 8, maxWidth: 290, color: colors.mute, textAlign: 'center' },
  phoneStage: { width: 170, height: 170, alignItems: 'center', justifyContent: 'center' },
  vring: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.vippsRing,
  },
  vphone: { width: 74, height: 130, borderRadius: 18, backgroundColor: colors.ink, padding: 6 },
  vscreen: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  vbar: { alignSelf: 'stretch', height: 20, borderRadius: 7, backgroundColor: colors.vipps },
  vline: { width: '84%', height: 5, borderRadius: 3, backgroundColor: colors.line },
  vlineShort: { width: '56%' },
  vok: {
    marginTop: 'auto',
    alignSelf: 'stretch',
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.vipps,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waiting: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.vippsTint,
  },
  wdots: { flexDirection: 'row', gap: 4, marginLeft: 6 },
  wdot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.vipps },
  doneHead: { alignItems: 'center', paddingTop: 22, paddingBottom: 4 },
  doneTitle: { marginTop: 22, textAlign: 'center' },
  doneBody: { marginTop: 6, color: colors.mute, textAlign: 'center' },
  idcard: {
    marginTop: 14,
    borderRadius: radius.card,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line2,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  idTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line2,
  },
  idName: { flex: 1, gap: 3 },
  under18: { marginTop: 0 },
  notYou: { marginTop: 4, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  notYouText: { color: colors.mute },
  pendingNote: { justifyContent: 'center', marginTop: 12 },
});
