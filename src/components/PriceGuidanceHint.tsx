import { View, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useListings } from '@/api/queries';
import { priceGuidanceForCategory } from '@/domain/priceGuidance';
import { groupThousands } from '@/domain/price';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

/**
 * "Vanlig pris for <kategori>: 800–1 500 kr" — shown next to a price field so
 * neither side is guessing. Renders nothing until the category has enough
 * comparable listings.
 */
export function PriceGuidanceHint({ categorySlug }: { categorySlug: string }) {
  const { data } = useListings({}, 'NEWEST');
  const g = priceGuidanceForCategory(data ?? [], categorySlug);
  if (!g) return null;

  return (
    <View style={styles.wrap}>
      <Icon name="trending-up" size={13} color="navyMuted" />
      <AppText variant="meta" color="navyMuted">
        {nb.priceGuidance.label}: {groupThousands(g.low)}–{groupThousands(g.high)} kr
        {'  '}
        <AppText variant="meta" weight="bold" color="navyMuted">
          ({nb.priceGuidance.typical} {groupThousands(g.typical)} kr)
        </AppText>
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
});
