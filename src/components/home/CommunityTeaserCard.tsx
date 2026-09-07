import { View, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from '../ui/Text';
import { Icon } from '../ui/Icon';

/** Portraits — Unsplash licence (see assets/home/CREDITS.md). */
const FACES = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=60',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=60',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=60',
];

/**
 * Front-page community teaser (newhomepage.png): a sage panel with scattered
 * neighbour portraits over a faint map, and a "safe / simple / local" chip.
 */
export function CommunityTeaserCard({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[tokens.color.panelFrom, tokens.color.panelTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.faces} pointerEvents="none">
        <Image source={{ uri: FACES[0] }} style={[styles.face, { top: 46, right: 96 }]} />
        <Image source={{ uri: FACES[1] }} style={[styles.face, { top: 14, right: 40 }]} />
        <Image source={{ uri: FACES[2] }} style={[styles.face, { top: 92, right: 24 }]} />
        <View style={styles.here} />
      </View>

      <View style={styles.chip} pointerEvents="none">
        <Icon name="shield" size={16} color="shieldGreen" />
        <View>
          <AppText variant="meta" weight="bold">{nb.home.teaserPointTrygt}</AppText>
          <AppText variant="meta" weight="bold">{nb.home.teaserPointEnkelt}</AppText>
          <AppText variant="meta" weight="bold">{nb.home.teaserPointLokalt}</AppText>
        </View>
      </View>

      <View style={styles.body}>
        <AppText variant="section" weight="extrabold" style={styles.title}>
          {nb.home.teaserTitle}
        </AppText>
        <AppText variant="meta" color="navyMuted">{nb.home.teaserBody}</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.home.teaserCta}
          hitSlop={hitSlop}
          onPress={onPress}
          style={styles.cta}
        >
          <AppText variant="meta" weight="bold">{nb.home.teaserCta}</AppText>
          <Icon name="arrow-right" size={16} color="navy" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.hero,
    overflow: 'hidden',
    minHeight: 190,
  },
  body: {
    padding: tokens.space.xl,
    paddingRight: '46%',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  title: { maxWidth: 180 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: tokens.space.sm,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.pill,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    ...tokens.shadow.card,
  },
  faces: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '52%' },
  face: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: tokens.color.surface,
  },
  here: {
    position: 'absolute',
    top: 70,
    right: 70,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.color.cyan,
    borderWidth: 2,
    borderColor: tokens.color.surface,
  },
  chip: {
    position: 'absolute',
    right: tokens.space.lg,
    bottom: tokens.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    ...tokens.shadow.card,
  },
});
