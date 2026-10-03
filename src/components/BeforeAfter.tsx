import { useState } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Icon } from '@/components/ui';

/**
 * `.cmp` (Jobbdag) – drag the handle to compare an "after" photo (left)
 * with the "before" photo (right).
 */
export function BeforeAfter({ before, after, accessibilityLabel }: { before: string; after: string; accessibilityLabel: string }) {
  const [w, setW] = useState(0);
  const [pct, setPct] = useState(50);
  const set = (x: number) => {
    if (!w) return;
    setPct(Math.min(100, Math.max(0, Math.round((x / w) * 100))));
  };
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(set)(e.x))
    .onUpdate((e) => runOnJS(set)(e.x));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.cmp}
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: pct }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => setPct((p) => Math.min(100, Math.max(0, p + (e.nativeEvent.actionName === 'increment' ? 10 : -10))))}
      >
        <Image source={{ uri: before }} style={styles.img} accessibilityIgnoresInvertColors />
        <View style={[styles.after, { width: `${pct}%` }]}>
          <Image source={{ uri: after }} style={[styles.img, { width: w || '100%' }]} accessibilityIgnoresInvertColors />
        </View>
        <View style={[styles.handle, shadow.medium, { left: `${pct}%` }]} pointerEvents="none">
          <View style={[styles.knob, shadow.medium]}>
            <Icon name="left" size={14} color={colors.ink} />
            <Icon name="right" size={14} color={colors.ink} />
          </View>
        </View>
        <Text style={[styles.tag, styles.tagL]}>{nb.jobWorkspace.after}</Text>
        <Text style={[styles.tag, styles.tagR]}>{nb.jobWorkspace.before}</Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  cmp: { height: 210, overflow: 'hidden', borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.track },
  img: { position: 'absolute', top: 0, left: 0, bottom: 0, width: '100%', height: 210 },
  after: { position: 'absolute', top: 0, left: 0, bottom: 0, overflow: 'hidden', zIndex: 2 },
  handle: { position: 'absolute', top: 0, bottom: 0, width: 3, marginLeft: -1.5, backgroundColor: colors.white, zIndex: 3 },
  knob: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 40,
    height: 40,
    marginTop: -20,
    marginLeft: -20,
    borderRadius: 20,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    position: 'absolute',
    top: 10,
    zIndex: 3,
    height: 26,
    lineHeight: 26,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    fontFamily: text.label.fontFamily,
    fontSize: 12,
    color: colors.white,
  },
  tagL: { left: 10, backgroundColor: colors.afterTag },
  tagR: { right: 10, backgroundColor: colors.galleryCap },
});
