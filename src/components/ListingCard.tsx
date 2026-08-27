import { View, Image, StyleSheet } from 'react-native';
import type { Listing } from '@/domain/types';
import { formatPrice, formatFromPrice } from '@/domain/price';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { Card } from './ui/Card';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { StatusPill } from './ui/StatusPill';

export type ListingCardProps = {
  listing: Listing;
  onPress: () => void;
};

function priceLabel(listing: Listing): string {
  switch (listing.priceMode) {
    case 'BY_AGREEMENT':
      return nb.common.priceByAgreement;
    case 'FROM':
      return listing.price ? formatFromPrice(listing.price) : nb.common.priceByAgreement;
    default:
      return listing.price ? formatPrice(listing.price) : nb.common.priceByAgreement;
  }
}

export function ListingCard({ listing, onPress }: ListingCardProps) {
  const isTask = listing.type === 'TASK_REQUEST';
  const typeBadge = isTask ? nb.badge.needsHelp : nb.badge.offersHelp;
  const cover = listing.images[0]?.url;

  return (
    <Card
      onPress={onPress}
      padded={false}
      style={styles.card}
      accessibilityLabel={`${listing.title}, ${typeBadge}`}
    >
      <View style={styles.row}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Icon name="image" size={22} color="navyMuted" />
          </View>
        )}

        <View style={styles.body}>
          <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
            {listing.title}
          </AppText>

          <View style={styles.locationRow}>
            <Icon name="map-pin" size={14} color="cyan" />
            <AppText variant="meta" color="navyMuted" numberOfLines={1}>
              {listing.location.place}
              {typeof listing.location.distanceKm === 'number'
                ? ` · ${listing.location.distanceKm.toLocaleString('nb-NO')} ${nb.common.km}`
                : ''}
            </AppText>
          </View>

          <AppText variant="section" weight="bold" color="lime" style={styles.price}>
            {priceLabel(listing)}
          </AppText>

          <View style={styles.badges}>
            <StatusPill label={listing.category.label} tone={isTask ? 'lime' : 'cyan'} />
            <StatusPill label={typeBadge} tone={isTask ? 'lime' : 'cyan'} filled />
          </View>
        </View>

        <View style={styles.chevron}>
          <Icon name="chevron-right" size={22} color="cyan" />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.space.md,
    gap: tokens.space.md,
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.line,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  price: {
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
    marginTop: 2,
  },
  chevron: {
    alignSelf: 'center',
  },
});
