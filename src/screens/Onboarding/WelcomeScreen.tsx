import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { ReviewerLogin } from '@/components/ReviewerLogin';
import { colors, motion, radius, shadow, text } from '@/theme/theme';
import { Avatar } from '@/components/ui/Avatar';
import { Stars } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CategoryArt } from '@/components/ui/CategoryArt';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';

const logo = require('../../../assets/logo-icon.png');

const SLIDE_MS = 4200;
const COLLAGE_H = 380;
const ease = Easing.bezier(...motion.ease);

/** `.au` – fade up 16 px, 550 ms, staggered by `.dN` (50 ms steps; d9 = 500, d10 = 600). */
const fadeUp = (delay: number) =>
  FadeInDown.duration(motion.durations.fadeUp).delay(delay).easing(ease).withInitialValues({
    opacity: 0,
    transform: [{ translateY: motion.fadeUpDistance }],
  });

/** `.float` / `.float2` – drift up 9 px and back, forever. */
function Float({ period, delay = 0, children }: { period: number; delay?: number; children: ReactNode }) {
  const y = useSharedValue(0);
  useEffect(() => {
    const half = { duration: period / 2, easing: Easing.inOut(Easing.ease) };
    y.set(withDelay(delay, withRepeat(withSequence(withTiming(-9, half), withTiming(0, half)), -1)));
    return () => cancelAnimation(y);
  }, [period, delay, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}

/** `.dots` – active dot stretches to 24 px (350 ms). */
function Dot({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const w = useSharedValue(active ? 24 : 7);
  useEffect(() => {
    w.set(withTiming(active ? 24 : 7, { duration: 350, easing: ease }));
  }, [active, w]);
  const anim = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 18, bottom: 18, left: 4, right: 4 }}
      onPress={onPress}
    >
      <Animated.View style={[styles.dot, { backgroundColor: active ? colors.ink : colors.dashed }, anim]} />
    </Pressable>
  );
}

/** Onboarding · Velkommen (design/screens/Main.dc.html). */
export function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [slide, setSlide] = useState(0);
  const [bottomH, setBottomH] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setSlide((s) => (s + 1) % nb.welcome.slides.length), SLIDE_MS);
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [startTimer]);

  const go = (i: number) => {
    setSlide(i);
    startTimer();
  };

  // Collage sits 74 px under the status bar (120 in the 844 px frame). On short
  // screens it shrinks so it never runs into the copy block.
  const collageTop = insets.top + 74;
  const room = bottomH ? height - bottomH - collageTop - 8 : COLLAGE_H;
  const scale = Math.max(0.6, Math.min(1, room / COLLAGE_H));
  const s = nb.welcome.slides[slide];

  return (
    <View style={styles.phone}>
      <View style={[styles.blob, styles.blobLime]} />
      <View style={[styles.blob, styles.blobCyan]} />

      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <ReviewerLogin>
          <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="MinNabo">
            <Image source={logo} style={styles.brandLogo} testID="welcome-brand" />
            <Text style={text.brand}>MinNabo</Text>
          </View>
        </ReviewerLogin>
      </View>

      <View
        style={[
          styles.collage,
          { top: collageTop, transform: [{ translateY: (-COLLAGE_H * (1 - scale)) / 2 }, { scale }] },
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View
          entering={ZoomIn.delay(100).springify().damping(motion.spring.damping).stiffness(motion.spring.stiffness)}
          style={[styles.logoTile, shadow.logoTile]}
        >
          {/* hold the logo (the whole tile): the app stores' reviewer login (components/ReviewerLogin.tsx) */}
          <ReviewerLogin style={styles.logoHold}>
            <Float period={5000}>
              <Image source={logo} style={styles.logoBig} accessibilityLabel="MinNabo" testID="welcome-logo" />
            </Float>
          </ReviewerLogin>
        </Animated.View>

        <Animated.View entering={fadeUp(200)} style={styles.needCard}>
          <Float period={6000} delay={1000}>
            <Card style={[styles.cardRow, styles.rotNeg5]}>
              <CategoryArt category="hage" width={52} height={52} radius={14} iconSize={22} />
              <View style={styles.cardText}>
                <Pill label={nb.welcome.cardNeed} tone="need" dot size="sm" />
                <Text style={[text.cardTitle, styles.cardTitle]}>{nb.welcome.cardTitle}</Text>
                <Text style={[text.num, styles.cardPrice]}>{nb.welcome.cardPrice}</Text>
              </View>
            </Card>
          </Float>
        </Animated.View>

        <Animated.View entering={fadeUp(250)} style={styles.offerCard}>
          <Card style={[styles.offerRow, styles.rot4]}>
            <Avatar initials="JL" colorKey="b" size={32} online />
            <View style={styles.offerText}>
              <Text style={[text.metaBold, styles.offerTitle]}>{nb.welcome.offerFrom}</Text>
              <Stars rating={4.9} count={32} />
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={fadeUp(300)} style={styles.chat}>
          <View style={[styles.bubble, shadow.medium, styles.rotNeg3]}>
            <Text style={styles.bubbleText}>{nb.welcome.chat}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={fadeUp(350)} style={styles.accepted}>
          <Float period={5000}>
            <View style={[styles.acceptedPill, shadow.card, styles.rot3]}>
              <View style={styles.okCircle}>
                <Icon name="check" size={14} color={colors.white} />
              </View>
              <Text style={[text.pillLg, { color: colors.okText }]}>{nb.welcome.accepted}</Text>
            </View>
          </Float>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(500).delay(400)} style={[styles.spark, styles.sparkLime]} />
        <Animated.View entering={FadeIn.duration(500).delay(500)} style={styles.sparkCyanPos}>
          <View style={[styles.sparkDot, styles.sparkCyan]} />
        </Animated.View>
        <Animated.View entering={FadeIn.duration(500).delay(500)} style={[styles.spark, styles.sparkBlue]} />
      </View>

      <View
        style={[styles.bottom, { paddingBottom: Math.max(38, insets.bottom + 16) }]}
        onLayout={(e) => setBottomH(e.nativeEvent.layout.height)}
      >
        <View style={styles.dots} accessibilityRole="tablist">
          {nb.welcome.slides.map((_, i) => (
            <Dot key={i} active={i === slide} label={nb.welcome.showSlide(i + 1)} onPress={() => go(i)} />
          ))}
        </View>

        {/* Keyed by slide so the copy animates in again on every change. */}
        <View style={styles.copy} key={slide} accessibilityLiveRegion="polite">
          <Animated.Text entering={fadeUp(0)} style={text.display42} accessibilityRole="header">
            {s.title}
          </Animated.Text>
          <Animated.Text entering={fadeUp(100)} style={styles.body}>
            {s.body}
          </Animated.Text>
        </View>

        <View style={styles.actions}>
          <Button label={nb.welcome.start} size="lg" iconRight="arrow" onPress={() => router.push('/logg-inn')} />
          <Text style={[text.meta, styles.center]}>{nb.welcome.region}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  phone: { flex: 1, backgroundColor: colors.white, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  blobLime: { left: -90, top: -110, width: 300, height: 300, backgroundColor: colors.limeTint },
  blobCyan: { right: -120, top: 250, width: 280, height: 280, backgroundColor: colors.welcomeBlob },
  topbar: { alignItems: 'center', paddingBottom: 10, zIndex: 5 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandLogo: { width: 34, height: 34 },
  collage: { position: 'absolute', left: 0, right: 0, height: COLLAGE_H },
  logoTile: {
    position: 'absolute',
    left: '50%',
    top: 118,
    marginLeft: -64,
    width: 128,
    height: 128,
    borderRadius: 38,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoHold: { alignSelf: 'stretch', flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoBig: { width: 96, height: 96 },
  needCard: { position: 'absolute', left: 18, top: 8, width: 214 },
  cardRow: { padding: 10, flexDirection: 'row', gap: 10, alignItems: 'center' },
  cardText: { gap: 5, minWidth: 0, flexShrink: 1 },
  cardTitle: { fontSize: 13.5, lineHeight: 17 },
  cardPrice: { fontSize: 14, lineHeight: 15 },
  offerCard: { position: 'absolute', right: 16, top: 36 },
  offerRow: { paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
  offerText: { gap: 3 },
  offerTitle: { lineHeight: 16 },
  chat: { position: 'absolute', right: 22, top: 262 },
  bubble: {
    backgroundColor: colors.ink,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: radius.bubble,
    borderTopRightRadius: radius.bubble,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: radius.bubble,
  },
  bubbleText: { ...text.bodySemi, fontSize: 14, lineHeight: 18.2, color: colors.white },
  accepted: { position: 'absolute', left: 30, top: 282 },
  acceptedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  okCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ok,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotNeg5: { transform: [{ rotate: '-5deg' }] },
  rot4: { transform: [{ rotate: '4deg' }] },
  rotNeg3: { transform: [{ rotate: '-3deg' }] },
  rot3: { transform: [{ rotate: '3deg' }] },
  spark: { position: 'absolute', borderRadius: 999 },
  sparkLime: { left: 36, top: 170, width: 10, height: 10, backgroundColor: colors.lime },
  sparkCyanPos: { position: 'absolute', right: 60, top: 190 },
  sparkDot: { borderRadius: 999 },
  sparkCyan: { width: 14, height: 14, backgroundColor: colors.cyan, opacity: 0.5 },
  sparkBlue: { left: 110, top: 110, width: 6, height: 6, backgroundColor: colors.accentBlue },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, gap: 22 },
  dots: { flexDirection: 'row', gap: 6, height: 7 },
  dot: { height: 7, borderRadius: 4 },
  copy: { minHeight: 176, gap: 12 },
  body: { ...text.body, fontSize: 16, lineHeight: 24, color: colors.ink2 },
  actions: { gap: 10 },
  center: { textAlign: 'center' },
});
