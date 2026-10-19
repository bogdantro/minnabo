import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import { reviewerLogin } from '@/auth/reviewer';
import { isEnabled } from '@/config/featureFlags';
import { Button, Field, Input, Sheet } from '@/components/ui';

/** Long enough that nobody opens it by accident, short enough to hold still on a phone. */
const HOLD_MS = 1500;

/**
 * Wraps a MinNabo logo (Velkommen + Logg inn). Holding it for 1.5 seconds opens a user name +
 * password sheet for the app stores' reviewer (see auth/reviewer.ts). Nothing on the
 * screen shows that it is there: for everyone else, login is Vipps only.
 */
export function ReviewerLogin({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isEnabled('reviewerLogin')) return <>{children}</>;

  const close = () => {
    setOpen(false);
    setPassword('');
    setError(null);
  };

  const submit = () => {
    if (busy || !username.trim() || !password) return;
    setBusy(true);
    setError(null);
    reviewerLogin(username, password)
      .then(({ isNew }) => {
        setOpen(false);
        router.replace(isNew ? '/samtykker' : '/');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const t = nb.reviewerLogin;
  return (
    <>
      <Pressable onLongPress={() => setOpen(true)} delayLongPress={HOLD_MS} hitSlop={12} accessible={false} style={style}>
        {children}
      </Pressable>
      <Sheet visible={open} onClose={close} title={t.title} subtitle={t.sub}>
        <View style={styles.form}>
          <Field label={t.username}>
            <Input
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              accessibilityLabel={t.username}
              returnKeyType="next"
            />
          </Field>
          <Field label={t.password} error={error}>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              accessibilityLabel={t.password}
              error={!!error}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </Field>
          <Button label={busy ? t.busy : t.submit} size="lg" disabled={busy || !username.trim() || !password} onPress={submit} />
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14, paddingTop: 6, paddingBottom: 10 },
});
