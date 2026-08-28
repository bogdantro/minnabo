import { useNetworkState } from 'expo-network';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

/**
 * App-wide connectivity banner. Mounted once at the root; shows only while the
 * device reports no usable connection. All data is served from the in-memory
 * mock layer, so the app keeps working — the banner just sets expectations.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const net = useNetworkState();

  // `undefined` while the first probe is in flight — treat as online.
  const offline =
    net.isConnected === false || net.isInternetReachable === false;

  if (!offline) return null;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + tokens.space.xs }]} accessibilityRole="alert">
      <Icon name="wifi-off" size={14} color="white" />
      <AppText variant="meta" weight="bold" color="white">
        {nb.state.offlineBanner}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.sm,
    paddingBottom: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    backgroundColor: tokens.color.navy,
  },
});
