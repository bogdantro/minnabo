import { useState, type ReactNode } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AppText } from './ui/Text';
import { ScreenTitle } from './ui/ScreenTitle';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { StatusPill } from './ui/StatusPill';
import { DetailTopBar } from './TopBar';

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
  const me = useCurrentUser();
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
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
      return;
    }
    setError(null);
    if (isLast) onFinish();
    else setIndex((i) => i + 1);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <DetailTopBar
        title={heading}
        onBack={back}
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        unreadNotifications
        onProfilePress={() => {}}
        onNotificationsPress={() => {}}
      />

      <View style={styles.progressWrap}>
        <StatusPill label={badge} tone={badgeTone} filled />
        <AppText variant="meta" weight="bold" style={styles.stepLabel}>
          {nb.leggUt.stepLabel} {index + 1} {nb.leggUt.stepOf} {steps.length}
        </AppText>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle>{step.title}</ScreenTitle>
        {step.subtitle ? (
          <AppText variant="body" color="navyMuted" style={styles.subtitle}>
            {step.subtitle}
          </AppText>
        ) : null}
        {step.render()}
        {error ? (
          <AppText variant="meta" color="dangerText">
            {error}
          </AppText>
        ) : null}
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
              hitSlop={hitSlop}
              onPress={back}
              style={styles.backLink}
            >
              <Icon name="chevron-left" size={16} color="navy" />
              <AppText variant="body" weight="bold">
                {nb.leggUt.back}
              </AppText>
            </Pressable>
          ) : null}
          <View style={styles.nextWrap}>
            <Button label={isLast ? finalLabel : nb.leggUt.next} onPress={next} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  progressWrap: {
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.sm,
    gap: tokens.space.sm,
  },
  stepLabel: {},
  track: { height: 5, borderRadius: 3, backgroundColor: tokens.color.line, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: tokens.color.lime },
  content: {
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.md,
    paddingBottom: tokens.space.xxxl,
    gap: tokens.space.md,
  },
  subtitle: { marginTop: -tokens.space.xs },
  footer: {
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.md,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
    gap: tokens.space.sm,
  },
  draftLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  nextWrap: { flex: 1 },
});
