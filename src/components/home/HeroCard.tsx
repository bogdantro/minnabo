import { View, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from '../ui/Text';
import { Button } from '../ui/Button';

/**
 * Front-page greeting: a flat sage strip with the headline and the primary
 * "legg ut" action — deliberately quiet, so the search bar right below it
 * carries the page. No photo or gradient; matches CommunityTeaserCard's
 * sage treatment at the bottom of the page as a bookend.
 */
export function HeroCard({ onPressCta }: { onPressCta: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <AppText variant="cardTitle" weight="extrabold" style={styles.title}>
          {nb.home.heroTitle}
        </AppText>
        <AppText variant="meta" color="navyMuted">
          {nb.home.heroBody}
        </AppText>
      </View>
      <Button
        label={nb.home.heroCta}
        onPress={onPressCta}
        iconRight="arrow-right"
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.panelTo,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.panelFrom,
    padding: tokens.space.lg,
    gap: tokens.space.md,
  },
  text: { gap: 2 },
  title: { color: tokens.color.navy },
  cta: { height: 44, alignSelf: 'flex-start', paddingHorizontal: tokens.space.lg },
});
