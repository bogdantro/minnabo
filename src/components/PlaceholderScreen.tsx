import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import { AppText } from './ui/Text';
import { Icon, type IconName } from './ui/Icon';

export function PlaceholderScreen({
  title,
  icon = 'clock',
  note = 'Kommer i en senere del av utviklingen.',
}: {
  title: string;
  icon?: IconName;
  note?: string;
}) {
  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.center}>
        <Icon name={icon} size={32} color="navyMuted" />
        <AppText variant="section" weight="bold">
          {title}
        </AppText>
        <AppText variant="body" color="navyMuted" align="center">
          {note}
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.md,
    padding: tokens.space.xxl,
  },
});
