import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import { PageHeader } from './TopBar';
import { ScreenState, type ScreenStatus } from './ui/ScreenState';

/**
 * A loading / error / empty screen that still shows the logo and a back arrow,
 * used by route wrappers before their real screen has data.
 */
export function FallbackScreen({
  status,
  onRetry,
  emptyText,
  title,
}: {
  status: ScreenStatus;
  onRetry?: () => void;
  emptyText?: string;
  title?: string;
}) {
  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={title} />
      <View style={styles.body}>
        <ScreenState status={status} onRetry={onRetry} emptyText={emptyText} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  body: { flex: 1 },
});
