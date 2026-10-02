import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { colors, motion, radius, shadow, text } from '@/theme/theme';
import { Button, type ButtonVariant } from './Button';
import { Icon, type IconName } from './Icon';

export type DialogProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  /** Round icon above the title. */
  icon?: IconName;
  tone?: 'danger' | 'neutral' | 'ok';
  cancelLabel?: string;
  /** Custom action area (stacked buttons etc.) instead of Avbryt + confirm. */
  actions?: ReactNode;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm?: () => void | Promise<void>;
  loading?: boolean;
};

const TONE = {
  danger: { bg: colors.dangerTint, fg: colors.danger },
  neutral: { bg: colors.bg, fg: colors.ink },
  ok: { bg: colors.okTint, fg: colors.okText },
};

/** `.dialog` – centred card, radius 28, springs in; two buttons side by side. */
export function Dialog({
  visible,
  onClose,
  title,
  body,
  icon,
  tone = 'danger',
  cancelLabel = 'Avbryt',
  actions,
  confirmLabel = '',
  confirmVariant = 'danger',
  onConfirm,
  loading,
}: DialogProps) {
  const [mounted, setMounted] = useState(visible);
  const p = useSharedValue(0);
  // Mount immediately when opened; unmount only after the close animation.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      p.set(withSpring(1, motion.spring));
    } else {
      p.set(
        withTiming(0, { duration: 180 }, (done) => {
          if (done) runOnJS(setMounted)(false);
        }),
      );
    }
  }, [visible, p]);

  const card = useAnimatedStyle(() => ({
    opacity: Math.min(p.value * 1.4, 1),
    transform: [{ translateY: (1 - p.value) * 24 }, { scale: 0.9 + 0.1 * p.value }],
  }));
  const scrim = useAnimatedStyle(() => ({ opacity: Math.min(p.value, 1) }));
  const t = TONE[tone];

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Lukk" />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, shadow.large, card]} accessibilityViewIsModal accessibilityRole="alert">
          {icon ? (
            <View style={[styles.icon, { backgroundColor: t.bg }]}>
              <Icon name={icon} size={24} color={t.fg} />
            </View>
          ) : null}
          <Text style={[text.dialogTitle, styles.center_t]}>{title}</Text>
          {body ? <Text style={[text.stateBody, styles.center_t, styles.body]}>{body}</Text> : null}
          {actions ? (
            <View style={styles.stackActions}>{actions}</View>
          ) : (
            <View style={styles.actions}>
              <Button label={cancelLabel} variant="soft" onPress={onClose} style={styles.flex} />
              <Button
                label={confirmLabel}
                variant={confirmVariant}
                onPress={() => onConfirm?.()}
                loading={loading}
                style={styles.flex}
              />
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.scrim },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.dialog,
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 20,
    alignItems: 'center',
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  center_t: { textAlign: 'center' },
  body: { marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22, alignSelf: 'stretch' },
  stackActions: { gap: 10, marginTop: 20, alignSelf: 'stretch' },
  flex: { flex: 1 },
});
