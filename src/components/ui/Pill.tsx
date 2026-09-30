import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, sizes, text } from '@/theme/theme';
import { Icon, type IconName } from './Icon';

export type PillTone = 'need' | 'offer' | 'neutral' | 'line' | 'dark' | 'warn' | 'ok' | 'danger' | 'accent';

export type PillProps = {
  label: string;
  tone?: PillTone;
  size?: 'md' | 'lg';
  /** Leading status dot (need/offer tones get a white ring). */
  dot?: boolean;
  /** Override the dot colour (e.g. lime dot on the dark "Nytt tilbud" pill). */
  dotColor?: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const TONES: Record<PillTone, { bg: string; fg: string; border?: string; dot: string; ring?: boolean }> = {
  need: { bg: colors.limeTint, fg: colors.limeDeep, dot: colors.limeDot, ring: true },
  offer: { bg: colors.cyanTint, fg: colors.cyanDeep, dot: colors.cyan, ring: true },
  neutral: { bg: colors.neutralPill, fg: colors.ink2, dot: colors.ink2 },
  line: { bg: colors.white, fg: colors.ink2, border: colors.line, dot: colors.ink2 },
  dark: { bg: colors.ink, fg: colors.white, dot: colors.white },
  warn: { bg: colors.warnTint, fg: colors.warn, dot: colors.warn },
  ok: { bg: colors.okTint, fg: colors.okText, dot: colors.okText },
  danger: { bg: colors.dangerTint, fg: colors.danger, dot: colors.danger },
  // `.pill-grad` – flat lime accent ("6 nye")
  accent: { bg: colors.lime, fg: colors.ink, dot: colors.ink },
};

/** `.pill` – 26 px (lg 32) status label. See docs/COMPONENTS.md › Pills. */
export function Pill({ label, tone = 'neutral', size = 'md', dot, dotColor, icon, style, testID }: PillProps) {
  const t = TONES[tone];
  const lg = size === 'lg';
  return (
    <View
      testID={testID}
      style={[
        styles.base,
        { backgroundColor: t.bg, height: lg ? 32 : sizes.pill, paddingHorizontal: lg ? 13 : 10 },
        t.border ? { borderWidth: 1, borderColor: t.border } : null,
        style,
      ]}
    >
      {dot ? (
        <View
          style={[
            styles.dot,
            { backgroundColor: dotColor ?? t.dot },
            t.ring ? styles.ring : null,
          ]}
        />
      ) : null}
      {icon ? <Icon name={icon} size={14} color={t.fg} /> : null}
      <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[lg ? text.pillLg : text.pill, { color: t.fg }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  ring: { borderWidth: 0, boxShadow: `0 0 0 2px ${colors.white}` },
});
