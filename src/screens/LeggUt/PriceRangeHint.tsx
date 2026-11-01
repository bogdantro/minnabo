import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { groupThousands } from '@/domain/price';
import { colors, radius, text } from '@/theme/theme';
import { Icon } from '@/components/ui';

export type PricePosition = 'none' | 'low' | 'within' | 'high';

/** Where an amount lands against the usual range: 250 vs 300–500 → 'low'. Empty amount → 'none'. */
export function pricePosition(amount: number, low: number, high: number): PricePosition {
  if (!(amount > 0) || !(high > 0)) return 'none';
  if (amount < low) return 'low';
  if (amount > high) return 'high';
  return 'within';
}

/**
 * «Vanlig her: 300–500 kr» right under the budget, with a small bar showing where the amount lands.
 * Only an indication from earlier tilbud – the price is agreed between the naboer, never paid here.
 */
export function PriceRangeHint({ low, high, amount, fromArea }: { low: number; high: number; amount: number; fromArea: boolean }) {
  const pos = pricePosition(amount, low, high);
  // the bar covers half the low value below and half above the high one
  const min = Math.max(0, low - (high - low) / 2);
  const max = high + (high - low) / 2;
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min || 1)) * 100))}%` as const;
  const tone = pos === 'within' ? colors.ok : pos === 'none' ? colors.mute : colors.warn;
  return (
    <View style={styles.wrap} accessibilityLabel={`${nb.wizard.s6.usualHere(groupThousands(low), groupThousands(high))}${pos !== 'none' ? `. ${nb.wizard.s6.position[pos]}` : ''}`}>
      <View style={styles.head}>
        <Icon name="chart" size={14} color={colors.ink2} />
        <Text style={styles.label}>{nb.wizard.s6.usualHere(groupThousands(low), groupThousands(high))}</Text>
        {pos !== 'none' ? <Text style={[styles.pos, { color: tone }]}>{nb.wizard.s6.position[pos]}</Text> : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.band, { left: at(low), width: `${((high - low) / (max - min || 1)) * 100}%` }]} />
        {pos !== 'none' ? <View style={[styles.dot, { left: at(amount), backgroundColor: tone }]} /> : null}
      </View>
      <Text style={[text.meta, styles.foot]}>{fromArea ? nb.wizard.s6.fromArea : nb.wizard.s6.fromGeneral}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, padding: 12, borderRadius: radius.card, backgroundColor: colors.bg, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { ...text.label, fontSize: 13.5, flex: 1 },
  pos: { ...text.label, fontSize: 13 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.line, justifyContent: 'center' },
  band: { position: 'absolute', top: 0, bottom: 0, borderRadius: 4, backgroundColor: colors.okTint },
  dot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, marginLeft: -7, borderWidth: 2, borderColor: colors.white },
  foot: { fontSize: 12 },
});
