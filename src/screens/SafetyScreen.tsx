import { useState } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import type { ReportTargetType } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import {
  profileKeys,
  useBlockedProfileIds,
  useProfile,
  useSubmitReport,
  useToggleBlock,
} from '@/api/queries';
import { apiClient } from '@/api/client';
import { toast } from '@/lib/toast';
import { confirm } from '@/lib/confirm';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { StatusPill } from '@/components/ui/StatusPill';

export function SafetyScreen({
  targetType = 'USER',
  targetProfileId,
  targetId,
}: {
  targetType?: ReportTargetType;
  targetProfileId?: string;
  targetId?: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);

  const profileId = targetProfileId ?? '';
  const { data: target } = useProfile(profileId);
  const { data: blockedIds = [] } = useBlockedProfileIds();
  const toggle = useToggleBlock();
  const report = useSubmitReport();

  const isBlocked = blockedIds.includes(profileId);
  const toggleBlock = async () => {
    if (!isBlocked) {
      const ok = await confirm({
        title: nb.safety.blockConfirmTitle,
        message: nb.safety.blockConfirmBody,
        confirmLabel: nb.safety.block,
        destructive: true,
      });
      if (!ok) return;
    }
    toggle.mutate(profileId, {
      onSuccess: () => toast.success(isBlocked ? nb.toast.unblocked : nb.toast.blocked),
      onError: () => toast.error(nb.toast.genericError),
    });
  };

  const blockedProfiles = useQueries({
    queries: blockedIds.map((id) => ({
      queryKey: profileKeys.profile(id),
      queryFn: () => apiClient.getProfile(id),
    })),
  });
  const blockedList = blockedProfiles
    .map((q) => q.data)
    .filter((p): p is NonNullable<typeof p> => !!p);

  const submit = () => {
    if (!reason) return;
    report.mutate(
      {
        targetType,
        targetId: targetId ?? profileId,
        reason,
        details: details.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSent(true);
          toast.success(nb.toast.reported);
        },
        onError: () => toast.error(nb.toast.genericError),
      },
    );
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/innstillinger'));

  return (
    <KeyboardAvoider>
      <PageHeader title={nb.safety.title} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle>{nb.safety.title}</ScreenTitle>

        {target ? (
          <View style={styles.card}>
            <AppText variant="cardTitle" weight="bold">
              {nb.safety.blockTitle}
            </AppText>
            <AppText variant="meta" color="navyMuted">
              {nb.safety.blockBody}
            </AppText>
            {isBlocked ? (
              <AppText variant="meta" weight="bold" color="dangerText">
                {nb.safety.blocked} ({target.displayName})
              </AppText>
            ) : null}
            <Button
              label={isBlocked ? nb.safety.unblock : nb.safety.block}
              variant={isBlocked ? 'secondary' : 'primary'}
              onPress={toggleBlock}
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <AppText variant="cardTitle" weight="bold">
            {nb.safety.reportTitle}
          </AppText>
          {sent ? (
            <View style={styles.sentRow}>
              <Icon name="check-circle" size={18} color="lime" />
              <AppText variant="body">{nb.safety.reportSent}</AppText>
            </View>
          ) : (
            <>
              <AppText variant="meta" color="navyMuted">
                {nb.safety.reportBody}
              </AppText>
              <AppText variant="meta" weight="bold">
                {nb.safety.reasonLabel}
              </AppText>
              <View style={styles.reasons}>
                {nb.safety.reasons.map((r) => (
                  <Pressable
                    key={r}
                    accessibilityRole="button"
                    accessibilityState={{ selected: reason === r }}
                    onPress={() => setReason(r)}
                  >
                    <StatusPill label={r} tone={reason === r ? 'lime' : 'neutral'} filled={reason === r} />
                  </Pressable>
                ))}
              </View>
              <TextField
                label={nb.safety.detailsLabel}
                value={details}
                onChangeText={setDetails}
                multiline
              />
              <Button label={nb.safety.submitReport} onPress={submit} disabled={!reason} />
            </>
          )}
        </View>

        <View style={styles.card}>
          <AppText variant="cardTitle" weight="bold">
            {nb.safety.blockedListTitle}
          </AppText>
          {blockedList.length === 0 ? (
            <AppText variant="meta" color="navyMuted">
              {nb.safety.noBlocked}
            </AppText>
          ) : (
            blockedList.map((p) => (
              <View key={p.id} style={styles.blockedRow}>
                <AppText variant="body">{p.displayName}</AppText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => toggle.mutate(p.id)}
                >
                  <AppText variant="meta" weight="bold" color="cyan">
                    {nb.safety.unblock}
                  </AppText>
                </Pressable>
              </View>
            ))
          )}
        </View>

        <Button label={nb.common.close} variant="ghost" onPress={goBack} />
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.xl, gap: tokens.space.lg, paddingBottom: tokens.space.xxxl },
  card: {
    gap: tokens.space.sm,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.lg,
    ...tokens.shadow.card,
  },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  sentRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.space.xs,
  },
});
