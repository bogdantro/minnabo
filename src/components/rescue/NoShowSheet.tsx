import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { useReportHelperNoShow } from '@/api/queries';
import { OWNER_REASONS } from '@/domain/noShow';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Button, FadeUp, Icon, ScaleIn, Sheet, Toggle, type IconName } from '@/components/ui';
import type { RescueResult } from '@/api/ApiClient';

type OwnerReason = (typeof OWNER_REASONS)[number];
const REASON_ICON: Record<OwnerReason, IconName> = { NO_SHOW: 'userX', NO_REPLY: 'msgOff', LATE: 'clock' };

/**
 * «Hjelperen kom ikke» – the owner picks what happened, sees exactly what will happen,
 * chooses haste, and confirms once. The rescue itself runs in the database (0074).
 */
export function NoShowSheet({
  visible,
  onClose,
  proposalId,
  helperFirst,
  otherOffers,
  initialReason,
  onDone,
  offerPost = false,
}: {
  visible: boolean;
  onClose: () => void;
  proposalId: string;
  helperFirst: string;
  /** how many other open tilbud the oppdrag has */
  otherOffers: number;
  initialReason?: OwnerReason;
  onDone: (r: RescueResult) => void;
  /** an avtale from a «Tilbyr hjelp» post: nothing to reopen, no other tilbud, no haste (0076) */
  offerPost?: boolean;
}) {
  const report = useReportHelperNoShow(proposalId);
  const [reason, setReason] = useState<OwnerReason | null>(initialReason ?? null);
  const [urgent, setUrgent] = useState(!offerPost);

  const send = () => {
    if (!reason || report.isPending) return;
    report.mutate(
      { reason, makeUrgent: urgent },
      {
        onSuccess: (r) => {
          haptics.success();
          onClose();
          toast.success(nb.rescue.doneToast, { icon: 'check', bottom: 150 });
          onDone(r);
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }),
      },
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => !report.isPending && onClose()}
      title={nb.rescue.sheetTitle}
      titleSize="h2"
      subtitle={nb.rescue.sheetSub(helperFirst)}
      scroll
      heightRatio={0.9}
    >
      <View style={styles.wrap} accessibilityRole="radiogroup">
        {OWNER_REASONS.map((r, i) => {
          const on = reason === r;
          return (
            <FadeUp key={r} delay={i * 50}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${nb.rescue.reasons[r].title}. ${nb.rescue.reasons[r].sub}`}
                onPress={() => {
                  haptics.light();
                  setReason(r);
                }}
                style={({ pressed }) => [styles.reason, on && [styles.reasonOn, shadow.selected], pressed && styles.pressed]}
              >
                <View style={[styles.reasonIc, on && styles.reasonIcOn]}>
                  <Icon name={REASON_ICON[r]} size={20} color={on ? colors.white : colors.danger} />
                </View>
                <View style={styles.flex}>
                  <Text style={[text.label, styles.reasonTitle]}>{nb.rescue.reasons[r].title}</Text>
                  <Text style={text.meta}>{nb.rescue.reasons[r].sub}</Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
              </Pressable>
            </FadeUp>
          );
        })}

        {reason ? (
          <FadeUp style={styles.after}>
            <Text style={text.eyebrow}>{nb.rescue.whatHappens}</Text>
            <View style={[styles.steps, shadow.card]}>
              {[nb.rescue.step1(helperFirst), offerPost ? nb.rescue.step2Offer : nb.rescue.step2(otherOffers), nb.rescue.step3(helperFirst)].map((s, i) => (
                <View key={s} style={[styles.step, i > 0 && styles.stepLine]}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={[text.body, styles.stepText]}>{s}</Text>
                </View>
              ))}
            </View>

            {offerPost ? null : (
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={nb.rescue.urgent}
              accessibilityHint={nb.rescue.urgentSub}
              accessibilityState={{ checked: urgent }}
              onPress={() => setUrgent((u) => !u)}
              style={[styles.urgent, urgent && styles.urgentOn]}
            >
              <View style={[styles.urgentIc, urgent && styles.urgentIcOn]}>
                <Icon name="zap" size={18} color={urgent ? colors.white : colors.warn} />
              </View>
              <View style={styles.flex}>
                <Text style={text.label}>{nb.rescue.urgent}</Text>
                <Text style={text.meta}>{nb.rescue.urgentSub}</Text>
              </View>
              <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Toggle value={urgent} onValueChange={() => undefined} accessibilityLabel={nb.rescue.urgent} />
              </View>
            </Pressable>
            )}

            <ScaleIn>
              <Button
                label={nb.rescue.confirm}
                icon="repeat"
                variant="danger"
                size="lg"
                loading={report.isPending}
                loadingLabel={nb.rescue.confirming}
                onPress={send}
              />
            </ScaleIn>
            <Button label={nb.rescue.keep} variant="ghost" disabled={report.isPending} onPress={onClose} />
          </FadeUp>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingBottom: 12 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  pressed: { transform: [{ scale: 0.985 }] },
  reason: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  reasonOn: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  reasonIc: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.dangerTint, alignItems: 'center', justifyContent: 'center' },
  reasonIcOn: { backgroundColor: colors.danger },
  reasonTitle: { fontSize: 15.5 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.danger },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger },
  after: { gap: 12, marginTop: 8 },
  steps: { borderRadius: radius.card, backgroundColor: colors.white, paddingHorizontal: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  stepLine: { borderTopWidth: 1, borderTopColor: colors.line2 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { ...text.label, fontSize: 13, color: colors.white },
  stepText: { flex: 1, fontSize: 14.5, lineHeight: 20 },
  urgent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  urgentOn: { borderColor: colors.warn, backgroundColor: colors.warnTint },
  urgentIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.warnTint, alignItems: 'center', justifyContent: 'center' },
  urgentIcOn: { backgroundColor: colors.warn },
});
