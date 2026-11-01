import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { useConfirmStillAvailable } from '@/api/queries';
import type { Proposal } from '@/domain/types';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { colors, shadow, text } from '@/theme/theme';
import { Button, Icon, ScaleIn } from '@/components/ui';

/**
 * «Oppdraget er ledig igjen» – for someone whose tilbud is still open when the helper
 * the owner picked didn't come (0074). One tap says the tilbud stands today; the owner
 * then sees «Kan i dag» on it. `answerYes`: the same tap made on the push.
 */
export function StillAvailableCard({ proposal, ownerFirst, answerYes }: { proposal: Proposal; ownerFirst: string; answerYes?: boolean }) {
  const confirm = useConfirmStillAvailable(proposal.id);
  const done = !!proposal.availableTodayAt;

  const send = () =>
    confirm.mutate(undefined, {
      onSuccess: () => {
        haptics.success();
        toast.success(nb.rescue.stillDone(ownerFirst), { icon: 'check', bottom: 150 });
      },
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }),
    });

  const answered = useRef(false);
  useEffect(() => {
    if (!answerYes || answered.current || done) return;
    answered.current = true;
    send();
    // send is stable enough for a one-off; re-running on its identity would send twice
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerYes, done]);

  if (done) {
    return (
      <ScaleIn style={styles.done} testID="still-available-done">
        <View style={styles.okIc}>
          <Icon name="check" size={16} color={colors.white} />
        </View>
        <View style={styles.flex}>
          <Text style={[text.label, styles.okTitle]}>{nb.rescue.stillDoneTitle}</Text>
          <Text style={[text.meta, styles.okBody]}>{nb.rescue.stillDone(ownerFirst)}</Text>
        </View>
      </ScaleIn>
    );
  }

  return (
    <ScaleIn style={[styles.hero, shadow.hero]} testID="still-available">
      <View style={styles.glow} />
      <View style={styles.badge}>
        <Icon name="zap" size={16} color={colors.ink} />
      </View>
      <Text style={[text.h3, styles.title]} accessibilityRole="header">
        {nb.rescue.stillTitle}
      </Text>
      <Text style={styles.body}>{nb.rescue.stillBody(ownerFirst)}</Text>
      <Button label={nb.rescue.stillCta} icon="check" variant="lime" size="lg" loading={confirm.isPending} onPress={send} style={styles.btn} />
    </ScaleIn>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  hero: { borderRadius: 24, backgroundColor: colors.ink, padding: 18, gap: 8, overflow: 'hidden' },
  glow: { position: 'absolute', right: -40, top: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: colors.lime, opacity: 0.25 },
  badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.white, fontSize: 19, lineHeight: 23 },
  body: { ...text.body, fontSize: 14.5, lineHeight: 20, color: colors.onInk78 },
  btn: { marginTop: 6 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: colors.okTint },
  okIc: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' },
  okTitle: { color: colors.okText, fontSize: 14.5 },
  okBody: { color: colors.okText },
});
