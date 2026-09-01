import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { safePush } from '@/lib/nav';
import { shareInvite } from '@/lib/share';
import { signOut, useSession } from '@/auth/session';
import { ENV } from '@/lib/env';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';

type Row = {
  label: string;
  icon: IconName;
  route?: string;
  action?: () => void | Promise<void>;
  danger?: boolean;
};

const BASE_GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: nb.settings.account,
    rows: [
      { label: nb.settings.editProfile, icon: 'user', route: '/profil/rediger' },
      { label: nb.settings.verification, icon: 'shield', route: '/verifisering' },
      { label: nb.settings.blocked, icon: 'slash', route: '/blokkerte' },
      { label: nb.trustedContacts.title, icon: 'users', route: '/trygge-kontakter' },
    ],
  },
  {
    title: nb.settings.notifications,
    rows: [{ label: nb.settings.notifications, icon: 'bell', route: '/varslinger' }],
  },
  {
    title: nb.settings.privacy,
    rows: [
      { label: nb.settings.privacy, icon: 'lock', route: '/personvern' },
      { label: nb.settings.terms, icon: 'file-text', route: '/vilkar' },
      { label: nb.settings.consentLog, icon: 'list', route: '/personvern' },
      { label: nb.settings.exportData, icon: 'download', route: '/personvern' },
    ],
  },
];

export function SettingsScreen() {
  const router = useRouter();
  const { userId } = useSession();

  const logOut = async () => {
    await signOut();
    router.replace('/velkommen');
  };

  const aboutRows: Row[] = [
    {
      label: nb.settings.inviteNeighbour,
      icon: 'user-plus',
      action: () => shareInvite(userId ?? 'app'),
    },
    { label: nb.settings.language, icon: 'globe' },
  ];
  if (__DEV__ && !ENV.useMocks) {
    aboutRows.push({ label: 'Bytt testbruker', icon: 'users', route: '/dev-switch' });
  }
  if (!ENV.useMocks) {
    aboutRows.push({ label: nb.settings.logOut, icon: 'log-out', action: logOut });
    aboutRows.push({
      label: nb.settings.deleteAccount,
      icon: 'trash-2',
      route: '/slett-konto',
      danger: true,
    });
  }

  const groups: { title: string; rows: Row[] }[] = [
    ...BASE_GROUPS,
    { title: nb.settings.about, rows: aboutRows },
  ];

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.settings.title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle>{nb.settings.title}</ScreenTitle>

        {groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <AppText variant="meta" weight="bold" color="navyMuted" style={styles.groupTitle}>
              {group.title.toUpperCase()}
            </AppText>
            <View style={styles.card}>
              {group.rows.map((row, i) => (
                <Pressable
                  key={row.label + i}
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                  disabled={!row.route && !row.action}
                  onPress={() => {
                    if (row.action) void row.action();
                    else if (row.route) safePush(row.route);
                  }}
                  style={[styles.row, i < group.rows.length - 1 && styles.rowBorder]}
                >
                  <Icon name={row.icon} size={18} color={row.danger ? 'dangerText' : 'navy'} />
                  <AppText
                    variant="body"
                    style={styles.rowLabel}
                    color={row.danger ? 'dangerText' : 'navy'}
                  >
                    {row.label}
                  </AppText>
                  {row.route || row.action ? (
                    <Icon name="chevron-right" size={16} color="navyMuted" />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.lg, paddingBottom: tokens.space.xxxl },
  group: { gap: tokens.space.sm },
  groupTitle: { letterSpacing: 0.6 },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    ...tokens.shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: tokens.color.line },
  rowLabel: { flex: 1 },
});
