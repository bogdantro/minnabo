import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { Avatar } from './ui/Avatar';
import { BrandMark } from './BrandMark';

type AvatarInfo = { uri?: string; initials: string };

type CommonProps = {
  avatar: AvatarInfo;
  onProfilePress: () => void;
  onNotificationsPress: () => void;
  unreadNotifications?: boolean;
  testID?: string;
};

function RightCluster({
  avatar,
  onProfilePress,
  onNotificationsPress,
  unreadNotifications,
  testID,
}: CommonProps) {
  return (
    <View style={styles.right}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nb.a11y.notifications}
        hitSlop={hitSlop}
        onPress={onNotificationsPress}
        style={styles.bell}
      >
        <Icon name="bell" size={24} color="navy" />
        {unreadNotifications ? (
          <View testID={testID ? `${testID}-noti-dot` : 'noti-dot'} style={styles.dot} />
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nb.a11y.openProfile}
        onPress={onProfilePress}
      >
        <Avatar uri={avatar.uri} initials={avatar.initials} size={40} />
      </Pressable>
    </View>
  );
}

export function HomeTopBar(props: CommonProps) {
  const insets = useSafeAreaInsets();
  return (
    <View testID={props.testID} style={[styles.bar, { paddingTop: insets.top + tokens.space.sm }]}>
      <BrandMark />
      <RightCluster {...props} />
    </View>
  );
}

export type DetailTopBarProps = CommonProps & {
  title: string;
  onBack: () => void;
};

export function DetailTopBar({ title, onBack, ...rest }: DetailTopBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + tokens.space.sm }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nb.a11y.back}
        hitSlop={hitSlop}
        onPress={onBack}
      >
        <Icon name="arrow-left" size={24} color="navy" />
      </Pressable>
      <AppText variant="cardTitle" weight="bold" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      <RightCluster {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.sm,
    backgroundColor: tokens.color.bg,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.lg,
  },
  bell: {
    padding: 2,
  },
  dot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: tokens.color.cyan,
    borderWidth: 1.5,
    borderColor: tokens.color.bg,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: tokens.space.md,
  },
});
