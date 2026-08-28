import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { HomeTopBar } from '@/components/TopBar';
import { StaticBottomNav } from '@/components/StaticBottomNav';
import { AppText } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StatusPill } from '@/components/ui/StatusPill';
import { safePush } from '@/lib/nav';

export function ChoiceScreen() {
  const router = useRouter();
  const me = useCurrentUser();

  return (
    <View style={styles.wrap}>
      <HomeTopBar
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        unreadNotifications
        onProfilePress={() => safePush('/profil')}
        onNotificationsPress={() => safePush('/varsler')}
      />

      <View style={styles.body}>
        <AppText variant="h1" weight="extrabold" style={styles.title}>
          {nb.leggUt.choiceHeading}
        </AppText>
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
          <Icon name="shield" size={20} color="cyan" />
          <AppText variant="meta" color="navyMuted" style={styles.footerText}>
            {nb.leggUt.choiceFooter}
          </AppText>
        </View>
      </View>

      <StaticBottomNav active="leggUt" />
    </View>
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
        {
          borderColor: tone === 'lime' ? tokens.color.limeTint : tokens.color.cyanTint,
          borderLeftColor: tokens.color[tone],
        },
        pressed && styles.choicePressed,
      ]}
    >
      <View style={styles.choiceIcon}>
        <Icon name={icon} size={52} color={tone} />
      </View>
      <View style={styles.choiceRule} />
      <View style={styles.choiceText}>
        <StatusPill label={badge} tone={tone} soft />
        <AppText variant="section" weight="extrabold">
          {title}
        </AppText>
        <AppText variant="meta" color="navyMuted">
          {subtitle}
        </AppText>
      </View>
      <Icon name="chevron-right" size={26} color={tone} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  body: { flex: 1, paddingHorizontal: tokens.space.xl, paddingTop: tokens.space.sm },
  title: { fontSize: 30, lineHeight: 36, paddingRight: 48 },
  subtitle: { marginTop: tokens.space.sm, marginBottom: tokens.space.xl },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingVertical: tokens.space.xl,
    paddingHorizontal: tokens.space.lg,
    marginBottom: tokens.space.xl,
    ...tokens.shadow.card,
  },
  choicePressed: { opacity: 0.92 },
  choiceIcon: { width: 56, alignItems: 'center' },
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
