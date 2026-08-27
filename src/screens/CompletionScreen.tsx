import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useCompletion, useConfirmCompletion } from '@/api/queries';
import { profileRepository } from '@/data/profileRepository';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

export function CompletionScreen({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const me = profileRepository.currentUserId;
  const { data: confirmations } = useCompletion(proposalId);
  const confirm = useConfirmCompletion(proposalId);

  const list = confirmations ?? [];
  const iConfirmed = list.some((c) => c.byProfileId === me);
  const bothConfirmed = list.length >= 2;

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
            ? nb.completion.bothConfirmed
            : iConfirmed
              ? nb.completion.waitingOther
              : nb.completion.body}
        </AppText>

        <View style={styles.actions}>
          {!iConfirmed && !bothConfirmed ? (
            <Button
              label={nb.completion.confirm}
              onPress={() => confirm.mutate(me)}
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
            onPress={() => router.push('/sikkerhet')}
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
