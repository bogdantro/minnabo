import { View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StatusPill } from '@/components/ui/StatusPill';

export function ChoiceScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader
        logoOnly
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      <View style={styles.body}>
        <ScreenTitle style={styles.title}>{nb.leggUt.choiceHeading}</ScreenTitle>
        <AppText variant="body" color="navyMuted" style={styles.subtitle}>
          {nb.leggUt.choiceSubtitle}
        </AppText>

        <Choice
          icon="clipboard"
          tone="lime"
          badge={nb.leggUt.needBadge}
          title={nb.leggUt.needTitle}
          subtitle={nb.leggUt.needSubtitle}
          onPress={() => router.push('/legg-ut/trenger-jobb')}
        />
        <Choice
          icon="tool"
          tone="cyan"
          badge={nb.leggUt.offerBadge}
          title={nb.leggUt.offerTitle}
          subtitle={nb.leggUt.offerSubtitle}
          onPress={() => router.push('/legg-ut/tilby-jobb')}
        />

        <View style={styles.footer}>
          <Icon name="shield" size={18} color="cyan" />
          <AppText variant="meta" color="navyMuted" style={styles.footerText}>
            {nb.leggUt.choiceFooter}
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Choice({
  icon,
  tone,
  badge,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  tone: 'lime' | 'cyan';
  badge: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        { borderLeftColor: tokens.color[tone] },
        pressed && styles.choicePressed,
      ]}
    >
      <Icon name={icon} size={44} color={tone} />
      <View style={styles.choiceRule} />
      <View style={styles.choiceText}>
        <StatusPill label={badge} tone={tone} soft />
        <AppText variant="cardTitle" weight="bold">
          {title}
        </AppText>
        <AppText variant="meta" color="navyMuted">
          {subtitle}
        </AppText>
      </View>
      <Icon name="chevron-right" size={24} color={tone} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  body: { flex: 1, paddingHorizontal: tokens.space.xl, paddingTop: tokens.space.sm },
  title: { paddingRight: 56 },
  subtitle: { marginTop: tokens.space.xs, marginBottom: tokens.space.xl },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderLeftWidth: 4,
    paddingVertical: tokens.space.xl,
    paddingHorizontal: tokens.space.lg,
    marginBottom: tokens.space.lg,
    ...tokens.shadow.card,
  },
  choicePressed: { opacity: 0.92 },
  choiceRule: { width: 1, alignSelf: 'stretch', backgroundColor: tokens.color.line },
  choiceText: { flex: 1, gap: tokens.space.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space.sm,
    marginTop: tokens.space.sm,
  },
  footerText: { flex: 1 },
});
