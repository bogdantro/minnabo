import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from '@/components/ui/Image';
import nb from '@/i18n/nb';
import { haptics } from '@/lib/haptics';
import { colors, motion, radius, text } from '@/theme/theme';
import { Icon, IconButton } from './ui';

const THUMB = 58;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
/** Dragged further down than this, the photo closes. */
const CLOSE_AT = 140;

/**
 * Photos in fullscreen. Pinch or double-tap to zoom, drag a zoomed photo around, swipe sideways
 * between photos, swipe down to close. A caption card and a strip of small pictures at the bottom;
 * a tap on the photo hides and shows them. Pass one `uri`, or `images` and the `index` to start on.
 */
export function ImageViewer({
  uri,
  images,
  index = 0,
  caption,
  subtitle,
  onClose,
}: {
  uri?: string | null;
  images?: string[];
  index?: number;
  caption?: string;
  /** a second line under the caption, e.g. the place */
  subtitle?: string;
  onClose: () => void;
}) {
  const list = images ?? (uri ? [uri] : []);
  return (
    <Modal visible={list.length > 0} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar style="light" />
      {/* a Modal is outside the app's root view, so gestures need their own root here */}
      <GestureHandlerRootView style={styles.flex}>
        {list.length ? <Viewer key={index} list={list} start={Math.min(index, list.length - 1)} caption={caption} subtitle={subtitle} onClose={onClose} /> : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

function Viewer({ list, start, caption, subtitle, onClose }: { list: string[]; start: number; caption?: string; subtitle?: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const ref = useRef<FlatList<string>>(null);
  const [i, setI] = useState(start);
  const [chrome, setChrome] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  // how far the photo is dragged down: the background and the bars fade with it
  const drag = useSharedValue(0);
  const n = list.length;

  const go = (to: number) => {
    const next = Math.max(0, Math.min(n - 1, to));
    ref.current?.scrollToIndex({ index: next, animated: true });
    setI(next);
    haptics.light();
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setI(Math.round(e.nativeEvent.contentOffset.x / width));
  const toggleChrome = useCallback(() => setChrome((c) => !c), []);

  const bars = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(drag.get()), [0, 60], [1, 0], 'clamp') }));

  return (
    <Animated.View entering={FadeIn.duration(180)} style={[styles.flex, styles.bg]}>
      <FlatList
        ref={ref}
        data={list}
        keyExtractor={(u, k) => `${k}-${u}`}
        horizontal
        pagingEnabled
        scrollEnabled={n > 1 && !zoomed}
        initialScrollIndex={start}
        getItemLayout={(_, k) => ({ length: width, offset: width * k, index: k })}
        showsHorizontalScrollIndicator={false}
        // a listing has a handful of photos: draw them all, so jumping with an arrow or a thumbnail
        // never lands on a page the list hasn't drawn yet (it showed an empty dark screen)
        initialNumToRender={n}
        windowSize={n * 2 + 1}
        removeClippedSubviews={false}
        onMomentumScrollEnd={onEnd}
        onScroll={onEnd}
        scrollEventThrottle={64}
        renderItem={({ item, index: k }) => (
          <Page uri={item} width={width} height={height} first={k === start} drag={drag} onTap={toggleChrome} onZoom={setZoomed} onClose={onClose} />
        )}
      />

      {chrome ? (
        <Animated.View entering={FadeInDown.duration(220)} style={[styles.top, { paddingTop: insets.top + 8 }, bars]} pointerEvents="box-none">
          <IconButton icon="x" variant="glass" accessibilityLabel={nb.chat.imageClose} onPress={onClose} />
          {n > 1 ? (
            <View style={styles.counter} accessibilityLiveRegion="polite">
              <Text style={styles.counterText}>{nb.detail.imageN(i + 1, n)}</Text>
            </View>
          ) : null}
          <View style={styles.side} />
        </Animated.View>
      ) : null}

      {chrome && n > 1 ? (
        <>
          {i > 0 ? (
            <Animated.View style={[styles.arrow, styles.arrowLeft, bars]}>
              <IconButton icon="left" variant="glass" accessibilityLabel={nb.detail.prevImage} onPress={() => go(i - 1)} />
            </Animated.View>
          ) : null}
          {i < n - 1 ? (
            <Animated.View style={[styles.arrow, styles.arrowRight, bars]}>
              <IconButton icon="right" variant="glass" accessibilityLabel={nb.detail.nextImage} onPress={() => go(i + 1)} />
            </Animated.View>
          ) : null}
        </>
      ) : null}

      {chrome && (caption || n > 1) ? (
        <Animated.View entering={FadeInDown.delay(60).duration(240)} style={[styles.bottom, { paddingBottom: insets.bottom + 14 }, bars]} pointerEvents="box-none">
          {caption ? (
            <View style={styles.caption}>
              <Text style={styles.captionTitle} numberOfLines={2}>
                {caption}
              </Text>
              {subtitle ? (
                <View style={styles.captionRow}>
                  <Icon name="pin" size={13} color={colors.lime} />
                  <Text style={styles.captionSub} numberOfLines={1}>
                    {subtitle}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {n > 1 ? (
            <FlatList
              data={list}
              horizontal
              keyExtractor={(u, k) => `t${k}-${u}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
              renderItem={({ item, index: k }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: k === i }}
                  accessibilityLabel={nb.detail.imageN(k + 1, n)}
                  onPress={() => go(k)}
                  style={[styles.thumb, k === i && styles.thumbOn]}
                >
                  <Image source={{ uri: item }} style={styles.thumbImg} resizeMode="cover" accessibilityIgnoresInvertColors />
                </Pressable>
              )}
            />
          ) : null}
          <Text style={styles.hint}>{nb.detail.viewerHint}</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** One photo: pinch, double-tap, drag when zoomed, and swipe down to close when not. */
function Page({
  uri,
  width,
  height,
  first,
  drag,
  onTap,
  onZoom,
  onClose,
}: {
  uri: string;
  width: number;
  height: number;
  first: boolean;
  drag: SharedValue<number>;
  onTap: () => void;
  onZoom: (zoomed: boolean) => void;
  onClose: () => void;
}) {
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // never let a zoomed photo slide further than its own edges
  const clampX = (v: number, s: number) => {
    'worklet';
    const max = ((s - 1) * width) / 2;
    return Math.min(max, Math.max(-max, v));
  };
  const clampY = (v: number, s: number) => {
    'worklet';
    const max = ((s - 1) * height) / 2;
    return Math.min(max, Math.max(-max, v));
  };
  const settle = (s: number) => {
    'worklet';
    runOnJS(onZoom)(s > 1.01);
  };

  const pinch = Gesture.Pinch()
    .onStart(() => startScale.set(scale.get()))
    .onUpdate((e) => scale.set(Math.min(MAX_ZOOM + 0.5, Math.max(0.8, startScale.get() * e.scale))))
    .onEnd(() => {
      const s = Math.min(MAX_ZOOM, Math.max(1, scale.get()));
      scale.set(withSpring(s, motion.spring));
      x.set(withSpring(clampX(x.get(), s), motion.spring));
      y.set(withSpring(clampY(y.get(), s), motion.spring));
      settle(s);
    });

  const pan = Gesture.Pan()
    .minDistance(6)
    // not zoomed: only a downward drag belongs to the photo; sideways goes to the list of photos
    .activeOffsetY([-14, 14])
    .failOffsetX([-24, 24])
    .onStart(() => {
      startX.set(x.get());
      startY.set(y.get());
    })
    .onUpdate((e) => {
      if (scale.get() > 1.01) {
        x.set(clampX(startX.get() + e.translationX, scale.get()));
        y.set(clampY(startY.get() + e.translationY, scale.get()));
      } else {
        y.set(e.translationY);
        drag.set(e.translationY);
      }
    })
    .onEnd((e) => {
      if (scale.get() > 1.01) return;
      if (Math.abs(e.translationY) > CLOSE_AT || Math.abs(e.velocityY) > 1400) {
        y.set(withTiming(Math.sign(e.translationY || 1) * height, { duration: 180 }));
        runOnJS(onClose)();
        return;
      }
      y.set(withSpring(0, motion.spring));
      drag.set(withSpring(0, motion.spring));
    });

  // a zoomed photo can be dragged sideways too, so it takes over from the list while zoomed
  const panZoomed = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      startX.set(x.get());
      startY.set(y.get());
    })
    .onUpdate((e) => {
      if (scale.get() <= 1.01) return;
      x.set(clampX(startX.get() + e.translationX, scale.get()));
      y.set(clampY(startY.get() + e.translationY, scale.get()));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.get() > 1.01) {
        scale.set(withSpring(1, motion.spring));
        x.set(withSpring(0, motion.spring));
        y.set(withSpring(0, motion.spring));
        settle(1);
      } else {
        // zoom in on the spot that was tapped
        const s = DOUBLE_TAP_ZOOM;
        scale.set(withSpring(s, motion.spring));
        x.set(withSpring(clampX((width / 2 - e.x) * (s - 1), s), motion.spring));
        y.set(withSpring(clampY((height / 2 - e.y) * (s - 1), s), motion.spring));
        settle(s);
      }
    });
  const singleTap = Gesture.Tap()
    .requireExternalGestureToFail(doubleTap)
    .onEnd(() => runOnJS(onTap)());

  const gesture = Gesture.Simultaneous(pinch, Gesture.Race(pan, panZoomed), Gesture.Exclusive(doubleTap, singleTap));

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { scale: scale.get() * interpolate(Math.abs(drag.get()), [0, CLOSE_AT * 2], [1, 0.86], 'clamp') },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width, height }} collapsable={false}>
        <Animated.View entering={first ? ZoomIn.duration(240) : undefined} style={[styles.flex, style]}>
          <Image source={{ uri }} style={[styles.clear, { width, height }]} resizeMode="contain" accessibilityIgnoresInvertColors accessibilityLabel={nb.detail.photo} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // the photo's grey loading colour would fill the whole screen around a contained photo
  clear: { backgroundColor: 'transparent' },
  bg: { backgroundColor: colors.viewerSolid },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  side: { width: 44 },
  counter: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.onInk16b, justifyContent: 'center' },
  counterText: { fontFamily: text.label.fontFamily, fontSize: 14, color: colors.white },
  arrow: { position: 'absolute', top: '50%', marginTop: -22 },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 12 },
  caption: { marginHorizontal: 16, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.card, backgroundColor: colors.ink, gap: 4 },
  captionTitle: { fontFamily: text.h3.fontFamily, fontSize: 17, lineHeight: 22, color: colors.white },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  captionSub: { flex: 1, fontFamily: text.bodySemi.fontFamily, fontSize: 13.5, color: colors.onInk78 },
  strip: { flexGrow: 1, justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 16, padding: 2, borderWidth: 2, borderColor: 'transparent', opacity: 0.55 },
  thumbOn: { borderColor: colors.lime, opacity: 1 },
  thumbImg: { flex: 1, borderRadius: 12 },
  hint: { ...text.small, textAlign: 'center', color: colors.onInk55 },
});
