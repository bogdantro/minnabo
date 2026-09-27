import { View, Image, Pressable, StyleSheet } from 'react-native';
import type { Listing } from '@/domain/types';
import { formatPrice, formatFromPrice } from '@/domain/price';
import { tokens, hitSlop, categoryAccent } from '@/theme';
import nb from '@/i18n/nb';
import { useIsSaved } from '@/api/queries';
import { AppText } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { StatusPill } from '../ui/StatusPill';

function priceLabel(listing: Listing): string {
  if (listing.priceMode === 'BY_AGREEMENT' || !listing.price) return nb.common.priceByAgreement;
  if (listing.priceMode === 'FROM') return formatFromPrice(listing.price);
  return formatPrice(listing.price);
}

/**
 * Photo-first feed card for the homepage's newest-jobs strip: the cover image
 * spans the card's full width, with title/place/price below it — unlike the
 * compact thumbnail rows used on search/list screens.
 */
export function JobFeedCard({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const [saved, toggleSaved] = useIsSaved(listing.id);
  const cover = listing.images[0]?.url;
  const accent = categoryAccent(listing.category.slug);

  const km =
    typeof listing.location.distanceKm === 'number'
      ? ` · ${listing.location.distanceKm.toLocaleString('nb-NO')} ${nb.common.km}`
      : '';

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${listing.title}, ${listing.category.label}`}
        onPress={onPress}
        style={styles.card}
      >
        {cover ? (
          <Image source={{ uri: cover }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Icon name="image" size={28} color="navyMuted" />
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.badgeRow}>
            <StatusPill
              label={listing.category.label}
              accentColor={accent.color}
              accentTint={accent.tint}
            />
            {listing.task?.isDugnad ? <StatusPill label={nb.badge.dugnad} tone="lime" /> : null}
          </View>
          <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
            {listing.title}
          </AppText>
          <View style={styles.metaRow}>
            <Icon name="map-pin" size={13} color="cyan" />
            <AppText variant="meta" color="navyMuted" numberOfLines={1}>
              {listing.location.place}
              {km}
            </AppText>
          </View>
          <AppText variant="section" weight="extrabold" style={[styles.price, { color: accent.color }]}>
            {priceLabel(listing)}
          </AppText>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? nb.a11y.unsave : nb.a11y.save}
        hitSlop={hitSlop}
        onPress={toggleSaved}
        style={styles.heart}
      >
        <Icon name="heart" size={20} color={saved ? 'lime' : 'navy'} />
      </Pressable>
    </View>
  );
}

const IMAGE_HEIGHT = 176;

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    overflow: 'hidden',
  },
  image: { width: '100%', height: IMAGE_HEIGHT, backgroundColor: tokens.color.line },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: tokens.space.lg, gap: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  price: { marginTop: 2 },
  heart: {
    position: 'absolute',
    right: tokens.space.md,
    top: tokens.space.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
