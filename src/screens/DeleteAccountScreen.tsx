import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

export function DeleteAccountScreen() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.settings.deleteAccount} />
      <View style={styles.body}>
        <View style={styles.badge}>
          <Icon name="alert-triangle" size={28} color="dangerText" />
        </View>
        <ScreenTitle>{nb.settings.deleteAccount}</ScreenTitle>
        <AppText variant="body" color="navyMuted" align="center">
          {nb.settings.deleteWarning}
        </AppText>
      </View>

      <View style={styles.footer}>
        {!confirming ? (
          <Button label={nb.settings.deleteAccount} variant="secondary" onPress={() => setConfirming(true)} />
        ) : (
          <Button
            label={nb.settings.deleteConfirm}
            onPress={() => router.replace('/velkommen')}
          />
        )}
        <Button label={nb.common.cancel} variant="ghost" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.xxl,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FDECEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.space.sm,
  },
  footer: {
    padding: tokens.space.xl,
    gap: tokens.space.sm,
  },
});
