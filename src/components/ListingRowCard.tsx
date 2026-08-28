import { View, Image, Pressable, StyleSheet } from 'react-native';
import type { Listing } from '@/domain/types';
import { formatPrice, formatFromPrice } from '@/domain/price';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { useIsSaved } from '@/data/savedStore';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { StatusPill } from './ui/StatusPill';
import { Avatar } from './ui/Avatar';

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

  const km =
    typeof listing.location.distanceKm === 'number'
      ? ` · ${listing.location.distanceKm.toLocaleString('nb-NO')} ${nb.common.km}`
      : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${isTask ? nb.badge.needsHelp : nb.badge.offersHelp}`}
      onPress={onPress}
      style={styles.card}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={styles.thumb} />
      ) : isTask ? (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Icon name="image" size={22} color="navyMuted" />
        </View>
      ) : (
        <View style={styles.thumb}>
          <Avatar
            uri={listing.owner.avatarUrl}
            initials={listing.owner.initials}
            size={84}
            ring={false}
          />
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant="cardTitle" weight="bold" numberOfLines={1} style={styles.title}>
            {listing.title}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? nb.a11y.unsave : nb.a11y.save}
            hitSlop={hitSlop}
            onPress={toggleSaved}
          >
            <Icon name="heart" size={20} color={saved ? 'lime' : 'navy'} />
          </Pressable>
        </View>

        <StatusPill
          label={isTask ? nb.badge.needsHelp : nb.badge.offersHelp}
          tone={isTask ? 'lime' : 'cyan'}
        />

        {!isTask ? (
          <AppText variant="meta" color="navyMuted" numberOfLines={1}>
            {listing.owner.displayName}
            {listing.owner.rating
              ? ` · ★ ${listing.owner.rating.average.toLocaleString('nb-NO', { minimumFractionDigits: 1 })} (${listing.owner.rating.count})`
              : ''}
          </AppText>
        ) : null}

        <View style={styles.metaRow}>
          <Icon name="map-pin" size={13} color="cyan" />
          <AppText variant="meta" color="navyMuted" numberOfLines={1}>
            {listing.location.place}
            {km}
          </AppText>
        </View>

        <View style={styles.bottomRow}>
          {isTask && listing.task?.scheduledText ? (
            <View style={styles.metaRow}>
              <Icon name="calendar" size={13} color="cyan" />
              <AppText variant="meta" color="navyMuted" numberOfLines={1}>
                {listing.task.scheduledText}
              </AppText>
            </View>
          ) : (
            <View style={styles.metaRow} />
          )}
          <AppText variant="section" weight="extrabold" color="lime">
            {priceLabel(listing)}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  thumb: {
    width: 84,
    height: 84,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.line,
    overflow: 'hidden',
  },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 5, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  title: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
  },
});
