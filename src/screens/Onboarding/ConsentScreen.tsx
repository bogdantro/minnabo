import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { reportError } from '@/lib/reporting';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { colors, motion, radius, screenPadding, shadow, text } from '@/theme/theme';
import {
  Avatar,
  Button,
  Checkbox,
  Icon,
  KeyValueRow,
  Pill,
  Screen,
  StickyFooter,
  SubHeader,
  VerifiedBadge,
  FadeInView,
  FadeUp,
  ScaleIn,
} from '@/components/ui';

type ConsentId = 'terms' | 'privacy' | 'age' | 'tips';

type ConsentDef = {
  id: ConsentId;
  required: boolean;
  /** Route opened by the inline link. */
  href?: '/vilkar' | '/personvern';
};

const CONSENTS: ConsentDef[] = [
  { id: 'terms', required: true, href: '/vilkar' },
  { id: 'privacy', required: true, href: '/personvern' },
  { id: 'age', required: true },
  { id: 'tips', required: false },
];
const REQUIRED = CONSENTS.filter((c) => c.required).map((c) => c.id);

/**
 * Identity from Vipps (name, masked phone, birth year). Login is still e-mail
 * based, so there is none yet: the card and the "Bekreftet via Vipps" badge
 * stay hidden until Vipps login provides it.
 */
type VippsIdentity = { name: string; initials: string; phoneMasked: string; birthYear: number };
const vippsIdentity: VippsIdentity | null = null;

const ease = Easing.bezier(...motion.ease);
const clock = () =>
  new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

/** Green line between done steps grows in over 800 ms. */
function StepLine({ done }: { done: boolean }) {
  const w = useSharedValue(0);
  useEffect(() => {
    if (done) w.set(withTiming(1, { duration: 800, easing: ease }));
  }, [done, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.sline}>
      <Animated.View style={[styles.slineFill, fill]} />
    </View>
  );
}

function Step({ n, label, state }: { n: number; label: string; state: 'done' | 'cur' | 'todo' }) {
  const done = state === 'done';
  const cur = state === 'cur';
  return (
    <View style={styles.stp}>
      <View style={[styles.stpN, done && styles.stpDone, cur && [styles.stpCur, shadow.stepCurrent]]}>
        {done ? (
          <Icon name="check" size={16} color={colors.white} />
        ) : (
          <Text style={[text.stepNum, { color: cur ? colors.white : colors.faint }]}>{n}</Text>
        )}
      </View>
      <Text style={[text.stepLabel, { color: done ? colors.okText : cur ? colors.ink : colors.faint }]}>{label}</Text>
    </View>
  );
}

function Chevron({ open }: { open: boolean }) {
  const r = useSharedValue(open ? 180 : 0);
  useEffect(() => {
    r.set(withTiming(open ? 180 : 0, { duration: 300, easing: ease }));
  }, [open, r]);
  const anim = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={anim}>
      <Icon name="down" size={14} color={colors.mute} />
    </Animated.View>
  );
}

/** Onboarding · Samtykker (design/screens/Samtykke.dc.html). */
export function ConsentScreen() {
  const router = useRouter();
  const me = useCurrentUser();
  const [on, setOn] = useState<Record<ConsentId, boolean>>({
    terms: false,
    privacy: false,
    age: !!vippsIdentity, // pre-confirmed only when Vipps verified the age
    tips: false,
  });
  const [stamps, setStamps] = useState<Partial<Record<ConsentId, string>>>({});
  const [open, setOpen] = useState<Partial<Record<ConsentId, boolean>>>({});
  const [busy, setBusy] = useState(false);

  const done = REQUIRED.filter((id) => on[id]).length;
  const ready = done === REQUIRED.length;
  const allOn = CONSENTS.every((c) => on[c.id]);
  const missing = REQUIRED.length - done;
  const firstName = (vippsIdentity?.name ?? me.displayName).split(' ')[0] || undefined;

  const flash = (msg: string, icon: 'bell' | 'x' | 'checks' | 'undo') => toast.success(msg, { icon, bottom: 150 });

  const toggle = (id: ConsentId) => {
    const next = !on[id];
    setOn((o) => ({ ...o, [id]: next }));
    if (next) setStamps((s) => ({ ...s, [id]: clock() }));
    if (id === 'tips') flash(next ? nb.consent.toastTipsOn : nb.consent.toastTipsOff, next ? 'bell' : 'x');
  };

  const toggleAll = () => {
    if (allOn) {
      setOn({ terms: false, privacy: false, age: false, tips: false });
      flash(nb.consent.toastAllOff, 'undo');
    } else {
      const t = clock();
      setOn({ terms: true, privacy: true, age: true, tips: true });
      setStamps({ terms: t, privacy: t, age: t, tips: t });
      flash(nb.consent.toastAllOn(t), 'checks');
    }
  };

  const save = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const row = { profile_id: data.user.id, terms: on.terms, privacy: on.privacy, age: on.age };
        let { error } = await supabase.from('consent_records').insert({ ...row, tips: on.tips });
        // `tips` arrives with migration 0024; never lose the required consents over it.
        if (error && /tips/.test(error.message ?? '')) {
          ({ error } = await supabase.from('consent_records').insert(row));
        }
        if (error) throw error;
      }
      router.replace('/oppsett');
    } catch (e) {
      reportError(e, { where: 'ConsentScreen.save' });
      toast.error(nb.consent.saveFailed, { bottom: 150 });
    } finally {
      setBusy(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/logg-inn'));

  return (
    <Screen
      scroll
      spacer="foot"
      header={<SubHeader title={nb.consent.title} onBack={back} />}
      footer={
        <StickyFooter>
          <View style={styles.status} accessibilityLiveRegion="polite">
            {ready ? (
              <>
                <ScaleIn style={styles.okCircle}>
                  <Icon name="check" size={14} color={colors.white} />
                </ScaleIn>
                <Text style={[text.metaBold, { color: colors.okText }]}>{nb.consent.ready}</Text>
              </>
            ) : (
              <>
                <Icon name="info" size={16} color={colors.mute} />
                <Text style={[text.metaBold, { color: colors.mute }]}>{nb.consent.missing(missing)}</Text>
              </>
            )}
          </View>
          <Button
            label={nb.consent.cta}
            size="lg"
            iconRight="arrow"
            disabled={!ready}
            loading={busy}
            onPress={save}
          />
        </StickyFooter>
      }
    >
      <FadeUp delay={0}>
        <View style={styles.stepper} accessible accessibilityLabel={nb.consent.stepA11y}>
          <Step n={1} label={nb.consent.steps[0]} state="done" />
          <StepLine done />
          <Step n={2} label={nb.consent.steps[1]} state="cur" />
          <StepLine done={false} />
          <Step n={3} label={nb.consent.steps[2]} state="todo" />
        </View>
      </FadeUp>

      <FadeUp delay={100} style={styles.head}>
        <Text style={[text.h1, styles.h1]} accessibilityRole="header">
          {nb.consent.heading(firstName)}
        </Text>
        <Text style={[text.body, styles.intro]}>{nb.consent.intro}</Text>
      </FadeUp>

      {vippsIdentity ? <IdentityCard id={vippsIdentity} /> : null}

      <FadeUp delay={200} style={styles.sectionHead}>
        <View>
          <Text style={text.h3} accessibilityRole="header">
            {nb.consent.sectionTitle}
          </Text>
          <View style={styles.reqRow}>
            <View style={styles.reqbar}>
              <Animated.View style={[styles.reqFill, { width: `${(done / REQUIRED.length) * 100}%` }]} />
            </View>
            <Text style={[text.metaBold, { color: colors.mute }]}>{nb.consent.required(done, REQUIRED.length)}</Text>
          </View>
        </View>
        <Button
          label={allOn ? nb.consent.removeAll : nb.consent.acceptAll}
          icon={allOn ? 'undo' : 'checks'}
          variant={allOn ? 'soft' : 'ink'}
          size="sm"
          block={false}
          onPress={toggleAll}
        />
      </FadeUp>

      <View style={styles.list}>
        {CONSENTS.map((c) => {
          const copy = nb.consent.items[c.id];
          const isOn = on[c.id];
          const isOpen = !!open[c.id];
          const link = 'link' in copy ? copy.link : undefined;
          return (
            <View key={c.id} style={[styles.cbox, shadow.card, isOn && styles.cboxOn]}>
              <View style={styles.crow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isOn }}
                  accessibilityLabel={(copy.pre + (link ?? '')).trim()}
                  onPress={() => toggle(c.id)}
                  style={styles.chkhit}
                >
                  <Checkbox checked={isOn} />
                </Pressable>
                <View style={styles.ctext}>
                  <Text style={text.consent}>
                    {copy.pre}
                    {link && c.href ? (
                      <Text style={styles.link} accessibilityRole="link" onPress={() => router.push(c.href!)}>
                        {link}
                      </Text>
                    ) : null}
                  </Text>
                  <View style={styles.cmeta}>
                    <Pill
                      label={c.required ? nb.consent.tagRequired : nb.consent.tagOptional}
                      tone={c.required ? 'neutral' : 'line'}
                    />
                    {c.id === 'age' && vippsIdentity ? <VerifiedBadge label={nb.consent.viaVipps} size={14} /> : null}
                    {isOn && stamps[c.id] ? (
                      <FadeInView style={styles.tstamp}>
                        <Icon name="clock" size={14} color={colors.okText} />
                        <Text style={text.stamp}>{nb.consent.acceptedAt(stamps[c.id]!)}</Text>
                      </FadeInView>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    onPress={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                    style={styles.more}
                  >
                    <Text style={text.more}>{nb.consent.whatMeans}</Text>
                    <Chevron open={isOpen} />
                  </Pressable>
                  {isOpen ? (
                    <FadeUp delay={0} style={styles.explain}>
                      <Text style={[text.explain, styles.exTitle]}>{copy.exTitle}</Text>
                      {copy.points.map((p) => (
                        <View key={p} style={styles.li}>
                          <Text style={text.explain}>•</Text>
                          <Text style={[text.explain, styles.flex]}>{p}</Text>
                        </View>
                      ))}
                    </FadeUp>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.gdpr}>
        <Icon name="lock" size={18} color={colors.cyanDeep} />
        <Text style={[text.infoBox, styles.flex]}>
          {nb.consent.gdprPre}
          <Text style={styles.gdprLink} accessibilityRole="link" onPress={() => router.push('/personvern')}>
            {nb.consent.gdprLink}
          </Text>
          .
        </Text>
      </View>
    </Screen>
  );
}

function IdentityCard({ id }: { id: VippsIdentity }) {
  return (
    <FadeUp delay={150} style={styles.idWrap}>
      <View style={[styles.idc, shadow.medium]}>
        <View style={styles.bgc} />
        <View style={styles.idTop}>
          <Avatar initials={id.initials} me size={56} ring={false} />
          <View style={styles.idName}>
            <Text style={[text.eyebrow, styles.idEyebrow]}>{nb.consent.idEyebrow}</Text>
            <Text style={text.h3}>{id.name}</Text>
          </View>
          <View style={styles.shield}>
            <Icon name="shield" size={18} color={colors.ok} />
          </View>
        </View>
        <View style={styles.idRows}>
          <KeyValueRow label={nb.consent.idPhone} value={id.phoneMasked} />
          <KeyValueRow label={nb.consent.idBirthYear} value={String(id.birthYear)} />
          <KeyValueRow label={nb.consent.idStatus} value={<VerifiedBadge label={nb.consent.idVipps} />} last />
        </View>
      </View>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 4, paddingHorizontal: screenPadding },
  stp: { width: 76, alignItems: 'center', gap: 8 },
  stpN: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stpDone: { backgroundColor: colors.ok, borderColor: colors.ok },
  stpCur: { backgroundColor: colors.ink, borderColor: colors.ink },
  sline: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.progressTrack,
    marginTop: 16,
    overflow: 'hidden',
  },
  slineFill: { height: '100%', backgroundColor: colors.ok },
  head: { paddingHorizontal: screenPadding, marginTop: 24 },
  h1: { fontSize: 29, lineHeight: 31, letterSpacing: -0.87 },
  intro: { color: colors.mute, marginTop: 8 },
  idWrap: { paddingHorizontal: screenPadding, marginTop: 20 },
  idc: { borderRadius: 26, backgroundColor: colors.white, padding: 18, overflow: 'hidden' },
  bgc: {
    position: 'absolute',
    right: -60,
    top: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.limeSoft,
  },
  idTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  idName: { flex: 1, minWidth: 0, gap: 5 },
  idEyebrow: { fontSize: 11 },
  shield: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.okTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idRows: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.line2 },
  sectionHead: {
    paddingHorizontal: screenPadding,
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, width: 170 },
  reqbar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.progressTrack, overflow: 'hidden' },
  reqFill: { height: '100%', borderRadius: 3, backgroundColor: colors.lime },
  list: { paddingHorizontal: screenPadding, gap: 12, marginTop: 14 },
  cbox: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cboxOn: { borderColor: colors.consentOnBorder, backgroundColor: colors.consentOnBg },
  crow: { flexDirection: 'row', gap: 6, paddingTop: 10, paddingRight: 12, paddingBottom: 12, paddingLeft: 6 },
  chkhit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ctext: { flex: 1, minWidth: 0, paddingTop: 10 },
  link: { fontFamily: text.label.fontFamily, color: colors.cyanDeep, textDecorationLine: 'underline' },
  cmeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 },
  tstamp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, marginTop: 4, alignSelf: 'flex-start' },
  explain: {
    marginTop: 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surface2,
  },
  exTitle: { fontFamily: text.label.fontFamily, color: colors.ink, marginBottom: 4 },
  li: { flexDirection: 'row', gap: 8, marginVertical: 3, paddingLeft: 4 },
  gdpr: {
    marginHorizontal: screenPadding,
    marginTop: 18,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.cyanTint,
  },
  gdprLink: { fontFamily: text.label.fontFamily, color: colors.cyanDeep, textDecorationLine: 'underline' },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  okCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ok,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
