import { View, Image, Pressable, StyleSheet } from 'react-native';
import type { Listing } from '@/domain/types';
import { formatPrice, formatFromPrice } from '@/domain/price';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { useIsSaved } from '@/data/savedStore';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { StatusPill } from './ui/StatusPill';

function priceLabel(listing: Listing): string {
  if (listing.priceMode === 'BY_AGREEMENT' || !listing.price) return nb.common.priceByAgreement;
  if (listing.priceMode === 'FROM') return formatFromPrice(listing.price);
  return formatPrice(listing.price);
}

/**
 * Full-width listing card, used for both TASK_REQUEST and SERVICE_OFFER so the
 * two sections read as one system (home, search, list pages).
 */
export function ListingRowCard({
  listing,
  onPress,
}: {
  listing: Listing;
  onPress: () => void;
}) {
  const [saved, toggleSaved] = useIsSaved(listing.id);
  const isTask = listing.type === 'TASK_REQUEST';
  const cover = listing.images[0]?.url;
  const rating = listing.owner.rating;

  const km =
    typeof listing.location.distanceKm === 'number'
      ? ` · ${listing.location.distanceKm.toLocaleString('nb-NO')} ${nb.common.km}`
      : '';

  const time = isTask ? listing.task?.scheduledText : listing.offer?.availabilityText;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${listing.title}, ${isTask ? nb.badge.needsHelp : nb.badge.offersHelp}`}
        onPress={onPress}
        style={styles.card}
      >
        <View style={styles.thumbWrap}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback]}>
              <Icon name="image" size={22} color="navyMuted" />
            </View>
          )}
          <View style={styles.onlineDot} />
        </View>

        <View style={styles.body}>
          <AppText variant="cardTitle" weight="bold" numberOfLines={1} style={styles.title}>
            {listing.title}
          </AppText>

          <StatusPill
            label={isTask ? nb.badge.needsHelp : nb.badge.offersHelp}
            tone={isTask ? 'lime' : 'cyan'}
          />

          <AppText variant="meta" color="navyMuted" numberOfLines={1}>
            {listing.owner.displayName}
            {rating
              ? ` · ★ ${rating.average.toLocaleString('nb-NO', { minimumFractionDigits: 1 })} (${rating.count})`
              : ''}
          </AppText>

          <View style={styles.metaRow}>
            <Icon name="map-pin" size={13} color="cyan" />
            <AppText variant="meta" color="navyMuted" numberOfLines={1}>
              {listing.location.place}
              {km}
            </AppText>
          </View>

          {time ? (
            <View style={styles.metaRow}>
              <Icon name="clock" size={13} color="cyan" />
              <AppText variant="meta" color="navyMuted" numberOfLines={1}>
                {time}
              </AppText>
            </View>
          ) : null}

          <AppText
            variant="section"
            weight="extrabold"
            color="lime"
            numberOfLines={1}
            style={styles.price}
          >
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

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  card: {
    flexDirection: 'row',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
    ...tokens.shadow.card,
  },
  thumbWrap: { width: 96, height: 96 },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.line,
  },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  onlineDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.color.lime,
    borderWidth: 2,
    borderColor: tokens.color.surface,
  },
  body: { flex: 1, gap: 4, justifyContent: 'center' },
  title: { alignSelf: 'flex-start', paddingRight: 40 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  price: { alignSelf: 'flex-end', marginTop: 2 },
  heart: { position: 'absolute', top: tokens.space.md, right: tokens.space.md, padding: 2 },
});
