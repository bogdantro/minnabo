import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useListing, useStartConversation } from '@/api/queries';
import { apiClient } from '@/api/client';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
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
  const [when, setWhen] = useState('');
  const [message, setMessage] = useState('');
  const [caveats, setCaveats] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!listing) {
    return (
      <FallbackScreen
        status={isError ? 'error' : isLoading ? 'loading' : 'empty'}
        onRetry={() => refetch()}
        title={mode === 'give' ? nb.proposalForm.giveTitle : nb.proposalForm.requestTitle}
      />
    );
  }

  const submit = async () => {
    if (mode === 'give' && !price.trim()) {
      setError(nb.proposalForm.priceRequired);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const conv = await apiClient.startConversationForListing(listing.id);
      if (mode === 'give') {
        const kroner = Number(price.replace(/\s/g, '').replace(',', '.'));
        await apiClient.sendProposal({
          conversationId: conv.id,
          listingId: listing.id,
          priceAmountMinor: Math.round(kroner * 100),
          message: message.trim() || undefined,
          scheduledText: when.trim() || undefined,
          caveats: caveats.trim() || undefined,
        });
      } else {
        await apiClient.sendMessage(
          conv.id,
          message.trim() || 'Hei! Kan du sende meg et konkret tilbud på denne jobben?',
        );
      }
      router.replace(`/chat/${conv.id}`);
    } finally {
      setBusy(false);
    }
  };

  const isGive = mode === 'give';

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
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
            <TextField
              label={nb.proposalForm.priceLabel}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />
            <TextField label={nb.proposalForm.whenLabel} value={when} onChangeText={setWhen} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.md, paddingBottom: tokens.space.xxl },
  footer: {
    padding: tokens.space.xl,
    gap: tokens.space.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
