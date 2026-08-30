import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { formatFriendlyDate } from '@/lib/calendar';
import { useListing, useStartConversation } from '@/api/queries';
import { apiClient } from '@/api/client';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { PageHeader } from '@/components/TopBar';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { AmountField } from '@/components/ui/AmountField';
import { DateField } from '@/components/ui/DateField';
import { TimeField } from '@/components/ui/TimeField';
import { Button } from '@/components/ui/Button';
import { FallbackScreen } from '@/components/FallbackScreen';

export function SendProposalScreen({
  listingId,
  mode,
}: {
  listingId: string;
  mode: 'give' | 'request';
}) {
  const router = useRouter();
  const { data: listing, isLoading, isError, refetch } = useListing(listingId);
  const startConversation = useStartConversation();

  const [price, setPrice] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [caveats, setCaveats] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isGive = mode === 'give';

  if (!listing) {
    return (
      <FallbackScreen
        status={isError ? 'error' : isLoading ? 'loading' : 'empty'}
        onRetry={() => refetch()}
        title={isGive ? nb.proposalForm.giveTitle : nb.proposalForm.requestTitle}
      />
    );
  }

  const submit = async () => {
    const kroner = Number(price.replace(/\s/g, '').replace(',', '.'));
    if (isGive && (!Number.isFinite(kroner) || kroner <= 0)) {
      setError(nb.proposalForm.priceRequired);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const conv = await apiClient.startConversationForListing(listing.id);
      if (isGive) {
        const scheduledText = [
          date ? formatFriendlyDate(date) : null,
          time ? `kl. ${time}` : null,
        ]
          .filter(Boolean)
          .join(' ');
        await apiClient.sendProposal({
          conversationId: conv.id,
          listingId: listing.id,
          priceAmountMinor: Math.round(kroner * 100),
          message: message.trim() || undefined,
          scheduledText: scheduledText || undefined,
          caveats: caveats.trim() || undefined,
        });
        haptics.success();
        toast.success(nb.proposalForm.sent);
      } else {
        await apiClient.sendMessage(
          conv.id,
          message.trim() || 'Hei! Kan du sende meg et konkret tilbud på denne jobben?',
        );
        toast.success(nb.proposalForm.requestSent);
      }
      router.replace(`/chat/${conv.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : nb.state.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoider>
      <PageHeader title={isGive ? nb.proposalForm.giveTitle : nb.proposalForm.requestTitle} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle>{isGive ? nb.proposalForm.giveTitle : nb.proposalForm.requestTitle}</ScreenTitle>
        <AppText variant="body" color="navyMuted">
          {isGive ? nb.proposalForm.intro : nb.proposalForm.requestIntro}
        </AppText>
        <AppText variant="meta" weight="bold">
          {listing.title}
        </AppText>

        {isGive ? (
          <>
            <View style={styles.field}>
              <AppText variant="meta" weight="bold">
                {nb.proposalForm.priceLabel}
              </AppText>
              <AmountField
                value={price}
                onChange={setPrice}
                accessibilityLabel={nb.proposalForm.priceLabel}
              />
            </View>
            <View style={styles.whenRow}>
              <View style={styles.whenDate}>
                <DateField label={nb.proposalForm.whenLabel} value={date} onChange={setDate} />
              </View>
              <View style={styles.whenTime}>
                <TimeField label={nb.common.time} value={time} onChange={setTime} />
              </View>
            </View>
          </>
        ) : null}

        <TextField
          label={nb.proposalForm.messageLabel}
          value={message}
          onChangeText={setMessage}
          multiline
        />

        {isGive ? (
          <TextField
            label={nb.proposalForm.caveatsLabel}
            value={caveats}
            onChangeText={setCaveats}
            multiline
          />
        ) : null}

        {error ? (
          <AppText variant="meta" color="dangerText">
            {error}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={isGive ? nb.proposalForm.send : nb.proposalForm.sendRequest}
          onPress={submit}
          loading={busy || startConversation.isPending}
        />
        <AppText variant="meta" color="navyMuted" align="center">
          {nb.listingDetail.priceNoteTask}
        </AppText>
      </View>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.xl, gap: tokens.space.md, paddingBottom: tokens.space.xxl },
  field: { gap: 6 },
  whenRow: { flexDirection: 'row', gap: tokens.space.md },
  whenDate: { flex: 2 },
  whenTime: { flex: 1 },
  footer: {
    padding: tokens.space.xl,
    gap: tokens.space.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
