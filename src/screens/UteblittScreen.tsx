import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import { useExplainNoShow, useNoShowReport } from '@/api/queries';
import { canExplain, hoursLeft, weightNow } from '@/domain/noShow';
import type { NoShowStatus } from '@/domain/types';
import { shortDate } from '@/lib/datetime';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import { FallbackScreen } from '@/components/FallbackScreen';
import { Button, ErrorText, FadeUp, Field, Icon, Input, Pill, ScaleIn, Screen, StickyFooter, SubHeader, type IconName } from '@/components/ui';

const MIN = 10;
const MAX = 600;

const STATUS: Record<NoShowStatus, { label: string; tone: 'warn' | 'neutral' | 'danger' | 'ok'; icon: IconName }> = {
  PENDING: { label: nb.rescue.statusPending, tone: 'warn', icon: 'hourglass' },
  DISPUTED: { label: nb.rescue.statusDisputed, tone: 'neutral', icon: 'shield' },
  COUNTED: { label: nb.rescue.statusCounted, tone: 'danger', icon: 'alert' },
  DISMISSED: { label: nb.rescue.statusDismissed, tone: 'ok', icon: 'check' },
};

/** Uteblitt fra avtale (0074): what was reported, how it counts, and the helper's answer. */
export function UteblittScreen({ reportId }: { reportId: string }) {
  const router = useRouter();
  const { data: r, isLoading, isError, refetch } = useNoShowReport(reportId);
  const explain = useExplainNoShow(reportId);
  const [textValue, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);

  if (!r) {
    return <FallbackScreen status={isError ? 'error' : isLoading ? 'loading' : 'empty'} onRetry={() => refetch()} title={nb.rescue.reportTitle} />;
  }

  const open = canExplain(r);
  const st = STATUS[r.status === 'PENDING' && !open ? 'COUNTED' : r.status];
  const w = weightNow(r);
  const reason = nb.rescue.reasons[r.reason];
  const len = textValue.trim().length;

  const send = () => {
    if (len < MIN) {
      setErr(nb.rescue.explainTooShort);
      return;
    }
    explain.mutate(textValue.trim(), {
      onSuccess: () => {
        haptics.success();
        toast.success(nb.rescue.explainSent, { icon: 'send', bottom: 150 });
      },
      onError: (e) => setErr(serverMessage(e, nb.toast.genericError)),
    });
  };

  return (
    <View style={styles.flex}>
      <Screen
        scroll
        spacer={open ? 'foot' : 'none'}
        header={<SubHeader title={nb.rescue.reportTitle} onBack={() => (router.canGoBack() ? router.back() : router.replace('/varsler'))} />}
      >
        <FadeUp style={[styles.px, styles.top]}>
          <View style={[styles.case, shadow.medium]}>
            <View style={styles.caseHead}>
              <View style={styles.caseIc}>
                <Icon name={r.reason === 'LATE' ? 'clock' : r.reason === 'NO_REPLY' ? 'msgOff' : 'userX'} size={22} color={colors.danger} />
              </View>
              <View style={styles.flex1}>
                <Text style={text.eyebrow} numberOfLines={1}>
                  {r.listingTitle}
                </Text>
                <Text style={[text.h3, styles.caseTitle]} accessibilityRole="header">
                  {reason.title}
                </Text>
                <Text style={text.meta}>{`${r.iAmReported ? nb.rescue.reportedBy(r.reporterName) : nb.rescue.reportedByYou} · ${shortDate(r.createdAt)}`}</Text>
              </View>
            </View>
            <View style={styles.pills}>
              <Pill label={st.label} tone={st.tone} icon={st.icon} />
              <Pill label={w === 1 ? nb.rescue.weightFull : w === 0.5 ? nb.rescue.weightHalf : nb.rescue.weightNone} tone="line" />
            </View>
            {open ? (
              <View style={styles.clock} accessibilityLiveRegion="polite">
                <Icon name="hourglass" size={16} color={colors.warnDark} />
                <Text style={styles.clockText}>{nb.rescue.countsIn(hoursLeft(r.countsAt))}</Text>
              </View>
            ) : null}
          </View>
        </FadeUp>

        {r.explanation ? (
          <FadeUp delay={80} style={[styles.px, styles.mt14]}>
            <View style={[styles.quote, shadow.card]}>
              <Text style={text.eyebrow}>{r.iAmReported ? nb.rescue.yourExplanation : nb.rescue.theirExplanation(r.reportedName)}</Text>
              <Text style={[text.body, styles.quoteText]}>«{r.explanation}»</Text>
            </View>
          </FadeUp>
        ) : !r.iAmReported ? (
          <FadeUp delay={80} style={[styles.px, styles.mt14]}>
            <Text style={[text.meta, styles.center]}>{nb.rescue.ownerSide(r.reportedName)}</Text>
          </FadeUp>
        ) : null}

        {open ? (
          <FadeUp delay={120} style={[styles.px, styles.mt18]}>
            <Field label={nb.rescue.explainLabel} hint={`${len}/${MAX}`}>
              <Input
                multiline
                value={textValue}
                onChangeText={(v) => {
                  setText(v.slice(0, MAX));
                  setErr(null);
                }}
                maxLength={MAX}
                placeholder={nb.rescue.explainPh}
                accessibilityLabel={nb.rescue.explainLabel}
                error={!!err}
              />
              {err ? <ErrorText>{err}</ErrorText> : null}
            </Field>
          </FadeUp>
        ) : null}

        <FadeUp delay={160} style={[styles.px, styles.mt18]}>
          <View style={[styles.rules, shadow.card]}>
            <Text style={text.label}>{nb.rescue.rulesTitle}</Text>
            {nb.rescue.rules.map((line) => (
              <View key={line} style={styles.rule}>
                <View style={styles.dot} />
                <Text style={[text.meta, styles.flex1]}>{line}</Text>
              </View>
            ))}
          </View>
        </FadeUp>

        {!open && r.iAmReported ? (
          <ScaleIn style={[styles.px, styles.mt18]}>
            <Button label={nb.avtaleSum.toOppdrag} iconRight="arrow" variant="ghost" onPress={() => safePush('/')} />
          </ScaleIn>
        ) : null}
        <View style={styles.bottom} />
      </Screen>

      {open ? (
        <StickyFooter>
          <Button label={nb.rescue.explainSend} icon="send" size="lg" disabled={len === 0} loading={explain.isPending} onPress={send} />
        </StickyFooter>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex1: { flex: 1, minWidth: 0, gap: 2 },
  px: { paddingHorizontal: screenPadding },
  center: { textAlign: 'center' },
  top: { paddingTop: 6 },
  mt14: { marginTop: 14 },
  mt18: { marginTop: 18 },
  bottom: { height: 24 },
  case: { borderRadius: 24, backgroundColor: colors.white, padding: 18, gap: 14, borderWidth: 1, borderColor: colors.line },
  caseHead: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  caseIc: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.dangerTint, alignItems: 'center', justifyContent: 'center' },
  caseTitle: { fontSize: 20, lineHeight: 24 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  clock: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.card, backgroundColor: colors.warnTint },
  clockText: { ...text.label, fontSize: 14, color: colors.warnDark, flex: 1 },
  quote: { borderRadius: radius.card, backgroundColor: colors.white, padding: 16, gap: 6 },
  quoteText: { fontSize: 15, lineHeight: 22, color: colors.ink2 },
  rules: { borderRadius: radius.card, backgroundColor: colors.white, padding: 16, gap: 10 },
  rule: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink, marginTop: 7 },
});
