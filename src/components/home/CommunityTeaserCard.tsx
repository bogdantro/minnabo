import { View, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from '../ui/Text';
import { Icon } from '../ui/Icon';

/** Portraits + a faint street-map texture — Unsplash licence (assets/home/CREDITS.md). */
const FACES = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=60',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=60',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=60',
];
const MAP_TEXTURE =
  'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=500&q=40';

/**
 * Front-page community teaser (newhomepage.png): a sage panel with scattered
 * neighbour portraits over a faint map, and a "safe / simple / local" chip.
 */
export function CommunityTeaserCard({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: MAP_TEXTURE }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={[
          tokens.color.panelFrom,
          'rgba(220,235,217,0.82)',
          'rgba(220,235,217,0.5)',
        ]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.faces} pointerEvents="none">
        <Image source={{ uri: FACES[0] }} style={[styles.face, { top: 40, right: 96 }]} />
        <Image source={{ uri: FACES[1] }} style={[styles.face, { top: 8, right: 34 }]} />
        <Image source={{ uri: FACES[2] }} style={[styles.face, { top: 92, right: 16 }]} />
        <View style={styles.halo} />
        <View style={styles.here} />
      </View>

      <View style={styles.body}>
        <View>
          {/* "Lokale folk." / "Reell hjelp." — one sentence per line */}
          {nb.home.teaserTitle.split(/(?<=\.)\s+/).map((line) => (
            <AppText key={line} weight="bold" style={styles.title}>
              {line}
            </AppText>
          ))}
        </View>
        <AppText variant="meta" color="navyMuted" numberOfLines={2}>
          {nb.home.teaserBody}
        </AppText>
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
    height: 208,
    borderRadius: tokens.radius.hero,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: tokens.color.panelTo,
  },
  body: {
    padding: tokens.space.xl,
    paddingRight: '43%',
    gap: 7,
    flex: 1,
    justifyContent: 'center',
  },
  title: { fontSize: 19, lineHeight: 24, color: tokens.color.navy },
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
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: tokens.color.surface,
  },
  halo: {
    position: 'absolute',
    top: 62,
    right: 62,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(34,169,224,0.18)',
  },
  here: {
    position: 'absolute',
    top: 71,
    right: 71,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.color.cyan,
    borderWidth: 2,
    borderColor: tokens.color.surface,
  },
});
