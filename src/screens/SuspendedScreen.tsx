import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import { screenPadding } from '@/theme/theme';
import { Button, Screen, StateView } from '@/components/ui';

/** Shown after a suspended account is signed out. Login is blocked until an admin lifts it. */
export function SuspendedScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.wrap}>
        <StateView
          icon="ban"
          tone="error"
          title={nb.suspended.title}
          body={nb.suspended.body}
          actionLabel={nb.suspended.terms}
          actionIcon="file"
          onAction={() => router.push('/vilkar')}
        >
          <Button label={nb.suspended.home} variant="ghost" align="center" block={false} onPress={() => router.replace('/velkommen')} />
        </StateView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: screenPadding },
});
