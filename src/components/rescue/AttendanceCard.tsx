import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { ArrivedSheet } from './ArrivedSheet';
import { useConfirmAttendance, useSetHelperStatus } from '@/api/queries';
import { attendanceOf, isJobDay, type Attendance } from '@/domain/noShow';
import type { AgreementSnapshot } from '@/domain/types';
import { formatTime } from '@/lib/datetime';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Button, FadeUp, Icon, ScaleIn, TextLink, type IconName } from '@/components/ui';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Only around the job: the day itself, the 24 hours before, or once anything has happened. */
export function showAttendance(a: AgreementSnapshot | undefined, now = Date.now()): boolean {
  if (!a?.scheduledAt || a.cancelledAt) return false;
  const at = Date.parse(a.scheduledAt);
  return isJobDay(a, new Date(now)) || (at > now && at - now < DAY_MS) || !!a.confirmRequestedAt || attendanceOf(a) !== 'none';
}

const NODES: { key: Exclude<Attendance, 'none'>; icon: IconName }[] = [
  { key: 'confirmed', icon: 'check' },
  { key: 'onTheWay', icon: 'nav' },
  { key: 'arrived', icon: 'pin' },
];
const RANK: Record<Attendance, number> = { none: 0, confirmed: 1, onTheWay: 2, arrived: 3 };

/**
 * Jobbdagen – «Bekreft at du kommer», «Jeg er på vei», «Jeg er framme» for the helper;
 * the same three steps live for the owner, with a calm warning when nothing happens.
 */
export function AttendanceCard({
  proposalId,
  agreement,
  iAmHelper,
  otherFirst,
  onWrite,
  onFindOther,
  onCantCome,
}: {
  proposalId: string;
  agreement: AgreementSnapshot;
  iAmHelper: boolean;
  otherFirst: string;
  onWrite: () => void;
  /** owner: «Hjelperen kom ikke» */
  onFindOther?: () => void;
  /** helper: «Jeg kan ikke likevel» */
  onCantCome?: () => void;
}) {
  const confirm = useConfirmAttendance(proposalId);
  const status = useSetHelperStatus(proposalId);
  const [arrivedOpen, setArrivedOpen] = useState(false);
  const state = attendanceOf(agreement);
  const when = agreement.scheduledAt ? `${isJobDay(agreement) ? 'i dag' : 'i morgen'} kl. ${formatTime(agreement.scheduledAt)}` : '';
  const err = (e: unknown) => toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 });
  const stamp: Partial<Record<Attendance, string>> = {
    confirmed: agreement.helperConfirmedAt,
    [agreement.helperStatus === 'ARRIVED' ? 'arrived' : 'onTheWay']: agreement.helperStatusAt,
  };

  // helper, not confirmed yet: the one thing to do
  if (iAmHelper && state === 'none') {
    return (
      <ScaleIn style={[styles.ask, shadow.card]} testID="attendance-ask">
        <View style={styles.askIc}>
          <Icon name="bell" size={20} color={colors.ink} />
        </View>
        <Text style={[text.h3, styles.askTitle]}>{nb.rescue.confirmTitle}</Text>
        <Text style={[text.body, styles.askSub]}>{nb.rescue.confirmSub(otherFirst, when)}</Text>
        <Button
          label={nb.rescue.confirmCta}
          icon="check"
          size="lg"
          loading={confirm.isPending}
          onPress={() =>
            confirm.mutate(undefined, {
              onSuccess: () => {
                haptics.success();
                toast.success(nb.rescue.confirmed, { icon: 'check', bottom: 150 });
              },
              onError: err,
            })
          }
        />
        {onCantCome ? <TextLink label={nb.rescue.cantCome} icon="x" onPress={onCantCome} style={styles.selfCenter} /> : null}
      </ScaleIn>
    );
  }

  const next: { label: string; icon: IconName; s: 'ON_THE_WAY' | 'ARRIVED' } | null =
    state === 'confirmed' ? { label: nb.rescue.onTheWay, icon: 'nav', s: 'ON_THE_WAY' } : state === 'onTheWay' ? { label: nb.rescue.arrived, icon: 'pin', s: 'ARRIVED' } : null;
  const warned = !iAmHelper && state === 'none' && !!agreement.ownerWarnedAt;

  return (
    <FadeUp style={[styles.card, shadow.card]} testID="attendance-card">
      <View style={styles.head}>
        <Text style={text.eyebrow}>{nb.rescue.trackerTitle}</Text>
        {when ? <Text style={text.meta}>{when}</Text> : null}
      </View>
      <View style={styles.tracker} accessibilityRole="progressbar" accessibilityLabel={`${nb.rescue.trackerTitle}: ${state === 'none' ? nb.rescue.waitingConfirm(otherFirst) : nb.rescue.states[state]}`}>
        {NODES.map((n, i) => {
          const done = RANK[state] >= RANK[n.key];
          const current = RANK[state] + 1 === RANK[n.key];
          return (
            <View key={n.key} style={styles.nodeCol}>
              {i > 0 ? <View style={[styles.line, RANK[state] >= RANK[n.key] && styles.lineOn]} /> : null}
              <Node done={done} current={current} icon={n.icon} />
              <Text style={[styles.nodeLabel, done && styles.nodeLabelOn]}>{nb.rescue.states[n.key]}</Text>
              <Text style={styles.nodeTime}>{done && stamp[n.key] ? formatTime(stamp[n.key]!) : ' '}</Text>
            </View>
          );
        })}
      </View>

      {iAmHelper && next ? (
        <Button
          label={next.label}
          icon={next.icon}
          variant="ink"
          loading={status.isPending}
          onPress={() =>
            // «framme» asks first whether to share roughly where the helper is
            next.s === 'ARRIVED'
              ? setArrivedOpen(true)
              : status.mutate(next.s, {
                  onSuccess: () => {
                    haptics.light();
                    toast.success(nb.rescue.sentStatus(otherFirst), { icon: next.icon, bottom: 150 });
                  },
                  onError: err,
                })
          }
        />
      ) : null}
      {iAmHelper ? <ArrivedSheet visible={arrivedOpen} onClose={() => setArrivedOpen(false)} proposalId={proposalId} otherFirst={otherFirst} /> : null}

      {/* the owner sees the shared place only on the job day (and the server wipes it after 12 h) */}
      {!iAmHelper && state === 'arrived' && agreement.helperStatusPlace && isJobDay(agreement) ? (
        <View style={styles.place} accessibilityLabel={nb.rescue.arrivedAtA11y(otherFirst, agreement.helperStatusPlace)} testID="arrived-place">
          <Icon name="pin" size={16} color={colors.okText} />
          <Text style={[text.label, styles.placeText]} numberOfLines={1}>
            {nb.rescue.arrivedAt(agreement.helperStatusPlace)}
          </Text>
        </View>
      ) : null}

      {!iAmHelper && state === 'none' && !warned ? <Text style={[text.meta, styles.center]}>{nb.rescue.waitingConfirm(otherFirst)}</Text> : null}

      {warned ? (
        <View style={styles.warn} accessibilityRole="alert">
          <View style={styles.row}>
            <Icon name="alert" size={18} color={colors.warnDark} />
            <Text style={[text.label, styles.warnTitle]}>{nb.rescue.notConfirmedTitle(otherFirst)}</Text>
          </View>
          <Text style={[text.meta, styles.warnBody]}>{nb.rescue.notConfirmedBody}</Text>
          <View style={styles.row}>
            <Button label={nb.rescue.write(otherFirst)} icon="msg" variant="ghost" size="sm" block={false} onPress={onWrite} style={styles.grow} />
            {onFindOther ? <Button label={nb.rescue.findOther} icon="repeat" variant="ink" size="sm" block={false} onPress={onFindOther} style={styles.grow} /> : null}
          </View>
        </View>
      ) : null}
    </FadeUp>
  );
}

function Node({ done, current, icon }: { done: boolean; current: boolean; icon: IconName }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (current && !reduced) p.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }), -1, false));
    else p.set(0);
  }, [current, reduced, p]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.value), transform: [{ scale: 1 + p.value * 0.6 }] }));
  return (
    <View style={styles.nodeWrap}>
      {current ? <Animated.View style={[styles.pulse, ring]} /> : null}
      <View style={[styles.node, done && styles.nodeDone, current && styles.nodeCur]}>
        <Icon name={done ? 'check' : icon} size={16} color={done ? colors.white : current ? colors.ink : colors.faint} />
      </View>
    </View>
  );
}

const NODE = 36;

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', minHeight: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.okTint },
  placeText: { fontSize: 14, color: colors.okText, flexShrink: 1 },
  selfCenter: { alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  ask: { borderRadius: 24, backgroundColor: colors.limeTint, padding: 18, gap: 10, borderWidth: 1.5, borderColor: colors.lime },
  askIc: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  askTitle: { fontSize: 20, lineHeight: 24 },
  askSub: { fontSize: 14.5, lineHeight: 20, color: colors.ink2 },
  card: { borderRadius: radius.card, backgroundColor: colors.white, padding: 16, gap: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tracker: { flexDirection: 'row' },
  nodeCol: { flex: 1, alignItems: 'center', gap: 6 },
  line: { position: 'absolute', top: NODE / 2 - 1, right: '50%', width: '100%', height: 2, backgroundColor: colors.line, zIndex: -1 },
  lineOn: { backgroundColor: colors.ok },
  nodeWrap: { width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: colors.lime },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  nodeDone: { backgroundColor: colors.ok, borderColor: colors.ok },
  nodeCur: { backgroundColor: colors.lime, borderColor: colors.lime },
  nodeLabel: { ...text.meta, fontSize: 12.5 },
  nodeLabelOn: { ...text.label, fontSize: 12.5, color: colors.ink },
  nodeTime: { ...text.meta, fontSize: 11.5, color: colors.mute },
  warn: { borderRadius: radius.card, backgroundColor: colors.warnTint, padding: 14, gap: 8 },
  warnTitle: { flex: 1, fontSize: 14.5, color: colors.warnDark },
  warnBody: { color: colors.warnDark },
});
