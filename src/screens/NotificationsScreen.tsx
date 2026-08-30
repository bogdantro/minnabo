import { FlatList, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppNotification, NotificationKind } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '@/api/queries';
import { formatRelative } from '@/lib/datetime';
import { safePush } from '@/lib/nav';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ScreenState, type ScreenStatus } from '@/components/ui/ScreenState';

const iconFor: Record<NotificationKind, IconName> = {
  NEW_MESSAGE: 'message-circle',
  NEW_OFFER: 'tag',
  OFFER_CHANGED: 'edit-3',
  OFFER_WITHDRAWN: 'x-circle',
  OFFER_ACCEPTED: 'check-circle',
  OFFER_DECLINED: 'x-circle',
  AGREED_TIME: 'calendar',
  COMPLETION_REQUESTED: 'flag',
  REVIEW_RECEIVED: 'star',
  MODERATION: 'shield',
};

const notificationIcon = (kind: NotificationKind): IconName => iconFor[kind] ?? 'bell';

export function NotificationsScreen() {
  const { data, isLoading, isError, refetch } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();
  const items = data ?? [];

  let status: ScreenStatus = 'ready';
  if (isLoading) status = 'loading';
  else if (isError) status = 'error';
  else if (items.length === 0) status = 'empty';

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.notifications.title} />

      <View style={styles.header}>
        <ScreenTitle>{nb.notifications.title}</ScreenTitle>
        {items.some((n) => !n.read) ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => markAll.mutate()}
            hitSlop={8}
          >
            <AppText variant="meta" weight="bold" color="cyan">
              {nb.notifications.markAllRead}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {status === 'ready' ? (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Row
              notification={item}
              onOpen={() => {
                if (!item.read) markOne.mutate(item.id);
                if (item.route) safePush(item.route);
              }}
            />
          )}
        />
      ) : (
        <ScreenState status={status} onRetry={() => refetch()} emptyText={nb.notifications.empty} />
      )}
    </SafeAreaView>
  );
}

function Row({
  notification,
  onOpen,
}: {
  notification: AppNotification;
  onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={notification.title}
      onPress={onOpen}
      style={[styles.row, !notification.read && styles.unread]}
    >
      <View style={styles.iconWrap}>
        <Icon name={notificationIcon(notification.kind)} size={18} color="navy" />
      </View>
      <View style={styles.body}>
        <AppText variant="body" weight={notification.read ? 'regular' : 'bold'}>
          {notification.title}
        </AppText>
        <AppText variant="meta" color="navyMuted" numberOfLines={2}>
          {notification.body}
        </AppText>
        <AppText variant="meta" color="navyMuted">
          {formatRelative(notification.createdAt)}
        </AppText>
      </View>
      {!notification.read ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.md,
  },
  list: { paddingHorizontal: tokens.space.xl, paddingBottom: tokens.space.xxxl, gap: tokens.space.sm },
  row: {
    flexDirection: 'row',
    gap: tokens.space.md,
    alignItems: 'center',
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
  },
  unread: { borderColor: tokens.color.lime },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: tokens.color.lime },
});
