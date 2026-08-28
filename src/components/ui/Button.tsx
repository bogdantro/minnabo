import { useRef, useCallback, useState } from 'react';
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
  onPress: () => void | Promise<void>;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
};

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
  // Guard only against re-entrancy while an async onPress is still running,
  // so a stuck network call cannot be fired twice. Distinct taps that each
  // complete synchronously (wizard "Neste", filters) are never swallowed.
  const inFlight = useRef(false);
  const [, force] = useState(0);
  const blocked = disabled || loading || inFlight.current;

  const handlePress = useCallback(() => {
    if (disabled || loading || inFlight.current) return;
    const result = onPress();
    if (result && typeof result.then === 'function') {
      inFlight.current = true;
      force((n) => n + 1);
      result.finally(() => {
        inFlight.current = false;
        force((n) => n + 1);
      });
    }
  }, [disabled, loading, onPress]);

  // Text on a green (lime) background is always white; secondary/ghost keep colour.
  const labelColor = variant === 'primary' ? 'white' : variant === 'ghost' ? 'cyan' : 'navy';

  const content = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? tokens.color.white : tokens.color.navy} />
      ) : (
        <AppText
          variant="cardTitle"
          weight="bold"
          color={labelColor}
          numberOfLines={1}
          style={styles.label}
        >
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
    paddingHorizontal: tokens.space.md,
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
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
