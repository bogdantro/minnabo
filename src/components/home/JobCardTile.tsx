import { View, Image, Pressable, StyleSheet } from 'react-native';
import type { Listing } from '@/domain/types';
import { formatPrice, formatFromPrice } from '@/domain/price';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { useIsSaved } from '@/api/queries';
import { AppText } from '../ui/Text';
import { Icon } from '../ui/Icon';

function priceLabel(listing: Listing): string {
  if (listing.priceMode === 'BY_AGREEMENT' || !listing.price) return nb.common.priceByAgreement;
  if (listing.priceMode === 'FROM') return formatFromPrice(listing.price);
  return formatPrice(listing.price);
}

/**
 * Job tile for the "Jobber nær deg" carousel: photo + save heart, then title,
 * a muted category · distance line, and the price as the anchor.
 */
export function JobCardTile({
  listing,
  onPress,
}: {
  listing: Listing;
  onPress: () => void;
}) {
  const [saved, toggleSaved] = useIsSaved(listing.id);
  const cover = listing.images[0]?.url;
  const km =
    typeof listing.location.distanceKm === 'number'
      ? `${listing.location.distanceKm.toLocaleString('nb-NO')} ${nb.common.km}`
      : listing.location.place;

  return (
    <View style={styles.tile}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${listing.title}, ${listing.category.label}, ${km}`}
        onPress={onPress}
        style={styles.pressable}
      >
        <View style={styles.imageWrap}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imageFallback]}>
              <Icon name="image" size={24} color="navyMuted" />
            </View>
          )}
          <View style={styles.kmChip}>
            <AppText variant="meta" weight="bold" numberOfLines={1}>
              {km}
            </AppText>
          </View>
        </View>

        <AppText variant="cardTitle" weight="bold" numberOfLines={1} style={styles.title}>
          {listing.title}
        </AppText>

        <View style={styles.meta}>
          <Icon name={listing.category.icon as never} size={13} color="navyMuted" />
          <AppText variant="meta" weight="medium" color="navyMuted" numberOfLines={1} style={styles.metaText}>
            {listing.category.label}
          </AppText>
        </View>

        <AppText variant="section" weight="extrabold" numberOfLines={1} style={styles.price}>
          {priceLabel(listing)}
        </AppText>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? nb.a11y.unsave : nb.a11y.save}
        hitSlop={hitSlop}
        onPress={toggleSaved}
        style={styles.heart}
      >
        <Icon name="heart" size={16} color={saved ? 'lime' : 'navy'} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: 176, position: 'relative' },
  pressable: { gap: 6 },
  imageWrap: {
    height: 128,
    borderRadius: tokens.radius.tile,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: tokens.space.sm,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.color.line,
  },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  kmChip: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.pill,
    paddingVertical: 3,
    paddingHorizontal: tokens.space.sm,
  },
  heart: {
    position: 'absolute',
    top: tokens.space.sm,
    right: tokens.space.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.card,
  },
  title: { marginTop: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { flex: 1 },
  price: { color: tokens.color.navy, marginTop: 1 },
});
