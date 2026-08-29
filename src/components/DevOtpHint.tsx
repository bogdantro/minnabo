import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { supabase } from '@/lib/supabase';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

/**
 * DEV ONLY. Polls `get_dev_otp` and shows the one-time code so you can test the
 * login / signup flow without receiving an email. Renders nothing in
 * production builds (`__DEV__` is false) or until a code turns up — which only
 * happens when the `auth-email` hook is registered on the project.
 */
export function DevOtpHint({
  email,
  onUse,
}: {
  email: string;
  onUse: (code: string) => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const tries = useRef(0);

  useEffect(() => {
    if (!__DEV__ || !email) return;
    setCode(null);
    tries.current = 0;
    let stopped = false;

    const poll = async () => {
      if (stopped || tries.current > 20) return;
      tries.current += 1;
      try {
        const { data } = await supabase.rpc('get_dev_otp', { p_email: email });
        if (!stopped && typeof data === 'string' && data.length > 0) {
          setCode(data);
          return; // found it — stop polling
        }
      } catch {
        /* ignore — hook probably not registered */
      }
      if (!stopped) timer = setTimeout(poll, 1500);
    };

    let timer = setTimeout(poll, 800);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [email]);

  if (!__DEV__ || !code) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Bruk testkoden ${code}`}
      onPress={() => onUse(code)}
      style={styles.box}
    >
      <Icon name="unlock" size={16} color="navy" />
      <View style={styles.text}>
        <AppText variant="meta" weight="bold">
          Testkode (dev): {code}
        </AppText>
        <AppText variant="meta" color="navyMuted">
          Trykk for å fylle inn og bekrefte
        </AppText>
      </View>
      <Icon name="chevron-right" size={16} color="navyMuted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    backgroundColor: tokens.color.limeTint,
    borderWidth: 1,
    borderColor: tokens.color.lime,
    borderRadius: tokens.radius.tile,
    padding: tokens.space.md,
  },
  text: { flex: 1, gap: 1 },
});
