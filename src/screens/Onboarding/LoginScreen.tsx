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
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';

export function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'contact' | 'code'>('contact');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

  const sendCode = async () => {
    if (!isEmail(contact)) {
      setError(nb.onboarding.invalidEmail);
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: contact.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (err) {
      setError(nb.onboarding.otpSendFailed);
      return;
    }
    setStep('code');
  };

  const verify = async () => {
    if (code.trim().length < 6) {
      setError(nb.onboarding.wrongCode);
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email: contact.trim(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (err) {
      setError(nb.onboarding.wrongCode);
      return;
    }
    router.replace('/samtykker');
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.onboarding.loginTitle} />
      <OnboardingProgress step={1} total={3} />
      <View style={styles.body}>
        <ScreenTitle>{nb.onboarding.loginTitle}</ScreenTitle>
        <AppText variant="body" color="navyMuted">
          {step === 'contact' ? nb.onboarding.loginBody : nb.onboarding.codeHint}
        </AppText>

        {step === 'contact' ? (
          <TextField
            label={nb.onboarding.contactLabel}
            value={contact}
            onChangeText={setContact}
            keyboardType="email-address"
          />
        ) : (
          <TextField
            label={nb.onboarding.codeLabel}
            value={code}
            onChangeText={setCode}
            keyboardType="numeric"
            maxLength={6}
          />
        )}

        {error ? (
          <AppText variant="meta" color="dangerText">
            {error}
          </AppText>
        ) : null}

        <AppText variant="meta" color="navyMuted">
          {nb.onboarding.bankIdNote}
        </AppText>
      </View>

      <View style={styles.footer}>
        {step === 'contact' ? (
          <Button label={nb.onboarding.sendCode} onPress={sendCode} loading={busy} />
        ) : (
          <Button label={nb.onboarding.verify} onPress={verify} loading={busy} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  body: { flex: 1, padding: tokens.space.xl, gap: tokens.space.md },
  footer: {
    padding: tokens.space.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
