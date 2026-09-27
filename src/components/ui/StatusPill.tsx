import { View, StyleSheet, type ViewStyle } from 'react-native';
import { tokens, type ColorToken } from '@/theme';
import { AppText } from './Text';

export type PillTone = 'lime' | 'cyan' | 'neutral';

export type StatusPillProps = {
  label: string;
  tone?: PillTone;
  filled?: boolean;
  /** tinted background, coloured text, no border */
  soft?: boolean;
  /**
   * Raw colour override for cases outside the fixed tone palette — e.g. a
   * per-category accent from `theme/categoryAccent.ts`. Takes precedence
   * over `tone` when set.
   */
  accentColor?: string;
  accentTint?: string;
  style?: ViewStyle;
};

const toneColor: Record<PillTone, ColorToken> = {
  lime: 'lime',
  cyan: 'cyan',
  neutral: 'navyMuted',
};

const toneTint: Record<PillTone, ColorToken> = {
  lime: 'limeTint',
  cyan: 'cyanTint',
  neutral: 'line',
};

export function StatusPill({
  label,
  tone = 'neutral',
  filled = false,
  soft = false,
  accentColor,
  accentTint,
  style,
}: StatusPillProps) {
  const color = accentColor ?? tokens.color[toneColor[tone]];
  const tint = accentTint ?? tokens.color[toneTint[tone]];

  return (
    <View
      style={[
        styles.pill,
        filled
          ? { backgroundColor: color }
          : soft
            ? { backgroundColor: tint }
            : { borderColor: color, borderWidth: 1, backgroundColor: tint },
        style,
      ]}
    >
      <AppText
        variant="meta"
        weight="bold"
        color={filled ? 'white' : undefined}
        style={[styles.text, !filled ? { color } : null]}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
  },
});
