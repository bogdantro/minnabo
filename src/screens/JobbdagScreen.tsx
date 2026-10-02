import { Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import { useListing, useProfile, useProposal, useReportNoShow, useSendMessage } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { confirm } from '@/lib/confirm';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { screenPadding } from '@/theme/theme';
import { FallbackScreen } from '@/components/FallbackScreen';
import { SafeTripCard } from '@/components/SafeTripCard';
import { JobWorkspaceSection } from '@/components/JobWorkspaceSection';
import { Button, FooterRow, PaymentNote, Screen, StickyFooter, SubHeader } from '@/components/ui';

/**
 * Jobbdag – the job-day tools for an agreement (status messages, safe trip,
 * workspace, no-show, completion). Moved out of Avtalesammendrag; the
 * Jobbdag.dc.html redesign replaces this layout.
 */
export function JobbdagScreen({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const me = useCurrentUser();
  const { data: proposal, isLoading, isError, refetch } = useProposal(proposalId);
  const { data: listing } = useListing(proposal?.listingId ?? '');
  const otherId = proposal ? (proposal.fromProfileId === me.id ? proposal.toProfileId : proposal.fromProfileId) : '';
  const { data: other } = useProfile(otherId);
  const noShow = useReportNoShow();
  const sendMessage = useSendMessage(proposal?.conversationId ?? '', me.id);

  if (!proposal) {
    return <FallbackScreen status={isError ? 'error' : isLoading ? 'loading' : 'empty'} onRetry={() => refetch()} title="Jobbdag" />;
  }

  const status = (text: string) => {
    sendMessage.mutate(text);
    toast.success(nb.avtale.statusSent);
  };

  const reportNoShow = async () => {
    const ok = await confirm({
      title: nb.avtale.noShowConfirmTitle,
      message: nb.avtale.noShowConfirmBody,
      confirmLabel: nb.avtale.noShowConfirm,
      destructive: true,
    });
    if (!ok || !otherId) return;
    noShow.mutate(
      { agreementProposalId: proposalId, profileId: otherId },
      {
        onSuccess: () => toast.success(nb.avtale.noShowToast),
        onError: () => toast.error(nb.toast.genericError),
      },
    );
  };

  const phone = other?.phone?.replace(/\s/g, '');

  return (
    <View style={styles.flex}>
      <Screen
        scroll
        header={<SubHeader title={listing?.title ?? 'Jobbdag'} onBack={() => (router.canGoBack() ? router.back() : router.replace(`/avtale/${proposalId}`))} />}
      >
        <View style={styles.body}>
          <FooterRow>
            <Button label={nb.avtale.enRoute} icon="nav" variant="ghost" block={false} onPress={() => status('Jeg er på vei 🚗')} style={styles.grow} />
            <Button label={nb.avtale.arrived} icon="pin" variant="ghost" block={false} onPress={() => status('Jeg er framme 👋')} style={styles.grow} />
          </FooterRow>
          {phone ? (
            <FooterRow>
              <Button label={nb.avtale.call} icon="phone" variant="ghost" block={false} onPress={() => Linking.openURL(`tel:${phone}`)} style={styles.grow} />
              <Button label={nb.avtale.sms} icon="msg" variant="ghost" block={false} onPress={() => Linking.openURL(`sms:${phone}`)} style={styles.grow} />
            </FooterRow>
          ) : null}
          <SafeTripCard proposalId={proposalId} label={other?.displayName ?? nb.avtale.parties} />
          <JobWorkspaceSection proposalId={proposalId} />
          <PaymentNote />
          <Button label={nb.avtale.reportNoShow} variant="text" loading={noShow.isPending} onPress={reportNoShow} />
          <Button
            label={other ? nb.avtale.rebook(other.displayName) : nb.avtale.rebookGeneric}
            variant="text"
            icon="repeat"
            onPress={() => safePush(`/profil/${otherId}`)}
          />
        </View>
      </Screen>
      <StickyFooter>
        <Button label={nb.avtale.toCompletion} iconRight="check" size="lg" onPress={() => safePush(`/fullfor/${proposalId}`)} />
      </StickyFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: screenPadding, gap: 14, paddingBottom: 140, paddingTop: 8 },
  grow: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
});
