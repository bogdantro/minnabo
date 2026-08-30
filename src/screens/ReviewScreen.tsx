import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { useProposal, useSubmitReview } from '@/api/queries';
import { useSession } from '@/auth/session';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { FallbackScreen } from '@/components/FallbackScreen';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';

export function ReviewScreen({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const submit = useSubmitReview();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);

  const { data: proposal, isLoading, isError, refetch } = useProposal(proposalId);
  const me = useSession().userId ?? '';
  const counterpartId =
    proposal?.fromProfileId === me ? proposal?.toProfileId : proposal?.fromProfileId;

  const send = () => {
    if (!proposal || !counterpartId) return;
    submit.mutate(
      {
        agreementProposalId: proposalId,
        listingId: proposal.listingId,
        fromProfileId: me,
        toProfileId: counterpartId,
        rating,
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: () => {
          haptics.success();
          setDone(true);
        },
        onError: () => toast.error(nb.toast.genericError),
      },
    );
  };

  if (!proposal && !done) {
    return (
      <FallbackScreen
        status={isError ? 'error' : isLoading ? 'loading' : 'empty'}
        onRetry={() => refetch()}
        title={nb.review.title}
      />
    );
  }

  if (done) {
    return (
      <KeyboardAvoider>
        <PageHeader title={nb.review.title} showBack={false} />
        <View style={styles.center}>
          <View style={styles.badge}>
            <Icon name="check" size={30} color="navy" />
          </View>
          <ScreenTitle>{nb.review.submitted}</ScreenTitle>
          <Button label={nb.leggUt.toFront} onPress={() => router.replace('/')} />
        </View>
      </KeyboardAvoider>
    );
  }

  return (
    <KeyboardAvoider>
      <PageHeader title={nb.review.title} />
      <View style={styles.body}>
        <ScreenTitle>{nb.review.heading}</ScreenTitle>

        <AppText variant="meta" weight="bold">
          {nb.review.ratingLabel}
        </AppText>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`${i} av 5`}
              onPress={() => setRating(i)}
            >
              <Icon name="star" size={36} color={i <= rating ? 'star' : 'line'} />
            </Pressable>
          ))}
        </View>

        <TextField
          label={nb.review.commentLabel}
          value={comment}
          onChangeText={setComment}
          multiline
        />
      </View>

      <View style={styles.footer}>
        <Button label={nb.review.submit} onPress={send} loading={submit.isPending} />
      </View>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: tokens.space.xl, gap: tokens.space.md },
  stars: { flexDirection: 'row', gap: tokens.space.sm, marginBottom: tokens.space.md },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.md,
    padding: tokens.space.xxl,
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: tokens.color.limeTint,
    borderWidth: 2,
    borderColor: tokens.color.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: tokens.space.xl,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line,
    backgroundColor: tokens.color.surface,
  },
});
