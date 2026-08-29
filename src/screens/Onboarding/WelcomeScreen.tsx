import { View, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { ENV } from '@/lib/env';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';

const logo = require('../../../assets/logo-icon.png');

export function WelcomeScreen() {
  const router = useRouter();
  const start = () => router.replace(ENV.useMocks ? '/' : '/logg-inn');
  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.hero}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <AppText variant="h1" weight="extrabold" align="center">
          {nb.onboarding.welcomeTitle}
        </AppText>
        <AppText variant="body" color="navyMuted" align="center">
          {nb.onboarding.tagline}
        </AppText>
        <AppText variant="meta" color="navyMuted" align="center">
          {nb.onboarding.valueProp}
        </AppText>
      </View>

      <View style={styles.footer}>
        <Button label={nb.onboarding.getStarted} onPress={start} />
        <Button label={nb.onboarding.haveAccount} variant="ghost" onPress={start} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg, padding: tokens.space.xl },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: tokens.space.md },
  logo: { width: 96, height: 96, marginBottom: tokens.space.md },
  footer: { gap: tokens.space.sm },
});
