import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { formatPrice } from '@/domain/price';
import { profileRepository } from '@/data/profileRepository';
import { chatRepository } from '@/data/chatRepository';
import { useProposal, useRespondToProposal } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { safePush } from '@/lib/nav';
import { DetailTopBar } from '@/components/TopBar';
import { FallbackScreen } from '@/components/FallbackScreen';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { InfoCard, InfoRow } from '@/components/ui/InfoCard';
import { InfoBox } from '@/components/ui/InfoBox';
import { StatusPill } from '@/components/ui/StatusPill';
import { ProfileCard } from '@/components/ProfileCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { TextField } from '@/components/ui/TextField';

export function TilbudDetaljScreen({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const me = useCurrentUser();
  const { data: proposal, isLoading, isError, refetch } = useProposal(proposalId);
  const respond = useRespondToProposal(proposal?.conversationId ?? '');
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');

  if (!proposal) {
    return (
      <FallbackScreen
        status={isError ? 'error' : isLoading ? 'loading' : 'empty'}
        onRetry={() => refetch()}
        title={nb.tilbud.detailTitle}
      />
    );
  }

  const from = profileRepository.getProfile(proposal.fromProfileId);
  const isRecipient = proposal.toProfileId === me.id;
  const canAct = isRecipient && (proposal.status === 'SENT' || proposal.status === 'REVISION_PENDING');

  const accept = () =>
    respond.mutate(
      { proposalId, event: 'ACCEPT', actor: 'RECIPIENT' },
      { onSuccess: () => router.replace(`/avtale/${proposalId}`) },
    );

  const decline = () =>
    respond.mutate(
      { proposalId, event: 'DECLINE', actor: 'RECIPIENT' },
      { onSuccess: () => router.back() },
    );

  const requestRevision = () => {
    respond.mutate(
      { proposalId, event: 'REQUEST_REVISION', actor: 'RECIPIENT' },
      {
        onSuccess: () => {
          if (revisionNote.trim()) {
            chatRepository.sendMessage(
              proposal.conversationId,
              `${nb.tilbud.revisionRequested}: ${revisionNote.trim()}`,
            );
          }
          setRevisionOpen(false);
          router.replace(`/chat/${proposal.conversationId}`);
        },
      },
    );
  };

  const statusPill =
    proposal.status === 'ACCEPTED'
      ? { label: nb.tilbud.accepted, tone: 'lime' as const }
      : proposal.status === 'DECLINED'
        ? { label: nb.tilbud.declined, tone: 'neutral' as const }
        : proposal.status === 'REVISION_PENDING'
          ? { label: nb.tilbud.revisionPending, tone: 'cyan' as const }
          : null;

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <DetailTopBar
        title={nb.tilbud.detailTitle}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/tilbud'))}
        avatar={{ uri: me.avatarUrl, initials: me.initials }}
        unreadNotifications
        onProfilePress={() => safePush('/profil')}
        onNotificationsPress={() => safePush('/varsler')}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headRow}>
          <ScreenTitle>{formatPrice(proposal.price)}</ScreenTitle>
          {statusPill ? <StatusPill label={statusPill.label} tone={statusPill.tone} /> : null}
        </View>
        <AppText variant="meta" color="navyMuted">
          {nb.tilbud.proposedPrice}
        </AppText>

        <InfoCard>
          {proposal.scheduledText ? (
            <InfoRow icon="calendar" label={nb.tilbud.when} value={proposal.scheduledText} />
          ) : null}
          {proposal.caveats ? (
            <InfoRow icon="alert-circle" label={nb.tilbud.caveats} value={proposal.caveats} last />
          ) : null}
        </InfoCard>

        {proposal.message ? (
          <View style={styles.section}>
            <AppText variant="cardTitle" weight="bold">
              {nb.tilbud.messageFromProvider}
            </AppText>
            <AppText variant="body" color="navyMuted">
              {proposal.message}
            </AppText>
          </View>
        ) : null}

        {from ? (
          <ProfileCard
            profile={from}
            variant="owner"
            onPress={() => safePush(`/profil/${from.id}`)}
          />
        ) : null}

        <InfoBox icon="shield">{nb.tilbud.priceInfoNote}</InfoBox>
      </ScrollView>

      <View style={styles.footer}>
        {canAct ? (
          <>
            <Button label={nb.tilbud.accept} onPress={accept} loading={respond.isPending} iconRight="check" />
            <View style={styles.footerRow}>
              <Button
                label={nb.tilbud.requestRevision}
                variant="secondary"
                onPress={() => setRevisionOpen(true)}
                style={styles.footerBtn}
              />
              <Button
                label={nb.tilbud.decline}
                variant="ghost"
                onPress={decline}
                style={styles.footerBtn}
              />
            </View>
          </>
        ) : (
          <Button
            label={nb.tilbud.openChat}
            variant="secondary"
            onPress={() => safePush(`/chat/${proposal.conversationId}`)}
          />
        )}
      </View>

      <BottomSheet
        visible={revisionOpen}
        onClose={() => setRevisionOpen(false)}
        title={nb.tilbud.revisionTitle}
        heightRatio={0.55}
      >
        <AppText variant="body" color="navyMuted" style={styles.sheetIntro}>
          {nb.tilbud.revisionSub}
        </AppText>
        <TextField
          label={nb.tilbud.revisionNote}
          value={revisionNote}
          onChangeText={setRevisionNote}
          multiline
          placeholder={nb.tilbud.revisionPlaceholder}
        />
        <Button
          label={nb.tilbud.sendRevisionRequest}
          onPress={requestRevision}
          loading={respond.isPending}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.md, paddingBottom: tokens.space.xxl },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.md },
  section: { gap: tokens.space.xs },
  footer: {
    padding: tokens.space.xl,
    gap: tokens.space.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
  footerRow: { flexDirection: 'row', gap: tokens.space.md },
  footerBtn: { flex: 1 },
  sheetIntro: { marginBottom: tokens.space.md },
});
