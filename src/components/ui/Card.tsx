import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow } from '@/theme/theme';
import { PressableScale } from './PressableScale';

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  /** `.card.flat` – no shadow, 1px line border. */
  flat?: boolean;
  /** `.card.pad` – 18 px padding. */
  pad?: boolean;
  /** @deprecated use `pad` */
  padded?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** `.card` – white, radius 22, soft shadow + hairline. */
export function Card({ children, onPress, flat = false, pad, padded, accessibilityLabel, testID, style }: CardProps) {
  const padding = pad ?? padded ?? false;
  const s = [styles.base, flat ? styles.flat : shadow.card, padding ? styles.pad : null, style];
  if (onPress) {
    return (
      <PressableScale
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        scaleTo={0.985}
        style={s}
      >
        {children}
      </PressableScale>
    );
  }
  return (
    <View testID={testID} style={s}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  flat: { borderColor: colors.line },
  pad: { padding: 18 },
});
