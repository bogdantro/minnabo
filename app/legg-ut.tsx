import { useRouter } from 'expo-router';
import { View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from '@/components/ui/Text';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/TopBar';

/**
 * "Legg ut" always opens this choice screen first (spec §2.6, §8).
 */
export default function LeggUtRoute() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader />

      <View style={styles.body}>
        <View style={styles.intro}>
          <ScreenTitle>{nb.leggUt.choiceHeading}</ScreenTitle>
          <AppText variant="body" color="navyMuted">
            {nb.leggUt.choiceSubtitle}
          </AppText>
        </View>

        <Choice
          icon="tool"
          iconColor="cyan"
          title={nb.leggUt.needTitle}
          subtitle={nb.leggUt.needSubtitle}
          onPress={() => router.push('/legg-ut/trenger-jobb')}
        />
        <Choice
          icon="briefcase"
          iconColor="lime"
          title={nb.leggUt.offerTitle}
          subtitle={nb.leggUt.offerSubtitle}
          onPress={() => router.push('/legg-ut/tilby-jobb')}
        />
      </View>
    </SafeAreaView>
  );
}

function Choice({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
}: {
  icon: 'tool' | 'briefcase';
  iconColor: 'cyan' | 'lime';
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
    >
      <View
        style={[
          styles.choiceIcon,
          { backgroundColor: tokens.color[iconColor === 'cyan' ? 'cyanTint' : 'limeTint'] },
        ]}
      >
        <Icon name={icon} size={24} color={iconColor} />
      </View>
      <AppText variant="cardTitle" weight="bold">
        {title}
      </AppText>
      <AppText variant="meta" color="navyMuted">
        {subtitle}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  body: { flex: 1, padding: tokens.space.xl, gap: tokens.space.lg },
  intro: { gap: tokens.space.xs, marginBottom: tokens.space.sm },
  choice: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.xl,
    gap: tokens.space.sm,
    ...tokens.shadow.card,
  },
  choicePressed: { opacity: 0.92 },
  choiceIcon: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.space.xs,
  },
});
