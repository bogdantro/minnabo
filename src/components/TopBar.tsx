import type { ReactNode } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens, hitSlop } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { Avatar } from './ui/Avatar';
import { BrandMark } from './BrandMark';

type AvatarInfo = { uri?: string; initials: string };

type RightClusterProps = {
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
}: RightClusterProps) {
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
        <Avatar uri={avatar.uri} initials={avatar.initials} size={38} />
      </Pressable>
    </View>
  );
}

/** Header for the main tab screens: logo + wordmark left, bell + profile right. */
export function HomeTopBar(props: RightClusterProps) {
  const insets = useSafeAreaInsets();
  return (
    <View testID={props.testID} style={[styles.bar, { paddingTop: insets.top + tokens.space.sm }]}>
      <BrandMark />
      <RightCluster {...props} />
    </View>
  );
}

export type PageHeaderProps = {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: ReactNode;
  /** show only the logo icon (no wordmark) */
  logoOnly?: boolean;
};

/**
 * Header for every non-tab screen: back arrow + MinNabo logo, always.
 * Optionally a centered title and a right-side node.
 */
export function PageHeader({ title, onBack, showBack = true, right, logoOnly = false }: PageHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  return (
    <View style={[styles.bar, { paddingTop: insets.top + tokens.space.sm }]}>
      <View style={styles.leftGroup}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nb.a11y.back}
            hitSlop={hitSlop}
            onPress={back}
          >
            <Icon name="arrow-left" size={24} color="navy" />
          </Pressable>
        ) : null}
        <BrandMark size={26} showWordmark={!title && !logoOnly} />
      </View>

      {title ? (
        <AppText variant="cardTitle" weight="bold" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
      ) : (
        <View style={styles.title} />
      )}

      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

/** Header for listing detail / offer detail: back + logo + title + bell + profile. */
export function DetailTopBar({
  title,
  onBack,
  ...rest
}: PageHeaderProps & RightClusterProps) {
  return <PageHeader title={title} onBack={onBack} right={<RightCluster {...rest} />} />;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.lg,
    backgroundColor: tokens.color.bg,
    gap: tokens.space.md,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
  },
  rightSlot: {
    minWidth: 24,
    alignItems: 'flex-end',
  },
  bell: { padding: 2 },
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
  },
});
