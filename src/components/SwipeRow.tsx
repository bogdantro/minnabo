import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptics } from '@/lib/haptics';
import { colors, radius, text } from '@/theme/theme';
import { Icon, type IconKey } from '@/components/ui';

export type SwipeAction = { key: string; label: string; icon: IconKey; tone: 'cyan' | 'ink' | 'lime'; onPress: () => void };

const ACTION_W = 74;
const SPRING = { damping: 20, stiffness: 240 };

const TONE: Record<SwipeAction['tone'], { bg: string; fg: string }> = {
  cyan: { bg: colors.cyanTint, fg: colors.cyanDeep },
  ink: { bg: colors.ink, fg: colors.white },
  lime: { bg: colors.limeTint, fg: colors.limeDeep },
};

/**
 * A row that slides left to show its actions. They are also real accessibility actions on the row
 * (a screen reader can't swipe), passed in by the parent. `openId` keeps one row open at a time.
 */
export function SwipeRow({
  id,
  openId,
  onOpenChange,
  actions,
  children,
}: {
  id: string;
  openId: string | null;
  onOpenChange: (id: string | null) => void;
  actions: SwipeAction[];
  children: ReactNode;
}) {
  const width = actions.length * ACTION_W;
  const x = useSharedValue(0);
  const start = useSharedValue(0);

  // another row opened: this one closes
  useEffect(() => {
    if (openId !== id) x.set(withSpring(0, SPRING));
  }, [openId, id, x]);

  const opened = (open: boolean) => {
    if (open) haptics.light();
    onOpenChange(open ? id : null);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      start.set(x.get());
    })
    .onUpdate((e) => {
      x.set(Math.min(0, Math.max(-width - 12, start.get() + e.translationX)));
    })
    .onEnd((e) => {
      const open = x.get() < -width / 2 || e.velocityX < -600;
      x.set(withSpring(open ? -width : 0, SPRING));
      runOnJS(opened)(open);
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const backStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, -x.get() / 40) }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.back, { width }, backStyle]}>
        {actions.map((a) => {
          const t = TONE[a.tone];
          return (
            <Pressable
              key={a.key}
              // the row's accessibility actions speak for these, and they are hidden until swiped
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onPress={() => {
                onOpenChange(null);
                a.onPress();
              }}
              style={({ pressed }) => [styles.action, { backgroundColor: t.bg }, pressed && styles.pressed]}
            >
              <Icon name={a.icon} size={19} color={t.fg} />
              <Text style={[styles.label, { color: t.fg }]} numberOfLines={1}>
                {a.label}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  back: { position: 'absolute', top: 0, bottom: 0, right: 0, flexDirection: 'row', gap: 6, paddingLeft: 6 },
  action: { flex: 1, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', gap: 5 },
  pressed: { opacity: 0.8 },
  label: { fontFamily: text.label.fontFamily, fontSize: 11.5 },
});
