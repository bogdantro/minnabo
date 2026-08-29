import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/TopBar';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { ConfirmCheckbox } from '@/components/ui/ConfirmCheckbox';
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
  const [busy, setBusy] = useState(false);

  const all = checked.terms && checked.privacy && checked.age;

  const next = async () => {
    if (!all) {
      setError(true);
      return;
    }
    setBusy(true);
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from('consent_records').insert({
        profile_id: data.user.id,
        terms: checked.terms,
        privacy: checked.privacy,
        age: checked.age,
      });
    }
    setBusy(false);
    router.replace('/oppsett');
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.onboarding.consentTitle} />
      <OnboardingProgress step={2} total={3} />
      <View style={styles.body}>
        <ScreenTitle>{nb.onboarding.consentTitle}</ScreenTitle>

        <View style={styles.list}>
          {ITEMS.map((item) => (
            <ConfirmCheckbox
              key={item.key}
              value={checked[item.key]}
              onChange={(v) => setChecked((c) => ({ ...c, [item.key]: v }))}
            >
              {item.label}
            </ConfirmCheckbox>
          ))}
        </View>

        {error && !all ? (
          <AppText variant="meta" color="dangerText">
            {nb.onboarding.consentMissing}
          </AppText>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button label={nb.onboarding.consentContinue} onPress={next} loading={busy} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  body: { flex: 1, padding: tokens.space.xl, gap: tokens.space.lg },
  list: { gap: tokens.space.sm },
  footer: {
    padding: tokens.space.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
