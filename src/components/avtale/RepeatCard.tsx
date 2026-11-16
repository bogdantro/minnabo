import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import nb from '@/i18n/nb';
import type { AgreementSnapshot } from '@/domain/types';
import { REPEAT_CHOICES, currentVisit, isRepeating, monthEnds, nextVisit, type RepeatEvery } from '@/domain/repeat';
import { useAgreementVisits, useEndAgreementRepeat, useMarkAgreementVisit, useSetAgreementRepeat } from '@/api/queries';
import { dayMonth, dayMonthYear, formatTime, monthYear, shortDate } from '@/lib/datetime';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Button, Chip, Dialog, FadeUp, Icon, PaymentNote, Segmented, Sheet } from '@/components/ui';

type Props = {
  proposalId: string;
  agreement: AgreementSnapshot;
  otherFirst: string;
  /** the job is finished or waiting for confirmation: nothing to repeat any more */
  finished: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * «Fast avtale» on the avtale page (0101): offer it, show the next visit and the season,
 * mark a visit as done, change or end it. One review for the whole season, after it ends.
 */
export function RepeatCard({ proposalId, agreement, otherFirst, finished, style }: Props) {
  const t = nb.fast;
  const [sheet, setSheet] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const repeating = isRepeating(agreement);
  const visits = useAgreementVisits(proposalId, !!agreement.repeatEveryDays);
  const mark = useMarkAgreementVisit(proposalId);
  const end = useEndAgreementRepeat(proposalId);
  // captured once per render pass is fine: minutes don't change which visit is next
  const [now] = useState(() => Date.now());

  if (agreement.cancelledAt || !agreement.scheduledAt) return null;

  // ended by one of them or by the season: one review for all of it
  if (agreement.repeatEveryDays && agreement.repeatEndedAt) {
    if (finished) return null;
    return (
      <FadeUp style={style}>
        <View style={[styles.card, styles.endedCard, shadow.card]}>
          <View style={styles.row}>
            <View style={[styles.disc, styles.discSoft]}>
              <Icon name="star" size={18} color={colors.limeDeep} />
            </View>
            <View style={styles.flex}>
              <Text style={text.label}>{t.endedTitle}</Text>
              <Text style={styles.sub}>{t.endedBody}</Text>
            </View>
          </View>
          <Button label={t.endedCta} icon="check" variant="ink" size="sm" onPress={() => safePush(`/fullfor/${proposalId}`)} />
        </View>
      </FadeUp>
    );
  }

  if (!repeating) {
    if (finished) return null;
    return (
      <FadeUp style={style}>
        <View style={[styles.card, styles.offer, shadow.card]}>
          <View style={styles.row}>
            <View style={[styles.disc, styles.discSoft]}>
              <Icon name="repeat" size={18} color={colors.limeDeep} />
            </View>
            <View style={styles.flex}>
              <Text style={text.eyebrow}>{t.eyebrow}</Text>
              <Text style={text.label}>{t.offerTitle}</Text>
            </View>
          </View>
          <Text style={styles.sub}>{t.offerBody}</Text>
          <Button label={t.offerCta} icon="repeat" variant="ghost" size="sm" onPress={() => setSheet(true)} />
        </View>
        <RepeatSheet visible={sheet} onClose={() => setSheet(false)} proposalId={proposalId} agreement={agreement} otherFirst={otherFirst} />
      </FadeUp>
    );
  }

  const every = t.everyShort[agreement.repeatEveryDays ?? 7];
  const next = nextVisit(agreement, now);
  const nextText = next ? `${shortDate(next.toISOString())} kl. ${formatTime(next.toISOString())}` : t.noNext;
  const cur = currentVisit(agreement, now);
  const done = visits.data ?? [];
  const curDone = !!cur && done.some((v) => Math.abs(Date.parse(v) - cur.getTime()) < 60_000);

  const markDone = () => {
    if (!cur || mark.isPending) return;
    mark.mutate(cur.toISOString(), {
      onSuccess: () => {
        haptics.success();
        toast.success(t.markedToast, { icon: 'check', bottom: 150 });
      },
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }),
    });
  };
  const doEnd = () => {
    end.mutate(undefined, {
      onSuccess: () => {
        haptics.warning();
        setConfirmEnd(false);
        toast.info(t.endedToast, { icon: 'repeat', bottom: 150 });
      },
      onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }),
    });
  };

  return (
    <FadeUp style={style}>
      <View style={[styles.card, styles.active, shadow.medium]} accessible={false}>
        <View style={styles.row} accessible accessibilityLabel={t.a11yCard(every, nextText)}>
          <View style={[styles.disc, styles.discLime]}>
            <Icon name="repeat" size={18} color={colors.ink} />
          </View>
          <View style={styles.flex}>
            <Text style={[text.eyebrow, styles.onInkMute]}>{t.eyebrow}</Text>
            <Text style={[text.label, styles.onInk]}>{t.activeTitle(every)}</Text>
          </View>
        </View>

        <View style={styles.nextBox}>
          <Text style={styles.nextLabel}>{t.next}</Text>
          <Text style={styles.nextValue}>{nextText}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaChip}>
              {agreement.repeatUntil ? t.until(dayMonthYear(`${agreement.repeatUntil}T12:00:00`)) : t.noEnd}
            </Text>
            {done.length ? <Text style={styles.metaChip}>{t.doneCount(done.length)}</Text> : null}
          </View>
        </View>

        {cur && !curDone ? (
          <Button label={t.markDone} icon="check" size="sm" loading={mark.isPending} onPress={markDone} />
        ) : cur && curDone ? (
          <View style={styles.doneLine}>
            <Icon name="check" size={16} color={colors.lime} />
            <Text style={styles.doneText}>{t.marked(dayMonth(cur.toISOString()))}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button label={t.change} icon="edit" variant="ghost" size="sm" block={false} onPress={() => setSheet(true)} style={styles.grow} />
          <Button label={t.end} icon="x" variant="ghost" size="sm" block={false} onPress={() => setConfirmEnd(true)} style={styles.grow} />
        </View>
        <Text style={styles.season}>{t.seasonNote}</Text>
      </View>

      <RepeatSheet visible={sheet} onClose={() => setSheet(false)} proposalId={proposalId} agreement={agreement} otherFirst={otherFirst} />
      <Dialog
        visible={confirmEnd}
        onClose={() => !end.isPending && setConfirmEnd(false)}
        icon="repeat"
        title={t.endTitle}
        body={t.endBody(otherFirst)}
        actions={
          <View style={styles.dlg}>
            <Button label={t.endConfirm} variant="ink" loading={end.isPending} onPress={doEnd} />
            <Button label={t.endKeep} variant="ghost" onPress={() => setConfirmEnd(false)} />
          </View>
        }
      />
    </FadeUp>
  );
}

function RepeatSheet({
  visible,
  onClose,
  proposalId,
  agreement,
  otherFirst,
}: {
  visible: boolean;
  onClose: () => void;
  proposalId: string;
  agreement: AgreementSnapshot;
  otherFirst: string;
}) {
  const t = nb.fast;
  const save = useSetAgreementRepeat(proposalId);
  const [every, setEvery] = useState<RepeatEvery>((agreement.repeatEveryDays as RepeatEvery | undefined) ?? 7);
  const [until, setUntil] = useState<string | null>(agreement.repeatUntil ?? null);
  // never a season end before the first time
  const firstDay = (agreement.scheduledAt ?? '').slice(0, 10);
  const ends = monthEnds(4).filter((d) => d >= firstDay);

  const submit = () => {
    save.mutate(
      { everyDays: every, until },
      {
        onSuccess: () => {
          haptics.success();
          onClose();
          toast.success(t.savedToast(t.everyShort[every]), { icon: 'repeat', bottom: 150 });
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 }),
      },
    );
  };

  return (
    <Sheet visible={visible} onClose={() => !save.isPending && onClose()} title={t.sheetTitle} titleSize="h2" subtitle={t.sheetSub(otherFirst)}>
      <View style={styles.sheet}>
        <Text style={text.label}>{t.howOften}</Text>
        <Segmented
          options={REPEAT_CHOICES.map((d) => ({ value: String(d), label: t.every[d] }))}
          value={String(every)}
          onChange={(v) => setEvery(Number(v) as RepeatEvery)}
          accessibilityLabel={t.howOften}
        />
        <Text style={[text.label, styles.mt6]}>{t.untilLabel}</Text>
        <View style={styles.chips}>
          <Chip label={t.noEnd} selected={until === null} onPress={() => setUntil(null)} />
          {ends.map((d) => (
            <Chip key={d} label={t.untilMonth(monthYear(`${d}T12:00:00`).split(' ')[0])} selected={until === d} onPress={() => setUntil(d)} />
          ))}
        </View>
        <Text style={styles.sheetNote}>{t.seasonNote}</Text>
        <PaymentNote />
        <Button label={t.save} icon="repeat" size="lg" loading={save.isPending} onPress={submit} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: 16, gap: 12 },
  offer: { backgroundColor: colors.white },
  endedCard: { backgroundColor: colors.white },
  active: { backgroundColor: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 2 },
  disc: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  discSoft: { backgroundColor: colors.limeTint },
  discLime: { backgroundColor: colors.lime },
  sub: { ...text.meta, color: colors.ink2 },
  onInk: { color: colors.white },
  onInkMute: { color: colors.lime },
  nextBox: { borderRadius: 18, backgroundColor: colors.white, padding: 14, gap: 4 },
  nextLabel: { ...text.meta, color: colors.mute },
  nextValue: { fontFamily: text.h2.fontFamily, fontSize: 19, lineHeight: 24, color: colors.ink },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  metaChip: {
    ...text.meta,
    fontSize: 12.5,
    color: colors.ink,
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  doneLine: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  doneText: { ...text.label, fontSize: 14, color: colors.white },
  actions: { flexDirection: 'row', gap: 10 },
  grow: { flexGrow: 1, flexBasis: 0 },
  season: { ...text.meta, fontSize: 12.5, color: colors.faint, textAlign: 'center' },
  dlg: { gap: 10, alignSelf: 'stretch' },
  sheet: { gap: 12 },
  mt6: { marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetNote: { ...text.meta, color: colors.ink2 },
});
