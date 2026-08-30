import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import { toast, type ToastItem } from '@/lib/toast';
import { AppText } from './ui/Text';
import { Icon, type IconName } from './ui/Icon';

const ICON: Record<ToastItem['kind'], IconName> = {
  success: 'check-circle',
  error: 'alert-triangle',
  info: 'info',
};

/** Mounted once at the app root. Shows one toast at a time, auto-dismisses. */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<ToastItem | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = toast.subscribe((next) => {
      if (timer.current) clearTimeout(timer.current);
      setItem(next);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
      timer.current = setTimeout(dismiss, 3200);
    });
    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      setItem(null),
    );
  };

  if (!item) return null;

  const bg =
    item.kind === 'error'
      ? tokens.color.dangerText
      : item.kind === 'success'
        ? tokens.color.shieldGreen
        : tokens.color.navy;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          bottom: insets.bottom + tokens.space.xl,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={item.text}
        onPress={dismiss}
        style={[styles.toast, { backgroundColor: bg }]}
      >
        <Icon name={ICON[item.kind]} size={16} color="white" />
        <AppText variant="meta" weight="bold" color="white" style={styles.text}>
          {item.text}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 200 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    maxWidth: '92%',
    borderRadius: tokens.radius.pill,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    ...tokens.shadow.fab,
  },
  text: { flexShrink: 1 },
});
