import { View, StyleSheet } from 'react-native';
import type { Review } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useProfile } from '@/api/queries';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

function Stars({ value }: { value: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={13} color={i <= value ? 'star' : 'line'} />
      ))}
    </View>
  );
}

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <AppText variant="body" color="navyMuted">
        {nb.profile.noReviews}
      </AppText>
    );
  }

  return (
    <View style={styles.list}>
      {reviews.map((r) => (
        <ReviewItem key={r.id} review={r} />
      ))}
    </View>
  );
}

function ReviewItem({ review: r }: { review: Review }) {
  const { data: author } = useProfile(r.fromProfileId);
  return (
    <View style={styles.item}>
      <View style={styles.itemHead}>
        <AppText variant="meta" weight="bold">
          {author?.displayName ?? 'Bruker'}
        </AppText>
        <Stars value={r.rating} />
      </View>
      {r.comment ? (
        <AppText variant="body" color="navyMuted">
          {r.comment}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: tokens.space.md },
  item: {
    gap: 4,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.tile,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stars: { flexDirection: 'row', gap: 2 },
});
