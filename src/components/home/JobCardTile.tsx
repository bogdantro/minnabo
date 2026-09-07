import { View, Image, Pressable, StyleSheet } from 'react-native';
import type { Listing } from '@/domain/types';
import { formatPrice, formatFromPrice } from '@/domain/price';
import { tokens, hitSlop, categoryAccent } from '@/theme';
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
 * Vertical job tile for the "Jobber nær deg" carousel (newhomepage.png).
 * Image with a save heart and a distance pill, then title, the price in the
 * category's accent colour, and a category pill.
 */
export function JobCardTile({
  listing,
  onPress,
}: {
  listing: Listing;
  onPress: () => void;
}) {
  const [saved, toggleSaved] = useIsSaved(listing.id);
  const accent = categoryAccent(listing.category.slug);
  const cover = listing.images[0]?.url;
  const km =
    typeof listing.location.distanceKm === 'number'
      ? `${listing.location.distanceKm.toLocaleString('nb-NO')} ${nb.common.km}`
      : listing.location.place;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${listing.category.label}`}
      onPress={onPress}
      style={styles.tile}
    >
      <View style={styles.imageWrap}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Icon name="image" size={24} color="navyMuted" />
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? nb.a11y.unsave : nb.a11y.save}
          hitSlop={hitSlop}
          onPress={toggleSaved}
          style={styles.heart}
        >
          <Icon name="heart" size={16} color={saved ? 'lime' : 'navy'} />
        </Pressable>

        <View style={styles.kmPill}>
          <Icon name="map-pin" size={12} color="navy" />
          <AppText variant="meta" weight="bold" numberOfLines={1}>
            {km}
          </AppText>
        </View>
      </View>

      <AppText variant="cardTitle" weight="bold" numberOfLines={1} style={styles.title}>
        {listing.title}
      </AppText>

      <AppText variant="section" weight="extrabold" numberOfLines={1} style={{ color: accent.color }}>
        {priceLabel(listing)}
      </AppText>

      <View style={[styles.catPill, { backgroundColor: accent.tint }]}>
        <Icon name={listing.category.icon as never} size={13} color="navy" />
        <AppText variant="meta" weight="bold" style={{ color: accent.color }} numberOfLines={1}>
          {listing.category.label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { width: 172, gap: 3 },
  imageWrap: { height: 138, borderRadius: tokens.radius.card, overflow: 'hidden' },
  image: { width: '100%', height: '100%', backgroundColor: tokens.color.line },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
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
  kmPill: {
    position: 'absolute',
    left: tokens.space.sm,
    bottom: tokens.space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.pill,
    paddingVertical: 4,
    paddingHorizontal: tokens.space.sm,
    ...tokens.shadow.card,
  },
  title: { marginTop: 7 },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    paddingVertical: 5,
    paddingHorizontal: tokens.space.md,
    marginTop: 5,
  },
});
