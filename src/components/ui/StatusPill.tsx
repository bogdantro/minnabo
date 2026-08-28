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

export function StatusPill({ label, tone = 'neutral', filled = false, soft = false, style }: StatusPillProps) {
  const color = toneColor[tone];

  return (
    <View
      style={[
        styles.pill,
        filled
          ? { backgroundColor: tokens.color[color] }
          : soft
            ? { backgroundColor: tokens.color[toneTint[tone]] }
            : { borderColor: tokens.color[color], borderWidth: 1, backgroundColor: tokens.color[toneTint[tone]] },
        style,
      ]}
    >
      <AppText
        variant="meta"
        weight="bold"
        color={filled ? 'white' : color}
        style={styles.text}
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
