import { View, Image, Pressable, StyleSheet } from 'react-native';
import type { Listing } from '@/domain/types';
import { formatPrice, formatFromPrice } from '@/domain/price';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

function priceLabel(l: Listing): string {
  if (l.priceMode === 'BY_AGREEMENT' || !l.price) return nb.common.priceByAgreement;
  if (l.priceMode === 'FROM') return formatFromPrice(l.price);
  return formatPrice(l.price);
}

/** Small card in the "Nylig publisert" strip on the list pages. */
export function MiniJobCard({
  listing,
  isNew,
  onPress,
}: {
  listing: Listing;
  isNew?: boolean;
  onPress: () => void;
}) {
  const cover = listing.images[0]?.url;
  const time =
    (listing.task?.scheduledText || listing.offer?.availabilityText || nb.tasksPage.now).replace(
      /^I dag.*/,
      nb.tasksPage.now,
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listing.title}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.thumbWrap}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.fallback]}>
            <Icon name="image" size={16} color="navyMuted" />
          </View>
        )}
        {isNew ? (
          <View style={styles.newBadge}>
            <AppText variant="meta" weight="bold" color="white" style={styles.newText}>
              {nb.tasksPage.newBadge}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <AppText variant="meta" weight="bold" numberOfLines={1}>
          {listing.title}
        </AppText>
        <AppText variant="meta" weight="bold" color="lime" numberOfLines={1}>
          {priceLabel(listing)}
        </AppText>
        <AppText variant="meta" color="navyMuted" numberOfLines={1}>
          {time}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 224,
    flexDirection: 'row',
    gap: tokens.space.sm,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.sm,
    ...tokens.shadow.card,
  },
  thumbWrap: { width: 60, height: 60 },
  thumb: { width: 60, height: 60, borderRadius: tokens.radius.sm, backgroundColor: tokens.color.line },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  newBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: tokens.color.lime,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  newText: { fontSize: 10 },
  body: { flex: 1, justifyContent: 'center', gap: 1 },
});
