/** Replaces «Logg inn med Vipps» under `npm run test-login`. Never in a store build. */
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, screenPadding, text } from '../../src/theme/theme';
import { BrandMark } from '../../src/components/BrandMark';
import { Button, FadeUp, Note, Screen } from '../../src/components/ui';
import { testPerson, type TestPerson } from './store';

export function LoginScreen() {
  const router = useRouter();
  const enter = (person: TestPerson) => {
    testPerson.set(person);
    router.replace(person === 'youth' ? '/ung' : '/');
  };
  return (
    <Screen scroll spacer="none">
      <FadeUp style={styles.wrap}>
        <BrandMark size={40} />
        <Text style={[text.h1, styles.title]} accessibilityRole="header">
          Testinnlogging
        </Text>
        <Text style={text.body}>Bare på denne PC-en. Du ser demodata, og ingenting når ekte brukere eller databasen.</Text>
        <View style={styles.btns}>
          <Button label="Logg inn som voksen" icon="user" variant="ink" size="lg" onPress={() => enter('adult')} />
          <Button label="Logg inn som ungdom (16 år)" icon="shield" variant="ghost" size="lg" onPress={() => enter('youth')} />
        </View>
        <Note>Det du gjør, varer til du laster siden på nytt. Bilder kan ikke lastes opp i testmodus.</Note>
      </FadeUp>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: screenPadding, paddingTop: 48, gap: 14 },
  title: { marginTop: 12, color: colors.ink },
  btns: { gap: 10, marginTop: 12 },
});
