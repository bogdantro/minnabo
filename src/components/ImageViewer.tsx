import { useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Image } from '@/components/ui/Image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import nb from '@/i18n/nb';
import { haptics } from '@/lib/haptics';
import { colors, radius, text } from '@/theme/theme';
import { IconButton } from './ui';

const THUMB = 54;

/**
 * Photos in fullscreen on a dark background: swipe between them, pinch to zoom (iOS), a strip of
 * small pictures to jump with. Pass one `uri`, or `images` and the `index` to start on.
 */
export function ImageViewer({ uri, images, index = 0, caption, onClose }: { uri?: string | null; images?: string[]; index?: number; caption?: string; onClose: () => void }) {
  const list = images ?? (uri ? [uri] : []);
  return (
    <Modal visible={list.length > 0} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar style="light" />
      {list.length ? <Pages key={index} list={list} start={Math.min(index, list.length - 1)} caption={caption} onClose={onClose} /> : null}
    </Modal>
  );
}

function Pages({ list, start, caption, onClose }: { list: string[]; start: number; caption?: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const [i, setI] = useState(start);
  const n = list.length;

  const go = (to: number) => {
    const next = Math.max(0, Math.min(n - 1, to));
    ref.current?.scrollTo({ x: next * width, animated: true });
    setI(next);
    haptics.light();
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setI(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View style={styles.bg}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        scrollEnabled={n > 1}
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: start * width, y: 0 }}
        onLayout={() => start > 0 && ref.current?.scrollTo({ x: start * width, animated: false })}
        onMomentumScrollEnd={onEnd}
        onScroll={Platform.OS === 'web' ? onEnd : undefined}
        scrollEventThrottle={64}
      >
        {list.map((u, k) => (
          <ScrollView
            key={u + k}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            bouncesZoom
            style={{ width, height }}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.center}
          >
            <Animated.View entering={k === start ? ZoomIn.duration(220) : undefined}>
              <Pressable accessibilityRole="imagebutton" accessibilityLabel={nb.chat.imageClose} onPress={onClose}>
                <Image source={{ uri: u }} style={{ width, height }} resizeMode="contain" accessibilityIgnoresInvertColors />
              </Pressable>
            </Animated.View>
          </ScrollView>
        ))}
      </ScrollView>

      <Animated.View entering={FadeIn.delay(120)} style={[styles.top, { top: insets.top + 8 }]} pointerEvents="box-none">
        {n > 1 ? (
          <View style={styles.counter}>
            <Text style={styles.counterText}>{`${i + 1} / ${n}`}</Text>
          </View>
        ) : (
          <View />
        )}
        <IconButton icon="x" variant="glass" accessibilityLabel={nb.chat.imageClose} onPress={onClose} />
      </Animated.View>

      {n > 1 ? (
        <>
          {i > 0 ? <IconButton icon="left" variant="glass" accessibilityLabel={nb.detail.prevImage} onPress={() => go(i - 1)} style={[styles.side, styles.left]} /> : null}
          {i < n - 1 ? <IconButton icon="right" variant="glass" accessibilityLabel={nb.detail.nextImage} onPress={() => go(i + 1)} style={[styles.side, styles.right]} /> : null}
        </>
      ) : null}

      <Animated.View entering={FadeIn.delay(160)} style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]} pointerEvents="box-none">
        {caption ? (
          <Text style={styles.caption} numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
        {n > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {list.map((u, k) => (
              <Pressable
                key={u + k}
                accessibilityRole="button"
                accessibilityState={{ selected: k === i }}
                accessibilityLabel={nb.detail.imageN(k + 1, n)}
                onPress={() => go(k)}
                style={[styles.thumb, k === i && styles.thumbOn]}
              >
                <Image source={{ uri: u }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.viewerBg },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.onInk16b, justifyContent: 'center' },
  counterText: { fontFamily: text.label.fontFamily, fontSize: 14, color: colors.white },
  side: { position: 'absolute', top: '50%', marginTop: -22 },
  left: { left: 12 },
  right: { right: 12 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 12 },
  caption: { paddingHorizontal: 20, fontFamily: text.bodySemi.fontFamily, fontSize: 15, lineHeight: 21, color: colors.white, textAlign: 'center' },
  strip: { flexGrow: 1, justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', opacity: 0.62, backgroundColor: colors.onInk16b },
  thumbOn: { borderColor: colors.lime, opacity: 1 },
});
