import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useBlockedProfileIds, useToggleBlock, useProfile } from '@/api/queries';
import { confirm } from '@/lib/confirm';
import { toast } from '@/lib/toast';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ScreenState } from '@/components/ui/ScreenState';

export function BlockedListScreen() {
  const { data: ids, isLoading, isError, refetch } = useBlockedProfileIds();
  const toggle = useToggleBlock();

  const unblock = async (profileId: string) => {
    const ok = await confirm({
      title: nb.safety.unblockConfirmTitle,
      message: nb.safety.unblockConfirmBody,
      confirmLabel: nb.safety.unblock,
    });
    if (!ok) return;
    toggle.mutate(profileId, {
      onSuccess: () => toast.success(nb.safety.unblocked),
      onError: () => toast.error(nb.toast.genericError),
    });
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.safety.blockedListTitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle>{nb.safety.blockedListTitle}</ScreenTitle>
        <AppText variant="body" color="navyMuted">
          {nb.safety.blockedListBody}
        </AppText>

        {isLoading || isError ? (
          <ScreenState status={isError ? 'error' : 'loading'} onRetry={() => refetch()} />
        ) : (ids ?? []).length === 0 ? (
          <View style={styles.empty}>
            <Icon name="slash" size={22} color="navyMuted" />
            <AppText variant="body" color="navyMuted">
              {nb.safety.noBlocked}
            </AppText>
          </View>
        ) : (
          <View style={styles.list}>
            {(ids ?? []).map((id) => (
              <BlockedRow
                key={id}
                profileId={id}
                pending={toggle.isPending && toggle.variables === id}
                onUnblock={() => unblock(id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BlockedRow({
  profileId,
  pending,
  onUnblock,
}: {
  profileId: string;
  pending: boolean;
  onUnblock: () => void;
}) {
  const { data: profile } = useProfile(profileId);
  return (
    <View style={styles.row}>
      <Avatar uri={profile?.avatarUrl} initials={profile?.initials ?? '?'} size={40} ring={false} />
      <View style={styles.rowBody}>
        <AppText variant="cardTitle" weight="bold" numberOfLines={1}>
          {profile?.displayName ?? '…'}
        </AppText>
        {profile?.location.place ? (
          <AppText variant="meta" color="navyMuted">
            {profile.location.place}
          </AppText>
        ) : null}
      </View>
      <Button label={nb.safety.unblock} variant="secondary" onPress={onUnblock} loading={pending} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.md, paddingBottom: tokens.space.xxxl },
  list: { gap: tokens.space.sm, marginTop: tokens.space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
    ...tokens.shadow.card,
  },
  rowBody: { flex: 1, gap: 1 },
  empty: {
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingVertical: tokens.space.xxxl,
  },
});
