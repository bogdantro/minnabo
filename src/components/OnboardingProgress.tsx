import { View, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';

/** Slim step indicator shared across the logg-inn → samtykker → oppsett flow. */
export function OnboardingProgress({ step, total }: { step: number; total: number }) {
  const progress = step / total;
  return (
    <View style={styles.wrap} accessibilityRole="progressbar">
      <View style={styles.row}>
        <AppText variant="meta" weight="bold" color="navyMuted">
          {nb.leggUt.stepLabel} {step} {nb.leggUt.stepOf} {total}
        </AppText>
        <AppText variant="meta" weight="bold" color="lime">
          {Math.round(progress * 100)}%
        </AppText>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: tokens.space.xl, paddingTop: tokens.space.sm, gap: tokens.space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, backgroundColor: tokens.color.line, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: tokens.color.lime },
});
