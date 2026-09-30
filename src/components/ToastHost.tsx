import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { toast, type ToastItem } from '@/lib/toast';
import { colors, motion, radius, shadow, sizes, text } from '@/theme/theme';
import { Icon, type IconName } from './ui/Icon';

const ICON: Record<ToastItem['kind'], IconName> = { success: 'check', error: 'alert', info: 'info' };

/** Routes that show the floating tab bar – the toast sits above it there. */
const TAB_ROUTES = new Set(['/', '/fellesskap', '/innboks']);

/**
 * `.toast` – ink card, lime icon circle, optional lime "Angre" action.
 * 108 px from the bottom above the tab bar, 30 px elsewhere. Auto-hides after 2.6 s.
 * Mounted once at the app root.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [item, setItem] = useState<ToastItem | null>(null);
  const p = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    p.set(
      withTiming(0, { duration: 180 }, (done) => {
        if (done) runOnJS(setItem)(null);
      }),
    );
  }, [p]);

  useEffect(() => {
    const unsub = toast.subscribe((next) => {
      if (timer.current) clearTimeout(timer.current);
      setItem(next);
      p.set(0);
      p.set(withSpring(1, motion.spring));
      timer.current = setTimeout(dismiss, motion.durations.toastVisible);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dismiss, p]);

  const anim = useAnimatedStyle(() => ({
    opacity: Math.min(p.value, 1),
    transform: [{ translateY: (1 - p.value) * 30 }, { scale: 0.95 + 0.05 * p.value }],
  }));

  if (!item) return null;

  const bottom = (item.bottom ?? (TAB_ROUTES.has(pathname) ? 108 : 30)) + insets.bottom;
  const error = item.kind === 'error';

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { bottom }, shadow.large, anim]}>
      <View
        style={styles.toast}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <View style={[styles.ti, error && styles.tiError]}>
          <Icon name={item.icon ?? ICON[item.kind]} size={16} color={error ? colors.white : colors.ink} />
        </View>
        <Text style={[text.toast, styles.msg]}>{item.text}</Text>
        {item.action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.action.label}
            hitSlop={8}
            onPress={() => {
              item.action?.onPress();
              dismiss();
            }}
            style={styles.ta}
          >
            <Text style={text.toastAction}>{item.action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, borderRadius: radius.toast, zIndex: 60 },
  toast: {
    backgroundColor: colors.ink,
    borderRadius: radius.toast,
    paddingVertical: 13,
    paddingLeft: 16,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ti: {
    width: sizes.toastIcon,
    height: sizes.toastIcon,
    borderRadius: sizes.toastIcon / 2,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiError: { backgroundColor: colors.danger },
  msg: { flex: 1 },
  ta: { marginLeft: 'auto', minHeight: 36, justifyContent: 'center' },
});
