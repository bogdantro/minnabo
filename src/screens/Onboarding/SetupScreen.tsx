import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { authStore, type Purpose } from '@/data/authStore';
import { PageHeader } from '@/components/TopBar';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { Button } from '@/components/ui/Button';

const DISTANCES = [5, 10, 25, 50] as const;

export function SetupScreen() {
  const router = useRouter();
  const [purpose, setPurpose] = useState<Purpose>('BOTH');
  const [municipality, setMunicipality] = useState('');
  const [place, setPlace] = useState('');
  const [distance, setDistance] = useState<number>(15);
  const [error, setError] = useState<string | null>(null);

  const finish = () => {
    if (!municipality.trim() || !place.trim()) {
      setError(nb.leggUt.errRequired);
      return;
    }
    authStore.patch({
      purpose,
      municipality: municipality.trim(),
      place: place.trim(),
      maxDistanceKm: distance,
    });
    authStore.completeOnboarding();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.onboarding.setupTitle} />
      <OnboardingProgress step={3} total={3} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ScreenTitle>{nb.onboarding.purposeQuestion}</ScreenTitle>

        <ChipSelect<Purpose>
          label={nb.onboarding.purposeQuestion}
          options={[
            { value: 'NEED_HELP', label: nb.onboarding.purposeNeed },
            { value: 'WANT_JOBS', label: nb.onboarding.purposeWant },
            { value: 'BOTH', label: nb.onboarding.purposeBoth },
          ]}
          value={purpose}
          onChange={setPurpose}
        />
        <AppText variant="meta" color="navyMuted">
          {nb.onboarding.purposeNote}
        </AppText>

        <TextField label={nb.onboarding.municipalityLabel} value={municipality} onChangeText={setMunicipality} />
        <TextField label={nb.onboarding.placeLabel} value={place} onChangeText={setPlace} />

        <ChipSelect<string>
          label={nb.onboarding.distanceLabel}
          options={DISTANCES.map((d) => ({ value: String(d), label: `${d} ${nb.common.km}` }))}
          value={String(distance)}
          onChange={(v) => setDistance(Number(v))}
        />

        {error ? (
          <AppText variant="meta" color="dangerText">
            {error}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={nb.onboarding.finish} onPress={finish} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  body: { padding: tokens.space.xl, gap: tokens.space.lg, paddingBottom: tokens.space.xxl },
  footer: {
    padding: tokens.space.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
