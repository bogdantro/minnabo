import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { tokens } from '@/theme';

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export function Card({
  children,
  onPress,
  style,
  padded = true,
  accessibilityLabel,
  testID,
}: CardProps) {
  const base = [styles.card, padded && styles.padded, style];

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [...base, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={base}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    ...tokens.shadow.card,
  },
  padded: {
    padding: tokens.space.lg,
  },
  pressed: {
    opacity: 0.96,
  },
});
