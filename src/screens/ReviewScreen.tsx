import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { useProposal, useSubmitReview } from '@/api/queries';
import { useSession } from '@/auth/session';
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

  const { data: proposal } = useProposal(proposalId);
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
      { onSuccess: () => setDone(true) },
    );
  };

  if (done) {
    return (
      <SafeAreaView style={styles.wrap} edges={['bottom']}>
        <PageHeader title={nb.review.title} showBack={false} />
        <View style={styles.center}>
          <View style={styles.badge}>
            <Icon name="check" size={30} color="navy" />
          </View>
          <ScreenTitle>{nb.review.submitted}</ScreenTitle>
          <Button label={nb.leggUt.toFront} onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
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
