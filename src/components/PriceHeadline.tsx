import { View, StyleSheet } from 'react-native';
import type { Listing } from '@/domain/types';
import { formatPrice } from '@/domain/price';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';

export function priceHeadlineParts(listing: Listing): { amount?: string; suffix: string } {
  switch (listing.priceMode) {
    case 'FIXED':
      return { amount: listing.price ? formatPrice(listing.price) : undefined, suffix: nb.common.fixedPrice };
    case 'BUDGET':
      return { amount: listing.price ? formatPrice(listing.price) : undefined, suffix: nb.common.budget };
    case 'FROM':
      return {
        amount: listing.price ? `Fra ${formatPrice(listing.price)}` : undefined,
        suffix: nb.common.priceByAgreement,
      };
    case 'BY_AGREEMENT':
      return { suffix: nb.common.priceByAgreement };
  }
}

export function PriceHeadline({ listing }: { listing: Listing }) {
  const { amount, suffix } = priceHeadlineParts(listing);
  return (
    <View style={styles.row}>
      {amount ? (
        <AppText variant="section" weight="extrabold" color="lime">
          {amount}
        </AppText>
      ) : null}
      <AppText variant="body" color="navyMuted">
        {suffix}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
});
