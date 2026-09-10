import { View, Image, Pressable, StyleSheet } from 'react-native';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from '../ui/Text';
import { Icon } from '../ui/Icon';

/** Neighbour portraits — Unsplash licence (see assets/home/CREDITS.md). */
const FACES = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=60',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=60',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=120&q=60',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=120&q=60',
];

/**
 * Front-page footer prompt for the Fellesskap tab. Deliberately quiet — a flat
 * sage card with an avatar cluster and a text link, not a second hero.
 */
export function CommunityTeaserCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${nb.home.teaserTitle}. ${nb.home.teaserCta}`}
      hitSlop={hitSlop}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.avatars}>
        {FACES.map((uri, i) => (
          <Image
            key={uri}
            source={{ uri }}
            style={[styles.avatar, i > 0 && styles.avatarOverlap]}
          />
        ))}
      </View>

      <AppText variant="cardTitle" weight="extrabold" numberOfLines={2} style={styles.title}>
        {nb.home.teaserTitle}
      </AppText>
      <AppText variant="meta" weight="medium" color="navyMuted" numberOfLines={2}>
        {nb.home.teaserBody}
      </AppText>

      <View style={styles.link}>
        <AppText variant="meta" weight="bold" color="lime">
          {nb.home.teaserCta}
        </AppText>
        <Icon name="arrow-right" size={15} color="lime" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.panelTo,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.panelFrom,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
  },
  avatars: { flexDirection: 'row', marginBottom: 2 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: tokens.color.panelTo,
  },
  avatarOverlap: { marginLeft: -12 },
  title: { color: tokens.color.navy },
  link: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
});
