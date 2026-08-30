import { ScrollView, Pressable, View, StyleSheet } from 'react-native';
import type { PublicProfile } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';

/**
 * Compact horizontal strip of active providers: avatar on the left, name +
 * rating + active status on the right. No background, no padding, small gap.
 */
export function ActiveUsersRow({
  profiles,
  onlineIds,
  onPressUser,
}: {
  profiles: PublicProfile[];
  /** profile ids that are actually online right now (presence) */
  onlineIds?: Set<string>;
  onPressUser: (id: string) => void;
}) {
  if (profiles.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {profiles.map((p) => {
        const isOnline = onlineIds?.has(p.id) ?? false;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`${p.displayName}, ${isOnline ? nb.common.activeNow : nb.common.recentlyActive}`}
            onPress={() => onPressUser(p.id)}
            style={styles.item}
          >
            <Avatar uri={p.avatarUrl} initials={p.initials} size={40} online={isOnline} />
            <View style={styles.text}>
              <AppText variant="meta" weight="bold" numberOfLines={1}>
                {p.displayName}
              </AppText>
              <View style={styles.metaRow}>
                {p.rating ? (
                  <>
                    <Icon name="star" size={11} color="star" />
                    <AppText variant="meta" color="navyMuted">
                      {p.rating.average.toLocaleString('nb-NO', { minimumFractionDigits: 1 })}
                    </AppText>
                    <AppText variant="meta" color="navyMuted">
                      {' · '}
                    </AppText>
                  </>
                ) : null}
                {isOnline ? <View style={styles.dot} /> : null}
                <AppText variant="meta" color="navyMuted">
                  {isOnline ? nb.common.activeNow : nb.common.recentlyActive}
                </AppText>
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: tokens.space.xl,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.sm,
    paddingBottom: tokens.space.md,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  text: { gap: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.color.lime },
});
