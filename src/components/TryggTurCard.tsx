import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { formatTime } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { useSafeTrip } from '@/lib/safeTrip';
import { toast } from '@/lib/toast';
import { useTrustedContacts, type TrustedContact } from '@/lib/trustedContacts';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Avatar, Button, FadeUp, Icon, Pill, ScaleIn, Spinner, TextLink } from '@/components/ui';

export type TryggTurContext = {
  proposalId: string;
  /** "Klippe plen og rake løv" */
  title: string;
  /** counterpart name */
  who?: string;
  /** approximate area only (rule 6) */
  place?: string;
};

const first = (name: string) => name.split(' ')[0] || name;
const namesOf = (cs: { name: string }[]) => {
  const n = cs.map((c) => first(c.name));
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} ${nb.tryggTur.and} ${n[n.length - 1]}`;
};
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Three end-time choices: 2, 4 and 6 hours after the next full hour. */
function endOptions(now: Date): Date[] {
  const base = new Date(now);
  base.setMinutes(0, 0, 0);
  base.setHours(base.getHours() + 1);
  return [2, 4, 6].map((h) => new Date(base.getTime() + h * 3600_000));
}

/** Opens the SMS app with the message pre-filled to the trusted contacts. */
async function openSms(contacts: TrustedContact[], body: string): Promise<void> {
  const to = contacts.map((c) => c.phone.replace(/\s/g, '')).join(',');
  const sep = Platform.OS === 'ios' ? '&' : '?';
  try {
    await Linking.openURL(`sms:${to}${sep}body=${encodeURIComponent(body)}`);
  } catch {
    /* no SMS app (web/simulator) – the trip still runs */
  }
}

/**
 * `.tt` – Trygg tur (Sikkerhet, Jobbdag): idle → starting → live.
 * The trip itself is kept on the device (lib/safeTrip); contacts get the
 * message through the phone's SMS app.
 */
export function TryggTurCard({ context }: { context?: TryggTurContext }) {
  const { trip, overdue, start, extend, checkIn } = useSafeTrip();
  const { contacts } = useTrustedContacts();
  const [now] = useState(() => new Date());
  const options = endOptions(now);
  const [until, setUntil] = useState(options[1].toISOString());
  const [starting, setStarting] = useState(false);
  const names = namesOf(contacts);
  const otherTrip = trip && context && trip.proposalId && trip.proposalId !== context.proposalId;

  const begin = async () => {
    if (!contacts.length) return;
    setStarting(true);
    const job = context ? nb.tryggTur.job(context.title, context.who ?? '') : '';
    await openSms(contacts, nb.tryggTur.smsStart(job, context?.place ?? '', formatTime(until)));
    start({
      proposalId: context?.proposalId ?? '',
      label: context?.who ?? names,
      startedAt: new Date().toISOString(),
      dueAt: until,
      contactNames: contacts.map((c) => first(c.name)),
      job: job || undefined,
      place: context?.place,
    });
    setStarting(false);
    haptics.success();
    toast.success(nb.tryggTur.started, { icon: 'send' });
  };

  if (otherTrip) return null; // a trip for another agreement is already running

  if (starting) {
    return (
      <FadeUp style={[styles.tt, styles.live, styles.center]}>
        <Spinner size={34} color={colors.lime} />
        <Text style={styles.startingText}>{nb.tryggTur.sending(names)}</Text>
      </FadeUp>
    );
  }

  if (trip) {
    const due = formatTime(trip.dueAt);
    return (
      <ScaleIn style={[styles.tt, styles.live]}>
        <View style={styles.glow} />
        <View style={styles.liveTop} accessibilityRole="summary">
          <Beacon />
          <View style={styles.flex}>
            <View style={[styles.livePill, overdue && styles.livePillOverdue]}>
              <View style={[styles.pd, overdue && styles.pdOverdue]} />
              <Text style={[styles.livePillText, overdue && styles.livePillTextOverdue]}>{overdue ? nb.tryggTur.overdue : nb.tryggTur.active}</Text>
            </View>
            <Text style={styles.liveTitle}>{nb.tryggTur.sharing(namesOf(trip.contactNames.map((name) => ({ name }))), due)}</Text>
          </View>
        </View>
        <View style={styles.kv}>
          {trip.job ? (
            <View style={styles.kvl}>
              <Icon name="brief" size={16} color={colors.lime} />
              <Text style={styles.kvText}>{trip.job}</Text>
            </View>
          ) : null}
          {trip.place ? (
            <View style={styles.kvl}>
              <Icon name="pin" size={16} color={colors.lime} />
              <Text style={styles.kvText}>{nb.tryggTur.approx(trip.place)}</Text>
            </View>
          ) : null}
          <View style={styles.kvl}>
            <Icon name="clock" size={16} color={colors.lime} />
            <Text style={styles.kvText}>{nb.tryggTur.times(formatTime(trip.startedAt), due)}</Text>
          </View>
        </View>
        <View style={styles.liveBtns}>
          <Button
            label={nb.tryggTur.extend}
            variant="ink"
            icon="plus"
            style={[styles.flex, styles.extendBtn]}
            onPress={() => {
              const next = new Date(Date.parse(trip.dueAt) + 3600_000).toISOString();
              extend(next);
              void openSms(contacts, nb.tryggTur.smsExtend(formatTime(next)));
              toast.success(nb.tryggTur.extended(formatTime(next)), { icon: 'clock' });
            }}
          />
          <Button
            label={nb.tryggTur.stop}
            variant="lime"
            icon="check"
            style={styles.flex}
            onPress={() => {
              checkIn();
              void openSms(contacts, nb.tryggTur.smsStop);
              haptics.success();
              toast.success(nb.tryggTur.stopped);
            }}
          />
        </View>
        <Text style={styles.reminder}>{nb.tryggTur.reminder}</Text>
      </ScaleIn>
    );
  }

  return (
    <View style={[styles.tt, styles.idle]}>
      <View style={styles.idleTop}>
        <View style={styles.navIcon}>
          <Icon name="nav" size={22} color={colors.lime} />
        </View>
        <View style={styles.flex}>
          <Pill label={nb.tryggTur.pill} tone="line" size="sm" style={styles.selfStart} />
          <Text style={[text.h3, styles.mt6]} accessibilityRole="header">
            {nb.tryggTur.title}
          </Text>
        </View>
      </View>
      <Text style={styles.body}>{nb.tryggTur.body}</Text>
      <Text style={[text.label, styles.labelGap]}>{nb.tryggTur.shareUntil}</Text>
      <View style={styles.row8}>
        {options.map((d) => {
          const on = d.toISOString() === until;
          return (
            <Pressable
              key={d.toISOString()}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setUntil(d.toISOString())}
              style={[styles.tchip, on && styles.tchipOn]}
            >
              <Text style={[styles.tchipText, on && styles.white]}>{nb.tryggTur.at(hhmm(d))}</Text>
            </Pressable>
          );
        })}
      </View>
      {contacts.length ? (
        <View style={styles.who}>
          <View style={styles.avs}>
            {contacts.slice(0, 3).map((c, i) => (
              <View key={c.id} style={[styles.avRing, i > 0 && styles.avOverlap]}>
                <Avatar initials={c.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()} seed={c.id} size={32} ring={false} />
              </View>
            ))}
          </View>
          <Text style={[text.meta, styles.flex]}>{nb.tryggTur.willKnow(names)}</Text>
          <TextLink label={nb.tryggTur.change} icon={null} onPress={() => safePush('/trygge-kontakter')} />
        </View>
      ) : (
        <View style={styles.who}>
          <Icon name="users" size={18} color={colors.mute} />
          <Text style={[text.meta, styles.flex]}>{nb.tryggTur.noContacts}</Text>
        </View>
      )}
      {contacts.length ? (
        <Button label={nb.tryggTur.start} variant="ink" size="lg" icon="nav" onPress={begin} style={styles.mt14} />
      ) : (
        <Button label={nb.tryggTur.addContacts} variant="ink" size="lg" icon="users" onPress={() => safePush('/trygge-kontakter')} style={styles.mt14} />
      )}
    </View>
  );
}

/** `.beacon` – lime dot with three expanding rings. */
function Beacon() {
  return (
    <View style={styles.beacon}>
      {[0, 750, 1500].map((d) => (
        <Ring key={d} delay={d} />
      ))}
      <View style={styles.beaconDot}>
        <Icon name="nav" size={24} color={colors.ink} />
      </View>
    </View>
  );
}

function Ring({ delay }: { delay: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false)));
  }, [delay, reduced, p]);
  const s = useAnimatedStyle(() => ({ opacity: reduced ? 0 : 0.9 * (1 - p.value), transform: [{ scale: 1 + 1.1 * p.value }] }));
  return <Animated.View style={[styles.ring, s]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  white: { color: colors.white },
  selfStart: { alignSelf: 'flex-start' },
  mt6: { marginTop: 6 },
  mt14: { marginTop: 14 },
  row8: { flexDirection: 'row', gap: 8 },
  tt: { overflow: 'hidden', borderRadius: 30, padding: 20 },
  idle: { backgroundColor: colors.limeTint, borderWidth: 1, borderColor: colors.dateChipBg },
  live: { backgroundColor: colors.ink },
  center: { alignItems: 'center', gap: 14, paddingVertical: 36 },
  startingText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  idleTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  navIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  body: { marginTop: 12, fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21.75, color: colors.ink2 },
  labelGap: { marginTop: 16, marginBottom: 8 },
  tchip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.chipBorderSoft,
    backgroundColor: colors.glassLight,
    justifyContent: 'center',
  },
  tchipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tchipText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  who: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  avs: { flexDirection: 'row' },
  avRing: { borderRadius: 18, borderWidth: 2, borderColor: colors.white },
  avOverlap: { marginLeft: -8 },
  glow: { position: 'absolute', right: -70, bottom: -90, width: 240, height: 240, borderRadius: 120, backgroundColor: colors.lime, opacity: 0.3 },
  liveTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 22, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.halo },
  livePillOverdue: { backgroundColor: colors.dangerTint },
  pd: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lime },
  pdOverdue: { backgroundColor: colors.danger },
  livePillText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lime },
  livePillTextOverdue: { color: colors.danger },
  liveTitle: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, color: colors.white, marginTop: 6 },
  kv: { gap: 9, marginTop: 18, padding: 14, borderRadius: 18, backgroundColor: colors.onInk07 },
  kvl: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  kvText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.onInk86 },
  liveBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  extendBtn: { backgroundColor: colors.onInk12, ...shadow.none },
  reminder: { marginTop: 12, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.onInk62, textAlign: 'center' },
  beacon: { width: 64, height: 64 },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 32, borderWidth: 2, borderColor: colors.lime },
  beaconDot: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 32, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
});
