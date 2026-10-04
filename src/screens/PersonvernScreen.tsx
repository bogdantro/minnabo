import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ConsentRecord } from '@/api/ApiClient';
import nb from '@/i18n/nb';
import { useConsentRecords, useSetTipsConsent } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { exportMyData } from '@/lib/dataExport';
import { daysAgo, dayMonthYear, formatTime } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { Button, FadeUp, GrowBar, Icon, ListGroup, ListRow, Pill, RowSkeleton, Screen, SubHeader, Toggle, type PillTone } from '@/components/ui';

type Entry = { key: string; title: string; when: string; state: string; tone: PillTone; dot: string };

const whenOf = (iso: string) =>
  daysAgo(iso) === 0 ? nb.personvern.today(formatTime(iso)) : nb.personvern.when(dayMonthYear(iso), formatTime(iso));

/** Turns consent rows (newest first) into the log the design shows: changes on top, onboarding consents below. */
function toEntries(rows: ConsentRecord[], youth: boolean): Entry[] {
  const asc = [...rows].reverse();
  const first = asc[0];
  if (!first) return [];
  const E = nb.personvern.entries;
  const S = nb.personvern.states;
  const at = whenOf(first.createdAt);
  const base: Entry[] = [
    ...(first.terms ? [{ key: 'terms', title: E.terms, when: at, state: S.accepted, tone: 'ok' as PillTone, dot: colors.ok }] : []),
    ...(first.privacy ? [{ key: 'privacy', title: E.privacy, when: at, state: S.read, tone: 'ok' as PillTone, dot: colors.ok }] : []),
    ...(first.age ? [{ key: 'age', title: youth ? E.ageYouth : E.age, when: nb.personvern.viaVipps(at), state: S.confirmed, tone: 'ok' as PillTone, dot: colors.ok }] : []),
    ...(first.tips != null
      ? [{ key: 'tips', title: E.tips, when: at, state: first.tips ? S.on : S.off, tone: 'neutral' as PillTone, dot: colors.cyan }]
      : []),
  ];
  const changes: Entry[] = [];
  for (let i = 1; i < asc.length; i++) {
    const r = asc[i];
    if (r.tips != null && r.tips !== asc[i - 1].tips) {
      changes.unshift({ key: r.id, title: r.tips ? E.tipsOn : E.tipsOff, when: whenOf(r.createdAt), state: r.tips ? S.on : S.off, tone: 'dark', dot: colors.ink });
    }
  }
  return [...changes, ...base];
}

/** Personvern og samtykker (design/screens/Personvern.dc.html). */
export function PersonvernScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const { data: rows, isLoading } = useConsentRecords();
  const setTips = useSetTipsConsent();
  const [open, setOpen] = useState<number | null>(0);
  const [ex, setEx] = useState<'idle' | 'busy' | 'done'>('idle');
  const [pct, setPct] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);

  const tipsOn = !!rows?.[0]?.tips;
  const entries = toEntries(rows ?? [], me.isYouth);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/innstillinger'));

  const toggleTips = (on: boolean) =>
    setTips.mutate(on, {
      onSuccess: () => {
        haptics.light();
        toast.success(nb.personvern.tipsSaved, { icon: 'check' });
      },
      onError: () => toast.error(nb.toast.genericError),
    });

  const startExport = async () => {
    setEx('busy');
    setPct(0);
    // The real work is one request batch; the bar creeps to 90 % while it runs.
    timer.current = setInterval(() => setPct((p) => Math.min(90, p + 9)), 180);
    try {
      await exportMyData(me.id);
      clearInterval(timer.current);
      setPct(100);
      haptics.success();
      setEx('done');
    } catch {
      clearInterval(timer.current);
      setEx('idle');
      toast.error(nb.toast.genericError);
    }
  };

  return (
    <Screen scroll spacer="none" header={<SubHeader title={nb.personvern.title} onBack={back} />}>
      <View style={[styles.px, styles.stack22, styles.pt6]}>
        <FadeUp>
          <Text style={text.h2} accessibilityRole="header">
            {nb.personvern.heading}
          </Text>
          <Text style={[text.meta, styles.sub]}>{nb.personvern.sub}</Text>
        </FadeUp>

        <FadeUp delay={60} style={[styles.card, styles.pad, styles.row12, shadow.card]}>
          <View style={styles.flex}>
            <Text style={styles.b15}>{nb.personvern.tipsTitle}</Text>
            <Text style={[text.meta, styles.mt3]}>{nb.personvern.tipsSub}</Text>
          </View>
          <Toggle value={tipsOn} onValueChange={toggleTips} disabled={setTips.isPending || !rows} accessibilityLabel={nb.personvern.tipsTitle} />
        </FadeUp>

        <FadeUp delay={120}>
          <Text style={[text.eyebrow, styles.mb10]}>{nb.personvern.logTitle}</Text>
          <View style={[styles.card, styles.logCard, shadow.card]}>
            {isLoading ? (
              <RowSkeleton />
            ) : entries.length ? (
              entries.map((e, i) => (
                <View key={e.key} style={[styles.log, i < entries.length - 1 && styles.logDivider]}>
                  <View style={[styles.dot, { backgroundColor: e.dot }]} />
                  <View style={styles.flex}>
                    <Text style={styles.logTitle}>{e.title}</Text>
                    <Text style={text.meta}>{e.when}</Text>
                  </View>
                  <Pill label={e.state} tone={e.tone} />
                </View>
              ))
            ) : (
              <Text style={[text.meta, styles.logEmpty]}>{nb.personvern.logEmpty}</Text>
            )}
          </View>
        </FadeUp>

        <FadeUp delay={180} style={[styles.card, styles.pad, styles.gap12, shadow.card]}>
          <View style={styles.row12}>
            <View style={styles.exIcon}>
              <Icon name="download" size={18} color={colors.cyanDeep} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.b15}>{nb.personvern.exportTitle}</Text>
              <Text style={text.meta}>{nb.personvern.exportSub}</Text>
            </View>
          </View>
          {ex === 'idle' ? (
            <Button label={nb.personvern.exportStart} variant="ink" onPress={startExport} />
          ) : ex === 'busy' ? (
            <View style={styles.gap8} accessibilityLiveRegion="polite">
              <GrowBar fill={pct / 100} />
              <Text style={text.meta}>{nb.personvern.exportBusy(pct)}</Text>
            </View>
          ) : (
            <FadeUp style={styles.done}>
              <Icon name="check" size={18} color={colors.okText} />
              <Text style={styles.doneText}>{nb.personvern.exportDone}</Text>
            </FadeUp>
          )}
        </FadeUp>

        <FadeUp delay={240}>
          <Text style={[text.eyebrow, styles.mb10]}>{nb.personvern.retentionTitle}</Text>
          <View style={[styles.card, shadow.card]}>
            {nb.personvern.retention.map((f, i) => {
              const isOpen = open === i;
              return (
                <View key={f.q} style={i > 0 && styles.accDivider}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    onPress={() => setOpen(isOpen ? null : i)}
                    style={styles.acc}
                  >
                    <Text style={styles.accQ}>{f.q}</Text>
                    <Icon name={isOpen ? 'up' : 'down'} size={18} color={colors.faint} />
                  </Pressable>
                  {isOpen ? (
                    <FadeUp>
                      <Text style={styles.accA}>{f.a}</Text>
                    </FadeUp>
                  ) : null}
                </View>
              );
            })}
          </View>
        </FadeUp>

        <FadeUp delay={300}>
          <ListGroup style={shadow.card}>
            <ListRow icon="file" title={nb.personvern.terms} subtitle={nb.personvern.termsSub} chevron onPress={() => safePush('/vilkar')} />
            <ListRow
              icon="trash"
              iconBg={colors.dangerTint}
              iconColor={colors.danger}
              title={nb.personvern.deleteAccount}
              subtitle={nb.personvern.deleteSub}
              danger
              chevron
              onPress={() => safePush('/slett-konto')}
            />
          </ListGroup>
        </FadeUp>
        <View style={styles.bottom} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  pt6: { paddingTop: 6 },
  mt3: { marginTop: 3 },
  mb10: { marginBottom: 10 },
  sub: { marginTop: 6, fontSize: 14, lineHeight: 19 },
  stack22: { gap: 22 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  row12: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottom: { height: 40 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' },
  pad: { padding: 18 },
  b15: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19, color: colors.ink },
  logCard: { paddingVertical: 4, paddingHorizontal: 16 },
  log: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'flex-start' },
  logDivider: { borderBottomWidth: 1, borderBottomColor: colors.line2 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  logTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, lineHeight: 18, color: colors.ink, marginBottom: 2 },
  logEmpty: { paddingVertical: 14 },
  exIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.cyanTint, alignItems: 'center', justifyContent: 'center' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.okTint },
  doneText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 19, color: colors.okText },
  acc: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 52 },
  accDivider: { borderTopWidth: 1, borderTopColor: colors.line2 },
  accQ: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  accA: { paddingHorizontal: 16, paddingBottom: 16, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink2 },
});
