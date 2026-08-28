import { View, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './Text';
import { StatusPill } from './StatusPill';

export function DistanceSlider({
  label,
  value,
  min = 1,
  max = 50,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (km: number) => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <AppText variant="meta" weight="bold">
          {label}
        </AppText>
        <StatusPill label={`${nb.common.upTo} ${value} ${nb.common.km}`} tone="lime" />
      </View>
      <View style={styles.sliderRow}>
        <AppText variant="meta" color="navyMuted">
          {min} {nb.common.km}
        </AppText>
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          step={1}
          value={value}
          onValueChange={onChange}
          minimumTrackTintColor={tokens.color.lime}
          maximumTrackTintColor={tokens.color.line}
          thumbTintColor={tokens.color.navy}
          accessibilityLabel={label}
        />
        <AppText variant="meta" color="navyMuted">
          {max} {nb.common.km}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  slider: { flex: 1, height: 40 },
});
