import { useState, type ReactNode } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { ScreenTitle } from './ui/ScreenTitle';
import { Button } from './ui/Button';
import { PageHeader } from './TopBar';

export type WizardStep = {
  title: string;
  /** return an error string to block advancing, or null when valid */
  validate?: () => string | null;
  render: () => ReactNode;
};

export function Wizard({
  heading,
  steps,
  finalLabel,
  onFinish,
}: {
  heading: string;
  steps: WizardStep[];
  finalLabel: string;
  onFinish: () => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const back = () => {
    setError(null);
    if (index === 0) {
      router.canGoBack() ? router.back() : router.replace('/');
    } else {
      setIndex((i) => i - 1);
    }
  };

  const next = () => {
    const err = step.validate?.() ?? null;
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (isLast) onFinish();
    else setIndex((i) => i + 1);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader
        title={heading}
        onBack={back}
        right={
          <AppText variant="meta" color="navyMuted">
            {index + 1}/{steps.length}
          </AppText>
        }
      />

      <View style={styles.progress}>
        {steps.map((_, i) => (
          <View key={i} style={[styles.progressBar, i <= index && styles.progressBarActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle style={styles.stepTitle}>{step.title}</ScreenTitle>
        {step.render()}
        {error ? (
          <AppText variant="meta" color="dangerText">
            {error}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={isLast ? finalLabel : nb.common.next} onPress={next} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  progress: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: tokens.space.xl,
    marginBottom: tokens.space.md,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.color.line,
  },
  progressBarActive: { backgroundColor: tokens.color.lime },
  content: {
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.xxxl,
    gap: tokens.space.lg,
  },
  stepTitle: { marginBottom: tokens.space.xs },
  footer: {
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.md,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
