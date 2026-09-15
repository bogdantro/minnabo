import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { KeyboardAvoider } from './ui/KeyboardAvoider';
import { useFocusEffect, useRouter } from 'expo-router';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { wizardNav } from '@/data/wizardNav';
import { AppText } from './ui/Text';
import { ScreenTitle } from './ui/ScreenTitle';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { StatusPill } from './ui/StatusPill';
import { PageHeader } from './TopBar';

export type WizardStep = {
  title: string;
  subtitle?: string;
  validate?: () => string | null;
  render: () => ReactNode;
};

export function Wizard({
  heading,
  badge,
  badgeTone,
  steps,
  finalLabel,
  onFinish,
  onSaveDraft,
}: {
  heading: string;
  badge: string;
  badgeTone: 'lime' | 'cyan';
  steps: WizardStep[];
  finalLabel: string;
  onFinish: () => void;
  onSaveDraft?: () => void;
}) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // The preview screen can ask us to jump to a specific step when the user
  // taps "Rediger" on a field.
  useFocusEffect(
    useCallback(() => {
      const target = wizardNav.consume();
      if (target != null && target >= 0 && target < steps.length) {
        setIndex(target);
        setError(null);
      }
    }, [steps.length]),
  );

  // A step can be long (esp. with "Flere detaljer" expanded); always start
  // it scrolled to the top so the title and first field are visible.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const progress = (index + 1) / steps.length;

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
      // The "Neste" button is reachable from anywhere via the sticky footer,
      // so the error (shown up near the title) needs the view scrolled to
      // it — otherwise it silently appears off-screen above the fold.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setError(null);
    if (isLast) onFinish();
    else setIndex((i) => i + 1);
  };

  return (
    <KeyboardAvoider>
      <PageHeader title={heading} onBack={back} />

      <View style={styles.progressWrap}>
        <StatusPill label={badge} tone={badgeTone} soft />
        <View style={styles.stepRow}>
          <AppText variant="meta" weight="bold" color="navyMuted">
            {nb.leggUt.stepLabel} {index + 1} {nb.leggUt.stepOf} {steps.length}
          </AppText>
          <AppText variant="meta" weight="bold" color={badgeTone}>
            {Math.round(progress * 100)}%
          </AppText>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle>{step.title}</ScreenTitle>
        {step.subtitle ? (
          <AppText variant="body" color="navyMuted" style={styles.subtitle}>
            {step.subtitle}
          </AppText>
        ) : null}
        {error ? (
          <View style={styles.errorRow}>
            <Icon name="alert-circle" size={15} color="dangerText" />
            <AppText variant="meta" weight="bold" color="dangerText">
              {error}
            </AppText>
          </View>
        ) : null}
        <View style={styles.fields}>{step.render()}</View>
      </ScrollView>

      <View style={styles.footer}>
        {onSaveDraft ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={hitSlop}
            onPress={onSaveDraft}
            style={styles.draftLink}
          >
            <Icon name="file-text" size={15} color="cyan" />
            <AppText variant="meta" weight="bold" color="cyan">
              {nb.leggUt.saveDraft}
            </AppText>
          </Pressable>
        ) : null}
        <View style={styles.navRow}>
          {index > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={nb.leggUt.back}
              hitSlop={hitSlop}
              onPress={back}
              style={styles.backLink}
            >
              <Icon name="chevron-left" size={18} color="navy" />
              <AppText variant="cardTitle" weight="bold">
                {nb.leggUt.back}
              </AppText>
            </Pressable>
          ) : null}
          <View style={styles.nextWrap}>
            <Button
              label={isLast ? finalLabel : nb.leggUt.next}
              onPress={next}
              iconRight="chevron-right"
            />
          </View>
        </View>
      </View>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  progressWrap: {
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.sm,
    gap: tokens.space.sm,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, backgroundColor: tokens.color.line, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: tokens.color.lime },
  content: {
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.lg,
    paddingBottom: tokens.space.xxxl,
    gap: tokens.space.sm,
  },
  subtitle: { marginTop: -tokens.space.xs, marginBottom: tokens.space.sm },
  fields: { gap: tokens.space.lg },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: tokens.space.md },
  footer: {
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.md,
    paddingBottom: tokens.space.xs,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
    gap: tokens.space.md,
  },
  draftLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.lg },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  nextWrap: { flex: 1 },
});
