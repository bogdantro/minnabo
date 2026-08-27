import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import type { PublicProfile } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Avatar } from './ui/Avatar';
import { Rating } from './ui/Rating';

export function ActiveUsersRow({
  profiles,
  onPressUser,
}: {
  profiles: PublicProfile[];
  onPressUser: (id: string) => void;
}) {
  if (profiles.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <AppText variant="meta" weight="bold" color="navyMuted" style={styles.heading}>
        {nb.common.activeUsers.toUpperCase()}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {profiles.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`${p.displayName}, ${nb.common.activeNow}`}
            onPress={() => onPressUser(p.id)}
            style={styles.card}
          >
            <Avatar uri={p.avatarUrl} initials={p.initials} size={56} online />
            <AppText variant="meta" weight="bold" numberOfLines={1} style={styles.name}>
              {p.displayName}
            </AppText>
            {p.rating ? <Rating value={p.rating} showCount={false} /> : null}
            <View style={styles.statusRow}>
              <View style={styles.dot} />
              <AppText variant="meta" color="navyMuted">
                {nb.common.activeNow}
              </AppText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.sm },
  heading: { letterSpacing: 0.6, paddingHorizontal: tokens.space.xl },
  row: { gap: tokens.space.md, paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.xs },
  card: {
    width: 104,
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.sm,
    ...tokens.shadow.card,
  },
  name: { maxWidth: 90, textAlign: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.color.lime },
});
