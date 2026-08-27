import { useRef, useCallback } from 'react';
import {
  Pressable,
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from '@/theme';
import { AppText } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
};

const DOUBLE_PRESS_MS = 600;

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  testID,
  style,
}: ButtonProps) {
  const lastPress = useRef(0);
  const blocked = disabled || loading;

  const handlePress = useCallback(() => {
    if (blocked) return;
    const now = Date.now();
    if (now - lastPress.current < DOUBLE_PRESS_MS) return;
    lastPress.current = now;
    onPress();
  }, [blocked, onPress]);

  const labelColor = variant === 'ghost' ? 'cyan' : 'navy';

  const content = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator color={tokens.color.navy} />
      ) : (
        <AppText variant="cardTitle" weight="bold" color={labelColor}>
          {label}
        </AppText>
      )}
    </View>
  );

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        blocked && styles.blocked,
        pressed && !blocked && styles.pressed,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[tokens.color.lime, tokens.color.limeGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: tokens.radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.lime,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.xl,
  },
  secondary: {
    backgroundColor: tokens.color.surface,
    borderWidth: 1.5,
    borderColor: tokens.color.lime,
  },
  ghost: {
    backgroundColor: 'transparent',
    height: 44,
  },
  blocked: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
  },
});
