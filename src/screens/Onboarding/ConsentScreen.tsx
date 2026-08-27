import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { authStore } from '@/data/authStore';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

const ITEMS = [
  { key: 'terms', label: nb.onboarding.consentTerms },
  { key: 'privacy', label: nb.onboarding.consentPrivacy },
  { key: 'age', label: nb.onboarding.consentAge },
] as const;

export function ConsentScreen() {
  const router = useRouter();
  const [checked, setChecked] = useState({ terms: false, privacy: false, age: false });
  const [error, setError] = useState(false);

  const all = checked.terms && checked.privacy && checked.age;

  const next = () => {
    if (!all) {
      setError(true);
      return;
    }
    authStore.patch({ consents: checked });
    router.push('/oppsett');
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.onboarding.consentTitle} />
      <View style={styles.body}>
        <ScreenTitle>{nb.onboarding.consentTitle}</ScreenTitle>

        <View style={styles.list}>
          {ITEMS.map((item) => {
            const on = checked[item.key];
            return (
              <Pressable
                key={item.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={item.label}
                onPress={() => setChecked((c) => ({ ...c, [item.key]: !c[item.key] }))}
                style={styles.row}
              >
                <View style={[styles.box, on && styles.boxOn]}>
                  {on ? <Icon name="check" size={14} color="navy" /> : null}
                </View>
                <AppText variant="body" style={styles.rowLabel}>
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {error && !all ? (
          <AppText variant="meta" color="dangerText">
            {nb.onboarding.consentMissing}
          </AppText>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button label={nb.onboarding.consentContinue} onPress={next} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  body: { flex: 1, padding: tokens.space.xl, gap: tokens.space.lg },
  list: { gap: tokens.space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.tile,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: tokens.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { borderColor: tokens.color.lime, backgroundColor: tokens.color.limeTint },
  rowLabel: { flex: 1 },
  footer: {
    padding: tokens.space.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
