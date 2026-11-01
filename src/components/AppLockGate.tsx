import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import nb from '@/i18n/nb';
import { LOCK_AFTER_MS, unlock, useAppLockEnabled } from '@/lib/appLock';
import { useSession } from '@/auth/session';
import { colors, text } from '@/theme/theme';
import { Button, Icon } from './ui';

/**
 * Covers the app with «MinNabo er låst» when the lock is on: at start, and when coming back
 * after a minute or more in the background. Face ID / fingerprint is asked at once;
 * «Lås opp» asks again if it was cancelled.
 */
export function AppLockGate() {
  const { userId, status } = useSession();
  const [enabled, ready] = useAppLockEnabled();
  const [locked, setLocked] = useState(false);
  const [asking, setAsking] = useState(false);
  const [started, setStarted] = useState(false);
  const leftAt = useRef<number | null>(null);
  const insets = useSafeAreaInsets();

  const ask = useCallback(async () => {
    setAsking(true);
    const ok = await unlock();
    setAsking(false);
    if (ok) setLocked(false);
  }, []);

  // locked from the start when the app opens with the lock on (only for a signed-in person)
  // wait for both the setting and the session, or a slow session would start the app unlocked
  if (ready && status !== 'loading' && !started) {
    setStarted(true);
    if (enabled && userId) setLocked(true);
  }

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') leftAt.current = Date.now();
      if (s === 'active' && leftAt.current != null) {
        const away = Date.now() - leftAt.current;
        leftAt.current = null;
        if (enabled && userId && away >= LOCK_AFTER_MS) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [enabled, userId]);

  // ask right away when the cover appears (the button asks again after «Avbryt»)
  useEffect(() => {
    if (!locked) return;
    let alive = true;
    void unlock().then((ok) => {
      if (alive && ok) setLocked(false);
    });
    return () => {
      alive = false;
    };
  }, [locked]);

  if (!locked) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.cover, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]} testID="app-lock" accessibilityViewIsModal>
      <View style={styles.mid}>
        <View style={styles.ic}>
          <Icon name="lock" size={32} color={colors.ink} />
        </View>
        <Text style={[text.h2, styles.center]} accessibilityRole="header">
          {nb.appLock.title}
        </Text>
        <Text style={[text.body, styles.sub]}>{nb.appLock.sub}</Text>
      </View>
      <Button label={nb.appLock.unlock} icon="lock" size="lg" loading={asking} onPress={() => void ask()} style={styles.btn} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: colors.bg, zIndex: 1000, elevation: 1000, justifyContent: 'space-between' },
  mid: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  ic: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  center: { textAlign: 'center' },
  sub: { textAlign: 'center', color: colors.ink2 },
  btn: { marginHorizontal: 24 },
});
