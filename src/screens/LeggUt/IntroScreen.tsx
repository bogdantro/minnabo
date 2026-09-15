import { View, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { InfoBox } from '@/components/ui/InfoBox';
import { NeedHelpIcon } from '@/components/icons/ChoiceIcons';

const STEPS = [nb.leggUt.introStep1, nb.leggUt.introStep2, nb.leggUt.introStep3];

/**
 * Shown every time someone taps "Legg ut", before the posting wizard —
 * sets expectations (how it works, that offers come from neighbours) and
 * flags that their name/photo become visible to neighbours nearby.
 */
export function LeggUtIntroScreen() {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <PageHeader />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.art}>
          <NeedHelpIcon size={72} />
        </View>

        <ScreenTitle>{nb.leggUt.introHeading}</ScreenTitle>
        <AppText variant="body" color="navyMuted">
          {nb.leggUt.introSubtitle}
        </AppText>

        <View style={styles.steps}>
          {STEPS.map((text, i) => (
            <View key={text} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <AppText variant="meta" weight="bold" color="white">
                  {i + 1}
                </AppText>
              </View>
              <AppText variant="body" style={styles.stepText}>
                {text}
              </AppText>
            </View>
          ))}
        </View>

        <InfoBox icon="eye">{nb.leggUt.introVisibilityNote}</InfoBox>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={nb.leggUt.introCta}
          iconRight="arrow-right"
          onPress={() => router.push('/legg-ut/trenger-jobb')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: {
    padding: tokens.space.xl,
    gap: tokens.space.lg,
    paddingBottom: tokens.space.xxxl,
  },
  art: { alignItems: 'center', marginBottom: tokens.space.xs },
  steps: { gap: tokens.space.md },
  stepRow: { flexDirection: 'row', gap: tokens.space.md, alignItems: 'flex-start' },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.color.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, marginTop: 2 },
  footer: {
    padding: tokens.space.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
