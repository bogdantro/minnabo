import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getNetworkStateAsync, useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import nb from '@/i18n/nb';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Icon } from './ui/Icon';
import { PressableScale } from './ui/PressableScale';

const ONLINE_MS = 2600;
const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * `.banner` in design/screens/Tilstander.dc.html – app-wide connectivity banner, mounted once
 * at the root. Offline: ink banner with the time of the newest cached data and "Prøv igjen".
 * Back online: green "Tilkoblet igjen" for a moment, and every list refetches.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const net = useNetworkState();
  const queryClient = useQueryClient();
  // `undefined` while the first probe is in flight — treat as online.
  const reported = net.isConnected === false || net.isInternetReachable === false; // same rule as useIsOffline()
  // "Prøv igjen" can find the connection before the OS reports it; valid until the next report.
  const [probe, setProbe] = useState<{ offline: boolean; reported: boolean } | null>(null);
  const offline = probe && probe.reported === reported ? probe.offline : reported;
  const [prevOffline, setPrevOffline] = useState(offline);
  const [justOnline, setJustOnline] = useState(false);
  const [checking, setChecking] = useState(false);

  if (prevOffline !== offline) {
    setPrevOffline(offline);
    setJustOnline(!offline);
  }

  useEffect(() => {
    if (!justOnline) return;
    void queryClient.invalidateQueries();
    const t = setTimeout(() => setJustOnline(false), ONLINE_MS);
    return () => clearTimeout(t);
  }, [justOnline, queryClient]);

  const retry = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const s = await getNetworkStateAsync();
      setProbe({ offline: s.isConnected === false || s.isInternetReachable === false, reported });
    } catch {
      // still offline
    } finally {
      setChecking(false);
    }
  };

  if (!offline && !justOnline) return null;

  const updated = queryClient
    .getQueryCache()
    .getAll()
    .reduce((max, q) => Math.max(max, q.state.dataUpdatedAt), 0);

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      {offline ? (
        <Animated.View
          key="offline"
          entering={FadeInUp.duration(300)}
          exiting={FadeOutUp.duration(200)}
          style={[styles.banner, styles.offline, shadow.medium]}
          accessibilityRole="alert"
        >
          <Icon name="wifioff" size={18} color={colors.white} />
          <View style={styles.flex}>
            <Text style={[styles.label, { color: colors.white }]}>{nb.state.offlineBanner}</Text>
            {updated ? <Text style={styles.sub}>{nb.state.lastUpdated(hhmm(updated))}</Text> : null}
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={checking ? nb.state.reconnecting : nb.state.retry}
            onPress={retry}
            hitSlop={12}
            style={styles.retry}
          >
            {checking ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Icon name="refresh" size={18} color={colors.white} />
            )}
          </PressableScale>
        </Animated.View>
      ) : (
        <Animated.View
          key="online"
          entering={FadeInUp.duration(300)}
          exiting={FadeOutUp.duration(200)}
          style={[styles.banner, styles.online]}
          accessibilityRole="alert"
        >
          <Icon name="check" size={18} color={colors.okText} />
          <Text style={[styles.label, styles.flex, { color: colors.okText }]}>{nb.state.online}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 100 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.m,
  },
  offline: { backgroundColor: colors.ink },
  online: { backgroundColor: colors.okTint },
  flex: { flex: 1 },
  label: { fontFamily: text.bodySemi.fontFamily, fontSize: 13.5, lineHeight: 17.5 },
  sub: { ...text.statLabel, color: colors.onInk72, marginTop: 1 },
  retry: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
