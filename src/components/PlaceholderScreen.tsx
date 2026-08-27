import { View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon, type IconName } from './ui/Icon';

export function PlaceholderScreen({
  title,
  icon = 'clock',
  note = 'Denne siden kommer i en senere del av utviklingen.',
  showBack = true,
}: {
  title: string;
  icon?: IconName;
  note?: string;
  showBack?: boolean;
}) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      {showBack ? (
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nb.a11y.back}
            hitSlop={hitSlop}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          >
            <Icon name="arrow-left" size={24} color="navy" />
          </Pressable>
          <AppText variant="cardTitle" weight="bold" style={styles.headerTitle} numberOfLines={1}>
            {title}
          </AppText>
          <View style={styles.headerSpacer} />
        </View>
      ) : null}

      <View style={styles.center}>
        <Icon name={icon} size={32} color="navyMuted" />
        {!showBack ? (
          <AppText variant="section" weight="bold">
            {title}
          </AppText>
        ) : null}
        <AppText variant="body" color="navyMuted" align="center">
          {note}
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.md,
    gap: tokens.space.md,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: 24 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.md,
    padding: tokens.space.xxl,
  },
});
