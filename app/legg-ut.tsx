import { Stack, router } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

/**
 * "Legg ut" always opens this choice screen first (spec §2.6, §8).
 * The two stepwise forms arrive in slice 5.
 */
export default function LeggUtRoute() {
  return (
    <SafeAreaView style={styles.wrap}>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <View style={styles.header}>
        <AppText variant="h1" weight="extrabold">
          {nb.tabs.leggUt}
        </AppText>
        <AppText variant="body" color="navyMuted">
          Hva vil du gjøre?
        </AppText>
      </View>

      <Card style={styles.choice} onPress={() => router.push('/legg-ut/trenger-jobb')}>
        <Icon name="tool" size={26} color="cyan" />
        <AppText variant="cardTitle" weight="bold">
          Jeg trenger en jobb utført
        </AppText>
        <AppText variant="meta" color="navyMuted">
          Legg ut et oppdrag og motta tilbud fra folk i nærheten.
        </AppText>
      </Card>

      <Card style={styles.choice} onPress={() => router.push('/legg-ut/tilby-jobb')}>
        <Icon name="briefcase" size={26} color="lime" />
        <AppText variant="cardTitle" weight="bold">
          Jeg ønsker å utføre en jobb
        </AppText>
        <AppText variant="meta" color="navyMuted">
          Vis at du er tilgjengelig for småjobber i ditt område.
        </AppText>
      </Card>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: tokens.color.bg,
    padding: tokens.space.xl,
    gap: tokens.space.lg,
  },
  header: { gap: tokens.space.xs, marginBottom: tokens.space.sm },
  choice: { gap: tokens.space.sm, padding: tokens.space.xl },
});
