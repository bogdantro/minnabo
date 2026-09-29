import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import type { Purpose } from '@/domain/types';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/auth/session';
import { profileKeys } from '@/api/queries';
import { PageHeader } from '@/components/TopBar';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { neighbourCountFor } from '@/lib/socialProof';
import { detectKommune } from '@/lib/geo';

export function SetupScreen() {
  const router = useRouter();
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState<Purpose>('BOTH');
  const [municipality, setMunicipality] = useState('');
  const [place, setPlace] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  const useMyLoc = async () => {
    setError(null);
    setLocating(true);
    try {
      const res = await detectKommune();
      if ('municipality' in res) {
        setMunicipality(res.municipality);
        setPlace(res.place ?? res.municipality);
        setError(null);
      } else {
        setError(
          res.error === 'denied' ? nb.location.permissionDenied : nb.location.locationUnavailable,
        );
      }
    } finally {
      setLocating(false);
    }
  };

  const initials = (n: string) =>
    n
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'N';

  const finish = async () => {
    if (!name.trim() || !municipality.trim() || !place.trim()) {
      setError(nb.leggUt.errRequired);
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await supabase
      .from('profiles')
      .update({
        display_name: name.trim(),
        initials: initials(name),
        purpose,
        municipality: municipality.trim(),
        place: place.trim(),
        onboarded_at: new Date().toISOString(),
      })
      .eq('id', userId ?? '');
    setBusy(false);
    if (err) {
      setError(nb.state.error);
      return;
    }
    if (userId) queryClient.invalidateQueries({ queryKey: profileKeys.profile(userId) });
    router.replace('/');
  };

  return (
    <KeyboardAvoider>
      <PageHeader title={nb.onboarding.setupTitle} />
      <OnboardingProgress step={3} total={3} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ScreenTitle>{nb.onboarding.purposeQuestion}</ScreenTitle>

        <TextField label={nb.onboarding.nameLabel} value={name} onChangeText={setName} />

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

        <Button
          variant="secondary"
          label={locating ? nb.home.locating : nb.home.useMyLocation}
          iconLeft="map-pin"
          loading={locating}
          onPress={useMyLoc}
        />

        <TextField label={nb.onboarding.municipalityLabel} value={municipality} onChangeText={setMunicipality} />
        <TextField label={nb.onboarding.placeLabel} value={place} onChangeText={setPlace} />
        {neighbourCountFor(place) > 0 ? (
          <View style={styles.socialProof}>
            <Icon name="users" size={14} color="lime" />
            <AppText variant="meta" weight="bold" color="navyMuted">
              {nb.onboarding.socialProof(neighbourCountFor(place), place.trim())}
            </AppText>
          </View>
        ) : null}

        {error ? (
          <AppText variant="meta" color="dangerText">
            {error}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={nb.onboarding.finish} onPress={finish} loading={busy} />
      </View>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  body: { padding: tokens.space.xl, gap: tokens.space.lg, paddingBottom: tokens.space.xxl },
  socialProof: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -tokens.space.sm },
  footer: {
    padding: tokens.space.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
