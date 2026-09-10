import { View, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from '../ui/Text';
import { Icon } from '../ui/Icon';

/** Lillehammer — Wikimedia Commons (see assets/home/CREDITS.md).
 *  1280px thumbnail (~320 KB) rather than the 5.4 MB original. */
const HERO_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Lillehammer_City.jpg/1280px-Lillehammer_City.jpg';

/**
 * Front-page hero: a sage panel with a local photo bleeding across it, one
 * confident headline, and the primary "legg ut" action.
 */
export function HeroCard({ onPressCta }: { onPressCta: () => void }) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: HERO_IMAGE }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={[
          tokens.color.panelFrom,
          tokens.color.panelFrom,
          'rgba(220,235,217,0.6)',
          'rgba(220,235,217,0)',
        ]}
        locations={[0, 0.42, 0.64, 0.92]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.body}>
        <AppText variant="display" style={styles.title}>
          {nb.home.heroTitle}
        </AppText>
        <AppText variant="body" weight="medium" color="navyMuted" style={styles.subtitle}>
          {nb.home.heroBody}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nb.home.heroCta}
          hitSlop={hitSlop}
          onPress={onPressCta}
          style={styles.cta}
        >
          <AppText variant="body" weight="bold" numberOfLines={1}>
            {nb.home.heroCta}
          </AppText>
          <Icon name="arrow-right" size={17} color="navy" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 232,
    borderRadius: tokens.radius.hero,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: tokens.color.panelFrom,
  },
  body: {
    paddingLeft: tokens.space.xl,
    paddingRight: '46%',
    gap: tokens.space.sm,
  },
  title: { color: tokens.color.navy },
  subtitle: { marginTop: 2, marginBottom: tokens.space.sm },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    alignSelf: 'flex-start',
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.pill,
    paddingVertical: 12,
    paddingHorizontal: tokens.space.lg,
    ...tokens.shadow.card,
  },
});
