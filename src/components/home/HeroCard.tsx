import { View, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from '../ui/Text';
import { Icon } from '../ui/Icon';

/** Norwegian lakeside cabin — Unsplash licence (see assets/home/CREDITS.md). */
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=900&q=60';

/**
 * The front-page hero (newhomepage.png): sage-mint gradient card with a photo
 * bleeding off the right edge, a light-weight headline, and a white pill CTA.
 */
export function HeroCard({ onPressCta }: { onPressCta: () => void }) {
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[tokens.color.panelFrom, tokens.color.panelTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Image source={{ uri: HERO_IMAGE }} style={styles.photo} />
      <LinearGradient
        colors={[tokens.color.panelFrom, 'rgba(223,237,221,0)']}
        start={{ x: 0.35, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.photoFade}
      />

      <View style={styles.body}>
        <AppText style={styles.title}>{nb.home.heroTitle}</AppText>
        <AppText variant="body" color="navyMuted" style={styles.subtitle}>
          {nb.home.heroBody}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.home.heroCta}
          hitSlop={hitSlop}
          onPress={onPressCta}
          style={styles.cta}
        >
          <AppText variant="cardTitle" weight="bold">
            {nb.home.heroCta}
          </AppText>
          <Icon name="arrow-right" size={18} color="navy" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.hero,
    overflow: 'hidden',
    minHeight: 232,
  },
  photo: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '62%',
  },
  photoFade: {
    position: 'absolute',
    left: '30%',
    top: 0,
    bottom: 0,
    width: '25%',
  },
  body: {
    padding: tokens.space.xl,
    paddingRight: '42%',
    gap: tokens.space.sm,
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    lineHeight: 35,
    fontFamily: tokens.font.regular,
    color: tokens.color.navy,
  },
  subtitle: { marginBottom: tokens.space.sm },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    alignSelf: 'flex-start',
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.pill,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    ...tokens.shadow.card,
  },
});
