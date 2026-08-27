import { View, StyleSheet } from 'react-native';
import type { Rating as RatingValue } from '@/domain/types';
import nb from '@/i18n/nb';
import { tokens } from '@/theme';
import { AppText } from './Text';
import { Icon } from './Icon';

export function Rating({ value, showCount = true }: { value: RatingValue; showCount?: boolean }) {
  return (
    <View style={styles.row}>
      <Icon name="star" size={15} color="star" />
      <AppText variant="meta" weight="bold">
        {value.average.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      </AppText>
      {showCount ? (
        <AppText variant="meta" color="navyMuted">
          ({value.count} {nb.listingDetail.ratingsSuffix})
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
