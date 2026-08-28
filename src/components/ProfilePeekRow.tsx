import { ScrollView, Pressable, View, StyleSheet } from 'react-native';
import type { PublicProfile } from '@/domain/types';
import { tokens } from '@/theme';
import { AppText } from './ui/Text';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';

/** "Nylig aktive" strip on the tilbydere page: avatar, name, rating — centered. */
export function ProfilePeekRow({
  profiles,
  onPressUser,
}: {
  profiles: PublicProfile[];
  onPressUser: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {profiles.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={p.displayName}
          onPress={() => onPressUser(p.id)}
          style={styles.item}
        >
          <Avatar uri={p.avatarUrl} initials={p.initials} size={68} online />
          <AppText variant="meta" weight="bold" numberOfLines={1}>
            {p.displayName}
          </AppText>
          {p.rating ? (
            <View style={styles.ratingRow}>
              <Icon name="star" size={12} color="star" />
              <AppText variant="meta" color="navyMuted">
                {p.rating.average.toLocaleString('nb-NO', { minimumFractionDigits: 1 })} ({p.rating.count})
              </AppText>
            </View>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: tokens.space.lg, paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.sm },
  item: { width: 92, alignItems: 'center', gap: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
