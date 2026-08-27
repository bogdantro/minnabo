import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { Avatar } from './ui/Avatar';

export function ChatHeader({
  name,
  avatarUri,
  initials,
  online,
  onBack,
  onMenu,
}: {
  name: string;
  avatarUri?: string;
  initials: string;
  online?: boolean;
  onBack: () => void;
  onMenu: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + tokens.space.sm }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={nb.a11y.back} hitSlop={hitSlop} onPress={onBack}>
        <Icon name="arrow-left" size={24} color="navy" />
      </Pressable>

      <Avatar uri={avatarUri} initials={initials} size={40} online={online} />

      <View style={styles.identity}>
        <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
          {name}
        </AppText>
        {online ? (
          <View style={styles.statusRow}>
            <View style={styles.dot} />
            <AppText variant="meta" color="navyMuted">
              {nb.chat.activeNow}
            </AppText>
          </View>
        ) : null}
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel={nb.chat.reportMenu} hitSlop={hitSlop} onPress={onMenu}>
        <Icon name="more-vertical" size={22} color="navy" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    paddingBottom: tokens.space.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.line,
    backgroundColor: tokens.color.bg,
  },
  identity: { flex: 1, gap: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: tokens.color.lime },
});
