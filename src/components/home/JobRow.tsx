import { View, Image, Pressable, StyleSheet } from 'react-native';
import type { Listing } from '@/domain/types';
import { formatPrice, formatFromPrice } from '@/domain/price';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from '../ui/Text';
import { Icon } from '../ui/Icon';

function priceLabel(listing: Listing): string {
  if (listing.priceMode === 'BY_AGREEMENT' || !listing.price) return nb.common.priceByAgreement;
  if (listing.priceMode === 'FROM') return formatFromPrice(listing.price);
  return formatPrice(listing.price);
}

/**
 * Compact list row for the "flere jobber" stack under the carousel:
 * thumbnail, title, muted category · distance, and the price.
 */
export function JobRow({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const cover = listing.images[0]?.url;
  const km =
    typeof listing.location.distanceKm === 'number'
      ? `${listing.location.distanceKm.toLocaleString('nb-NO')} ${nb.common.km}`
      : listing.location.place;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${listing.category.label}, ${km}`}
      onPress={onPress}
      style={styles.row}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Icon name="image" size={18} color="navyMuted" />
        </View>
      )}

      <View style={styles.body}>
        <AppText variant="body" weight="bold" numberOfLines={1}>
          {listing.title}
        </AppText>
        <View style={styles.meta}>
          <Icon name={listing.category.icon as never} size={12} color="navyMuted" />
          <AppText variant="meta" weight="medium" color="navyMuted" numberOfLines={1} style={styles.metaText}>
            {listing.category.label} · {km}
          </AppText>
        </View>
      </View>

      <AppText variant="body" weight="extrabold" numberOfLines={1} style={styles.price}>
        {priceLabel(listing)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.sm,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.line,
  },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { flex: 1 },
  price: { color: tokens.color.navy },
});
