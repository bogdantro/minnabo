import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useUnreadNotificationCount } from '@/api/queries';
import { MainHeader, SubHeader } from './ui/Layout';
import { IconButton } from './ui/IconButton';

type AvatarInfo = { uri?: string; initials: string };

type RightClusterProps = {
  avatar: AvatarInfo;
  onProfilePress: () => void;
  onNotificationsPress: () => void;
  /** override the live unread count (tests only) */
  unreadNotifications?: boolean;
  testID?: string;
};

function useUnread(override?: boolean): number {
  const live = useUnreadNotificationCount();
  return override === undefined ? live : override ? 1 : 0;
}

/** `.topbar` on every main screen: logo + "MinNabo" left, bell (dot) → Varsler, avatar → Profil. */
export function HomeTopBar({ avatar, onProfilePress, onNotificationsPress, unreadNotifications, testID }: RightClusterProps) {
  const router = useRouter();
  const count = useUnread(unreadNotifications);
  return (
    <View testID={testID}>
      <MainHeader
        initials={avatar.initials}
        avatarUri={avatar.uri}
        unread={count > 0}
        unreadCount={count}
        dotTestID={testID ? `${testID}-noti-dot` : 'noti-dot'}
        onBell={onNotificationsPress}
        onAvatar={onProfilePress}
        onLogo={() => router.replace('/')}
      />
    </View>
  );
}

export type PageHeaderProps = {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  /** Right slot, e.g. an IconButton "Flere valg". */
  right?: ReactNode;
  /** Use an X instead of the back arrow (modal flows). */
  close?: boolean;
  /** @deprecated the redesign sub-header has no logo. Ignored. */
  logoOnly?: boolean;
};

/** `.subbar` for every non-tab screen: back · centred title · optional action. */
export function PageHeader({ title, onBack, showBack = true, right, close }: PageHeaderProps) {
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return <SubHeader title={title} onBack={showBack ? back : undefined} close={close} right={right} />;
}

/** Sub-header with the bell on the right (detail screens that still show notifications). */
export function DetailTopBar({
  title,
  onBack,
  onNotificationsPress,
  unreadNotifications,
  testID,
}: PageHeaderProps & RightClusterProps) {
  const count = useUnread(unreadNotifications);
  return (
    <PageHeader
      title={title}
      onBack={onBack}
      right={
        <View style={styles.bell}>
          <IconButton
            icon="bell"
            accessibilityLabel={count > 0 ? `Varsler, ${count} uleste` : 'Varsler'}
            dot={count > 0}
            dotTestID={testID ? `${testID}-noti-dot` : 'noti-dot'}
            onPress={onNotificationsPress}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  bell: { alignItems: 'flex-end' },
});
