import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useCompletion, useConfirmCompletion } from '@/api/queries';
import { useSession } from '@/auth/session';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { confirm as confirmDialog } from '@/lib/confirm';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

export function CompletionScreen({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const me = useSession().userId ?? '';
  const { data: confirmations } = useCompletion(proposalId);
  const confirm = useConfirmCompletion(proposalId);

  const list = confirmations ?? [];
  const iConfirmed = list.some((c) => c.byProfileId === me);
  const bothConfirmed = list.length >= 2;

  const doConfirm = () => {
    if (!me) return;
    confirm.mutate(me, {
      onSuccess: (next) => {
        haptics.success();
        if (next.length >= 2) toast.success(nb.completion.bothConfirmed);
      },
      onError: () => toast.error(nb.toast.genericError),
    });
  };

  const openSupport = async () => {
    const ok = await confirmDialog({
      title: nb.completion.disagree,
      message: nb.completion.disagreeBody,
      confirmLabel: nb.completion.contactSupport,
    });
    if (ok) router.push('/sikkerhet');
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.completion.title} />

      <View style={styles.body}>
        <View style={[styles.badge, bothConfirmed && styles.badgeDone]}>
          <Icon name={bothConfirmed ? 'check' : 'flag'} size={30} color="navy" />
        </View>

        <ScreenTitle>{bothConfirmed ? nb.completion.bothConfirmed : nb.completion.heading}</ScreenTitle>
        <AppText variant="body" color="navyMuted" align="center">
          {bothConfirmed
            ? nb.completion.bothConfirmedBody
            : iConfirmed
              ? nb.completion.waitingOther
              : nb.completion.body}
        </AppText>

        <View style={styles.actions}>
          {!iConfirmed && !bothConfirmed ? (
            <Button
              label={nb.completion.confirm}
              onPress={doConfirm}
              loading={confirm.isPending}
            />
          ) : null}

          {bothConfirmed ? (
            <Button
              label={nb.completion.reviewCta}
              onPress={() => router.replace(`/vurder/${proposalId}`)}
            />
          ) : null}

          <Button
            label={nb.completion.disagree}
            variant="secondary"
            onPress={openSupport}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.xxl,
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: tokens.color.cyanTint,
    borderWidth: 2,
    borderColor: tokens.color.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.space.sm,
  },
  badgeDone: { backgroundColor: tokens.color.limeTint, borderColor: tokens.color.lime },
  actions: { alignSelf: 'stretch', gap: tokens.space.sm, marginTop: tokens.space.lg },
});
