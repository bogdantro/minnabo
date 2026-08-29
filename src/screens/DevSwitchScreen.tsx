import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { tokens } from '@/theme';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';

const DEMO_USERS = [
  { email: 'me@minnabo.test', name: 'Marius B. (deg)' },
  { email: 'emma@minnabo.test', name: 'Emma Larsen' },
  { email: 'martin@minnabo.test', name: 'Martin Ruud' },
  { email: 'sara@minnabo.test', name: 'Sara Ahmed' },
  { email: 'andreas@minnabo.test', name: 'Andreas Berg' },
  { email: 'fjellbygg@minnabo.test', name: 'Fjellbygg AS' },
];

/** Dev-only: swap the session to a seeded demo user. Never shipped in prod. */
export function DevSwitchScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!__DEV__) return <Redirect href="/" />;

  const switchTo = async (email: string) => {
    setBusy(email);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password: 'minnabo-demo',
    });
    setBusy(null);
    if (err) {
      setError(`Klarte ikke å bytte: ${err.message}`);
      return;
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title="Bytt testbruker" />
      <View style={styles.body}>
        <ScreenTitle>Bytt testbruker</ScreenTitle>
        <AppText variant="meta" color="navyMuted">
          Kun for utvikling. Logger inn som en av demo-brukerne (passord: minnabo-demo).
        </AppText>

        {DEMO_USERS.map((u) => (
          <Pressable
            key={u.email}
            accessibilityRole="button"
            accessibilityLabel={u.name}
            disabled={!!busy}
            onPress={() => switchTo(u.email)}
            style={styles.row}
          >
            <Icon name={busy === u.email ? 'loader' : 'user'} size={18} color="navy" />
            <View style={styles.rowText}>
              <AppText variant="body" weight="bold">
                {u.name}
              </AppText>
              <AppText variant="meta" color="navyMuted">
                {u.email}
              </AppText>
            </View>
            <Icon name="chevron-right" size={16} color="navyMuted" />
          </Pressable>
        ))}

        {error ? (
          <AppText variant="meta" color="dangerText">
            {error}
          </AppText>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  body: { flex: 1, padding: tokens.space.xl, gap: tokens.space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.tile,
    padding: tokens.space.md,
  },
  rowText: { flex: 1, gap: 1 },
});
