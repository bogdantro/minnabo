import { View, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from '../ui/Text';
import { Icon } from '../ui/Icon';

/** Sunlit Nordic forest — Unsplash licence (see assets/home/CREDITS.md). */
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=60';

/**
 * Front-page hero (newhomepage.png): a sage-mint panel with a photo bleeding
 * off the right edge, a light headline, and a white pill CTA.
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

      <View style={styles.imageSide}>
        <Image source={{ uri: HERO_IMAGE }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient
          colors={[tokens.color.panelFrom, 'rgba(220,235,217,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fade}
        />
      </View>

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
          <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
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
    height: 254,
    borderRadius: tokens.radius.hero,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  imageSide: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '52%',
  },
  fade: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '46%' },
  body: {
    paddingLeft: tokens.space.xl,
    paddingRight: '46%',
    gap: tokens.space.sm,
  },
  title: {
    fontSize: 26,
    lineHeight: 31,
    fontFamily: tokens.font.regular,
    fontWeight: '400',
    color: tokens.color.navy,
    letterSpacing: -0.2,
  },
  subtitle: { marginTop: 2, marginBottom: tokens.space.sm },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    alignSelf: 'flex-start',
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.pill,
    paddingVertical: 13,
    paddingHorizontal: tokens.space.lg,
    ...tokens.shadow.card,
  },
});
