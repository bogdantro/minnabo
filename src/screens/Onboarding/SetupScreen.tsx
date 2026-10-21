import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import nb from '@/i18n/nb';
import type { Purpose } from '@/domain/types';
import { displayNameOptions } from '@/domain/displayName';
import { supabase } from '@/lib/supabase';
import { useVippsIdentity } from '@/auth/identity';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { profileKeys } from '@/api/queries';
import { detectKommune, locationErrorText } from '@/lib/geo';
import { pickAndUpload } from '@/lib/uploads';
import { toast } from '@/lib/toast';
import { reportError } from '@/lib/reporting';
import { KommuneWaitlist } from '@/components/KommuneWaitlist';
import { DisplayNamePicker } from '@/components/DisplayNamePicker';
import { KOMMUNE_AREAS, LAUNCH_KOMMUNER } from '@/data/kommuner';
import { colors, radius, screenPadding, shadow, sizes, text } from '@/theme/theme';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import {
  Button,
  Chip,
  Confetti,
  ErrorText,
  FadeUp,
  Field,
  Icon,
  IconButton,
  Input,
  ListGroup,
  ListRow,
  Note,
  OptionCard,
  PaymentNote,
  Pill,
  Radio,
  ScaleIn,
  Screen,
  Shake,
  Sheet,
  SlideIn,
  StepProgress,
  StickyFooter,
  TextLink,
  VerifiedBadge,
  type IconKey,
} from '@/components/ui';

const logo = require('../../../assets/logo-icon.png');

type Step = 1 | 2 | 3 | 4;
type Photo = { path: string; url: string } | null;


const ROLES: { id: Purpose; icon: IconKey; tileBg: string; tileFg: string }[] = [
  { id: 'NEED_HELP', icon: 'clip', tileBg: colors.limeTint, tileFg: colors.limeDeep },
  { id: 'WANT_JOBS', icon: 'hand', tileBg: colors.cyanTint, tileFg: colors.cyanDeep },
  { id: 'BOTH', icon: 'repeat', tileBg: colors.lime, tileFg: colors.ink },
];

const CONFETTI = [
  colors.lime,
  colors.cyan,
  colors.confettiGreen,
  colors.accentBlue,
  colors.ink,
  colors.star,
  colors.confettiLime,
  colors.notifDot,
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Radar: two rings, rotating flat sweep while locating, pulses, dot → check when found. */
function Radar({ state }: { state: 'idle' | 'busy' | 'done' }) {
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (state === 'busy') {
      spin.set(withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1));
      pulse.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1));
    } else {
      cancelAnimation(spin);
      cancelAnimation(pulse);
      spin.set(0);
      pulse.set(0);
    }
  }, [state, spin, pulse]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const ring = (offset: number) => () => {
    'worklet';
    const v = (pulse.value + offset) % 1;
    return { opacity: 1 - v, transform: [{ scale: 0.7 + 1.2 * v }] };
  };
  const p1 = useAnimatedStyle(ring(0));
  const p2 = useAnimatedStyle(ring(0.5));

  return (
    <View style={styles.radarw}>
      {state === 'busy' ? (
        <>
          <Animated.View style={[styles.rpulse, p1]} />
          <Animated.View style={[styles.rpulse, p2]} />
        </>
      ) : null}
      <View style={styles.radar}>
        <View style={[styles.rg, { top: 10, left: 10, right: 10, bottom: 10 }]} />
        <View style={[styles.rg, { top: 21, left: 21, right: 21, bottom: 21 }]} />
        {state === 'busy' ? (
          <Animated.View style={[StyleSheet.absoluteFill, sweep]}>
            {/* flat 60° wedge (no gradients) */}
            <Svg width={64} height={64} viewBox="0 0 64 64">
              <Path d="M32 32 L32 0 A32 32 0 0 0 4.29 16 Z" fill={colors.radarSweep} />
            </Svg>
          </Animated.View>
        ) : null}
        {state === 'done' ? (
          <ScaleIn style={styles.radarCheck}>
            <Icon name="check" size={16} color={colors.ink} />
          </ScaleIn>
        ) : state === 'idle' ? (
          <View style={[styles.rdot, shadow.radarDot]} />
        ) : null}
      </View>
    </View>
  );
}

/** Onboarding · Oppsett (design/screens/Oppsett.dc.html): navn → bruk → sted → velkommen. */
export function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  // Full name from Vipps – shown locked as "Fra Vipps".
  const vippsName = useVippsIdentity()?.name ?? null;

  const [step, setStep] = useState<Step>(1);
  const [dir, setDir] = useState<'forward' | 'back'>('forward');
  const [display, setDisplay] = useState(vippsName ?? me.displayName ?? '');
  const [photo, setPhoto] = useState<Photo>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [role, setRole] = useState<Purpose | null>(null);
  const [kommune, setKommune] = useState<string | null>(null);
  const [locState, setLocState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [located, setLocated] = useState<string | null>(null);
  // The kommune list stays hidden until the position fails or the person says it's wrong.
  const [manual, setManual] = useState(false);
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [shakeN, setShakeN] = useState(0);
  const [saving, setSaving] = useState(false);

  // The profile name may arrive after first render.
  const [nameTouched, setNameTouched] = useState(false);
  if (!nameTouched && !display && me.displayName) setDisplay(me.displayName);

  // With a Vipps name the visningsnavn is one of its forms (also checked in the database, 0068).
  // Start on the short form («Mari H.») unless the saved name already is one of them.
  const vippsOptions = useMemo(() => (vippsName ? displayNameOptions(vippsName) : []), [vippsName]);
  if (!nameTouched && vippsOptions.length && !vippsOptions.includes(display)) setDisplay(vippsOptions[1] ?? vippsOptions[0]);

  const name = display.trim();
  // an account without a Vipps name (an old test login) types its own, with the same suggestions
  const suggestions = useMemo(() => displayNameOptions(me.displayName ?? ''), [me.displayName]);
  const kommuner = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return LAUNCH_KOMMUNER.filter((k) => !needle || k.toLowerCase().includes(needle));
  }, [q]);
  const areas = KOMMUNE_AREAS[kommune ?? 'Lillehammer'] ?? [];

  const fail = (msg: string) => {
    setErr(msg);
    setShakeN((n) => n + 1);
  };
  const toastAbove = (msg: string, icon: IconKey) => toast.success(msg, { icon, bottom: 130 });

  const save = async () => {
  setSaving(true);

  try {
    // Oppsett is only reached after the Vipps login, so there is always a session.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const supabaseUserId = session?.user?.id;

    if (!supabaseUserId) {
      throw new Error('Supabase-bruker kunne ikke opprettes.');
    }


    const now = new Date().toISOString();

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: supabaseUserId,
          display_name: name,
          initials: initialsOf(name) || 'N',
          purpose: role,
          municipality: kommune,
          place: area.trim() || kommune,
          ...(photo?.path ? { avatar_path: photo.path } : {}),
          onboarded_at: now,
          updated_at: now,
        },
        {
          onConflict: 'id',
        },
      );

    if (error) {
      throw error;
    }

    queryClient.invalidateQueries({
      queryKey: profileKeys.profile(supabaseUserId),
    });

    return true;
  } catch (e) {
    reportError(e, {
      where: 'SetupScreen.save',
    });

    fail(nb.setup.saveFailed);

    return false;
  } finally {
    setSaving(false);
  }
};

  const next = async () => {
    if (step === 1) {
      if (name.length < 2) return fail(nb.setup.errNameShort);
      if (name.length > 30) return fail(nb.setup.errNameLong);
    }
    if (step === 2 && !role) return fail(nb.setup.errRole);
    if (step === 3) {
      if (!kommune) return fail(manual ? nb.setup.errKommune : nb.setup.errLocateFirst);
      if (!(await save())) return;
    }
    setErr(null);
    setDir('forward');
    setStep((s) => (s + 1) as Step);
  };

  const back = () => {
    setErr(null);
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace('/samtykker');
      return;
    }
    setDir('back');
    setStep((s) => (s - 1) as Step);
  };

  const locate = async () => {
    if (locState === 'busy') return;
    setErr(null);
    setLocState('busy');
    const res = await detectKommune();
    if ('municipality' in res) {
      setLocState('done');
      setLocated(res.municipality);
      setKommune(res.municipality);
      setQ('');
      toastAbove(nb.setup.found(res.municipality), 'pin');
    } else {
      setLocState('idle');
      setManual(true);
      fail(locationErrorText(res.error));
    }
  };

  const choosePhoto = async (source: 'camera' | 'library') => {
  setPhotoOpen(false);
  setPhotoBusy(true);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const supabaseUserId = session?.user?.id;

    if (!supabaseUserId) throw new Error(nb.setup.photoFailed);

    const res = await pickAndUpload({
      bucket: 'avatars',
      folder: supabaseUserId,
      source,
    });

    if (res) {
      setPhoto({
        path: res.path,
        url: res.publicUrl,
      });

      toastAbove(nb.setup.toastPhotoAdded, 'camera');
    }
  } catch (e) {
    reportError(e, { where: 'SetupScreen.photo' });

    toast.error(
      e instanceof Error && e.message
        ? e.message
        : nb.setup.photoFailed,
      { bottom: 130 },
    );
  } finally {
    setPhotoBusy(false);
  }
};

  if (step === 4) {
    return <Done name={name} role={role ?? 'BOTH'} kommune={kommune ?? ''} area={area.trim()} hasPhoto={!!photo} />;
  }

  const initials = initialsOf(name) || '?';

  return (
    <KeyboardAvoider>
      <Screen
        scroll
        spacer="foot"
        header={
          <View style={[styles.wtop, { paddingTop: insets.top + 10 }]}>
            <IconButton icon="back" accessibilityLabel="Tilbake" onPress={back} />
            <Text style={[text.wizardTop, styles.wtopT]}>
              {nb.setup.top}
              <Text style={{ color: colors.ink }}>{nb.setup.step(step)}</Text>
            </Text>
            <View style={styles.side} />
          </View>
        }
        footer={
          <StickyFooter>
            {err ? (
              <View style={styles.errRow}>
                <ErrorText shakeKey={shakeN}>{err}</ErrorText>
              </View>
            ) : null}
            <Shake shakeKey={shakeN}>
              <Button
                label={step === 3 ? nb.setup.finish : nb.setup.next}
                variant="ink"
                size="lg"
                iconRight="arrow"
                loading={saving}
                onPress={next}
              />
            </Shake>
          </StickyFooter>
        }
      >
        <View style={styles.prog}>
          <StepProgress step={step} total={3} showLabel={false} />
        </View>

        <SlideIn key={step} direction={dir} style={styles.body}>
          {step === 1 ? (
            <>
              <Text style={text.eyebrow}>{nb.setup.s1Eyebrow}</Text>
              <Text style={[text.h1, styles.title]} accessibilityRole="header">
                {nb.setup.s1Title}
              </Text>
              <Text style={[text.body, styles.lead]}>{vippsName ? nb.setup.s1BodyVipps : nb.setup.s1Body}</Text>

              <View style={styles.photoBlock}>
                <ScaleIn style={styles.phwrap}>
                  {photo ? (
                    <View style={[styles.phc, shadow.photoRing]}>
                      <Image source={{ uri: photo.url }} style={styles.phImg} accessibilityLabel="Profilbilde valgt" />
                    </View>
                  ) : (
                    <View style={[styles.phc, styles.phNone]} accessibilityElementsHidden>
                      <Text style={styles.phInitials}>{initials}</Text>
                    </View>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={photo ? nb.setup.photoChange : nb.setup.photoAdd}
                    onPress={() => setPhotoOpen(true)}
                    disabled={photoBusy}
                    style={styles.cambtn}
                  >
                    <Icon name="camera" size={18} color={colors.white} />
                  </Pressable>
                </ScaleIn>
                <Text style={text.meta}>{photo ? nb.setup.photoDone : nb.setup.photoHint}</Text>
              </View>

              {vippsName ? (
                <Field label={nb.setup.fullName} hint={nb.setup.fromVipps} style={styles.mt22}>
                  <View style={styles.lockf}>
                    <Icon name="lock" size={16} color={colors.faint} />
                    <Text style={[text.lockedField, styles.flex]}>{vippsName}</Text>
                    <VerifiedBadge label={nb.setup.confirmed} />
                  </View>
                </Field>
              ) : null}

              {vippsName ? (
                <Field label={nb.setup.displayName} style={styles.mt18}>
                  <DisplayNamePicker
                    fullName={vippsName}
                    value={display}
                    onChange={(v) => {
                      setNameTouched(true);
                      setDisplay(v);
                      setErr(null);
                    }}
                  />
                </Field>
              ) : (
                <Field label={nb.setup.displayName} hint={`${name.length}/30`} style={styles.mt18}>
                  <Input
                    value={display}
                    onChangeText={(v) => {
                      setNameTouched(true);
                      setDisplay(v.slice(0, 40));
                      setErr(null);
                    }}
                    placeholder={nb.setup.namePlaceholder}
                    autoComplete="nickname"
                    accessibilityLabel={nb.setup.displayName}
                    error={!!err && step === 1}
                  />
                </Field>
              )}
              {!vippsName && suggestions.length > 1 ? (
                <View style={styles.chips}>
                  {suggestions.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      size="sm"
                      selected={name === s}
                      onPress={() => {
                        setNameTouched(true);
                        setDisplay(s);
                        setErr(null);
                      }}
                    />
                  ))}
                </View>
              ) : null}
              <Note icon="eye" style={styles.mt16}>
                {nb.setup.nameNote}
              </Note>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={text.eyebrow}>{nb.setup.s2Eyebrow}</Text>
              <Text style={[text.h1, styles.title]} accessibilityRole="header">
                {nb.setup.s2Title}
              </Text>
              <Text style={[text.body, styles.lead]}>{nb.setup.s2Body}</Text>
              <View style={styles.roles} accessibilityRole="radiogroup" accessibilityLabel={nb.setup.s2Title}>
                {ROLES.map((r) => {
                  const on = role === r.id;
                  const copy = nb.setup.roles[r.id];
                  return (
                    <OptionCard
                      key={r.id}
                      selected={on}
                      onPress={() => {
                        setRole(r.id);
                        setErr(null);
                      }}
                      accessibilityLabel={`${copy.title}. ${copy.desc}`}
                      style={[
                        styles.rcard,
                        shadow.card,
                        on && r.id === 'NEED_HELP' && [styles.rNeed, shadow.roleNeedOn],
                        on && r.id === 'WANT_JOBS' && [styles.rOffer, shadow.roleOfferOn],
                        on && r.id === 'BOTH' && [styles.rBoth, shadow.roleBothOn],
                      ]}
                    >
                      <View style={[styles.rt, { backgroundColor: r.tileBg }]}>
                        <Icon name={r.icon} size={28} color={r.tileFg} />
                      </View>
                      <View style={styles.rb}>
                        <Text style={text.roleTitle}>{copy.title}</Text>
                        <Text style={text.roleDesc}>{copy.desc}</Text>
                        <View style={styles.rpills}>
                          {r.id !== 'WANT_JOBS' ? (
                            <Pill
                              label={r.id === 'BOTH' ? nb.setup.pillNeedShort : nb.setup.pillNeed}
                              tone="need"
                              dot
                              size="sm"
                              style={styles.rpill}
                            />
                          ) : null}
                          {r.id !== 'NEED_HELP' ? (
                            <Pill label={nb.setup.pillOffer} tone="offer" dot size="sm" style={styles.rpill} />
                          ) : null}
                        </View>
                      </View>
                      <View style={[styles.rchk, on && styles.rchkOn]}>
                        {on ? (
                          <ScaleIn>
                            <Icon name="check" size={16} color={colors.lime} strokeWidth={3} />
                          </ScaleIn>
                        ) : null}
                      </View>
                    </OptionCard>
                  );
                })}
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={text.eyebrow}>{nb.setup.s3Eyebrow}</Text>
              <Text style={[text.h1, styles.title]} accessibilityRole="header">
                {nb.setup.s3Title}
              </Text>
              <Text style={[text.body, styles.lead]}>{nb.setup.s3Body}</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  locState === 'done' && located ? nb.setup.locDone(located) : nb.setup.locIdle
                }
                accessibilityState={{ busy: locState === 'busy' }}
                onPress={locate}
                style={[styles.loccard, shadow.locCard]}
              >
                <View style={styles.glowb} />
                <Radar state={locState} />
                <View style={styles.locText}>
                  <Text style={text.locTitle}>
                    {locState === 'busy'
                      ? nb.setup.locBusy
                      : locState === 'done' && located
                        ? nb.setup.locDone(located)
                        : nb.setup.locIdle}
                  </Text>
                  <Text style={text.locSub}>
                    {locState === 'busy' ? nb.setup.locBusySub : locState === 'done' ? nb.setup.locDoneSub : nb.setup.locIdleSub}
                  </Text>
                </View>
                {locState === 'idle' ? (
                  <View style={styles.locIcon}>
                    <Icon name="locate" size={18} color={colors.white} />
                  </View>
                ) : null}
              </Pressable>
              {locState === 'done' && located ? (
                <FadeUp style={styles.okchip}>
                  <ScaleIn style={styles.okCircle}>
                    <Icon name="check" size={14} color={colors.white} />
                  </ScaleIn>
                  <Text style={text.okChip}>{nb.setup.found(located)}</Text>
                </FadeUp>
              ) : null}

              {locState === 'done' && !manual ? (
                <TextLink label={nb.setup.pickOther} icon={null} onPress={() => setManual(true)} style={styles.pickOther} />
              ) : null}

              {manual ? (
                <>
                  <View style={styles.orline}>
                    <View style={styles.orRule} />
                    <Text style={text.orLine}>{nb.setup.orPick}</Text>
                    <View style={styles.orRule} />
                  </View>

                  <View style={styles.search}>
                    <Icon name="search" size={20} color={colors.mute} />
                    <TextInput
                      value={q}
                      onChangeText={setQ}
                      placeholder={nb.setup.searchKommune}
                      placeholderTextColor={colors.mute}
                      accessibilityLabel={nb.setup.searchKommune}
                      style={[text.input, styles.searchInput]}
                    />
                    {q ? (
                      <IconButton icon="x" iconSize={16} variant="ghost" accessibilityLabel={nb.setup.clearSearch} onPress={() => setQ('')} />
                    ) : null}
                  </View>

                  <View style={styles.klist} accessibilityRole="radiogroup">
                    {kommuner.map((k) => {
                      const on = kommune === k;
                      return (
                        <OptionCard
                          key={k}
                          selected={on}
                          accessibilityLabel={k}
                          onPress={() => {
                            if (kommune && kommune !== k) setArea('');
                            setKommune(k);
                            setErr(null);
                          }}
                          style={styles.kopt}
                        >
                          <Radio selected={on} />
                          <Text style={[text.optionName, styles.flex]}>{k}</Text>
                          {located === k ? <Pill label={nb.setup.yourPosition} tone="ok" icon="locate" /> : null}
                          <Text style={text.meta}>{nb.setup.region}</Text>
                        </OptionCard>
                      );
                    })}
                    {kommuner.length === 0 ? (
                      <ScaleIn style={styles.noK}>
                        <View style={styles.noKIcon}>
                          <Icon name="map" size={18} color={colors.ink2} />
                        </View>
                        <Text style={[text.metaBold, styles.center, { fontSize: 14.5 }]}>{nb.setup.noKommune(q.trim())}</Text>
                        <Text style={[text.meta, styles.center]}>{nb.setup.onlyInnlandet}</Text>
                      </ScaleIn>
                    ) : null}
                  </View>
                  <View style={styles.waitlist}>
                    <KommuneWaitlist initial={kommuner.length === 0 ? q.trim() : undefined} />
                  </View>
                </>
              ) : null}

              {kommune ? (
                <>
                  <Field label={nb.setup.area} hint={nb.setup.optional} style={styles.mt22}>
                    <Input
                      icon="pin"
                      value={area}
                      onChangeText={setArea}
                      placeholder={nb.setup.areaPlaceholder}
                      accessibilityLabel={nb.setup.area}
                    />
                  </Field>
                  {areas.length ? (
                    <View style={styles.chips}>
                      {areas.map((a) => (
                        <Chip
                          key={a}
                          label={a}
                          size="sm"
                          selected={area === a}
                          onPress={() => setArea(area === a ? '' : a)}
                        />
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}

              <View style={styles.tip}>
                <Icon name="shield" size={18} color={colors.limeDeep} />
                <Text style={[text.tipBox, styles.flex]}>{nb.setup.privacy}</Text>
              </View>
            </>
          ) : null}
        </SlideIn>

        <Sheet visible={photoOpen} onClose={() => setPhotoOpen(false)} title={nb.setup.photoSheetTitle}>
          <Text style={[text.meta, styles.sheetBody]}>{nb.setup.photoSheetBody}</Text>
          <ListGroup style={styles.sheetList}>
            <ListRow
              icon="camera"
              iconBg={colors.cyanTint}
              iconColor={colors.cyanDeep}
              title={nb.setup.takePhoto}
              subtitle={nb.setup.takePhotoSub}
              onPress={() => choosePhoto('camera')}
            />
            <ListRow
              icon="image"
              iconBg={colors.limeTint}
              iconColor={colors.limeDeep}
              title={nb.setup.pickPhoto}
              subtitle={nb.setup.pickPhotoSub}
              onPress={() => choosePhoto('library')}
            />
            {photo ? (
              <ListRow
                icon="trash"
                iconBg={colors.dangerTint}
                iconColor={colors.danger}
                title={nb.setup.removePhoto}
                danger
                chevron={false}
                onPress={() => {
                  setPhoto(null);
                  setPhotoOpen(false);
                  toastAbove(nb.setup.toastPhotoRemoved, 'trash');
                }}
              />
            ) : null}
          </ListGroup>
        </Sheet>
      </Screen>
    </KeyboardAvoider>
  );
}

/** Final step: celebration with confetti and a summary of the choices. */
function Done({
  name,
  role,
  kommune,
  area,
  hasPhoto,
}: {
  name: string;
  role: Purpose;
  kommune: string;
  area: string;
  hasPhoto: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const first = name.split(/\s+/)[0] || name;
  const summary: { icon: IconKey; t: string }[] = [
    { icon: 'user', t: name },
    { icon: role === 'WANT_JOBS' ? 'hand' : role === 'NEED_HELP' ? 'clip' : 'repeat', t: nb.setup.roles[role].summary },
    { icon: 'pin', t: (area ? `${area}, ` : '') + kommune },
  ];
  if (hasPhoto) summary.push({ icon: 'camera', t: nb.setup.photoAdded });

  const y = useSharedValue(0);
  useEffect(() => {
    const half = { duration: 2500, easing: Easing.inOut(Easing.ease) };
    y.set(withDelay(300, withRepeat(withSequence(withTiming(-9, half), withTiming(0, half)), -1)));
    return () => cancelAnimation(y);
  }, [y]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Screen scroll contentStyle={[styles.done, { paddingTop: insets.top + 64, paddingBottom: Math.max(40, insets.bottom + 16) }]}>
      <ScaleIn delay={50}>
        <View style={styles.celebRing} />
        <View style={[styles.celeb, shadow.logoTile]}>
          <Animated.View style={float}>
            <Image source={logo} style={styles.celebLogo} />
          </Animated.View>
        </View>
      </ScaleIn>
      <FadeUp delay={150} style={styles.mt26}>
        <Pill label={nb.setup.ready} tone="accent" icon="sparkle" size="lg" />
      </FadeUp>
      <FadeUp delay={200}>
        <Text style={[text.celebrate, styles.center, styles.mt14]} accessibilityRole="header">
          {nb.setup.welcome(first)}
        </Text>
      </FadeUp>
      <FadeUp delay={250}>
        <Text style={[text.body, styles.center, styles.doneSub]}>{nb.setup.doneSub[role](kommune)}</Text>
      </FadeUp>
      <FadeUp delay={300} style={styles.sumrow}>
        {summary.map((s) => (
          <View key={s.icon + s.t} style={[styles.sumPill, shadow.card]}>
            <Icon name={s.icon} size={16} color={colors.ink} />
            <Text style={[text.pillLg, { color: colors.ink }]}>{s.t}</Text>
          </View>
        ))}
      </FadeUp>
      <FadeUp delay={400} style={styles.doneActions}>
        <Button label={nb.setup.explore} size="lg" iconRight="arrow" onPress={() => router.replace('/')} />
        <Button label={nb.setup.firstPost} variant="ghost" icon="plus" onPress={() => router.replace('/legg-ut')} />
        <PaymentNote text={nb.setup.paymentNote} style={styles.noteCenter} />
      </FadeUp>
      <Confetti count={34} colors={CONFETTI} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  waitlist: { marginTop: 12 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  mt22: { marginTop: 22 },
  mt26: { marginTop: 26 },
  wtop: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, zIndex: 5 },
  wtopT: { flex: 1, textAlign: 'center' },
  side: { width: sizes.iconButton },
  prog: { paddingHorizontal: screenPadding, marginTop: 14 },
  body: { paddingTop: 26, paddingHorizontal: screenPadding },
  title: { marginTop: 10, fontSize: 29, lineHeight: 31, letterSpacing: -0.87 },
  lead: { color: colors.mute, marginTop: 8 },
  photoBlock: { marginTop: 26, alignItems: 'center', gap: 10 },
  phwrap: { width: 116, height: 116 },
  phc: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center' },
  phNone: { backgroundColor: colors.white, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.control },
  phImg: { width: 116, height: 116, borderRadius: 58 },
  phInitials: { fontFamily: text.h1.fontFamily, fontSize: 38, letterSpacing: -0.76, color: colors.ink },
  cambtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockf: {
    height: sizes.input,
    borderRadius: radius.input,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.line2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  roles: { gap: 12, marginTop: 22 },
  rcard: {
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.line,
  },
  rNeed: { borderColor: colors.limeDot },
  rOffer: { borderColor: colors.cyan },
  rBoth: { borderColor: colors.ink },
  rt: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rb: { flex: 1, minWidth: 0, gap: 5 },
  rpills: { flexDirection: 'row', gap: 6, marginTop: 3 },
  rpill: { height: 22 },
  rchk: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rchkOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  loccard: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 16,
    borderRadius: 24,
    backgroundColor: colors.ink,
    overflow: 'hidden',
  },
  glowb: {
    position: 'absolute',
    right: -50,
    top: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.lime,
    opacity: 0.28,
  },
  radarw: { width: 64, height: 64 },
  radar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 32,
    backgroundColor: colors.radarFill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rg: { position: 'absolute', borderRadius: 32, borderWidth: 1.5, borderColor: colors.radarRing },
  rpulse: { position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0, borderRadius: 32, borderWidth: 2, borderColor: colors.lime },
  rdot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.lime },
  radarCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locText: { flex: 1, gap: 4 },
  locIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.onInk12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okchip: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.okTint,
  },
  okCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.ok,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orline: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20, marginBottom: 16 },
  orRule: { flex: 1, height: 1, backgroundColor: colors.rangeTrack },
  search: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 18,
    paddingRight: 6,
  },
  searchInput: { flex: 1, height: '100%', fontSize: 15.5 },
  klist: { gap: 8, marginTop: 10 },
  pickOther: { alignSelf: 'center', marginTop: 12 },
  kopt: { paddingVertical: 13, paddingHorizontal: 14 },
  noK: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: radius.option,
    padding: 18,
    alignItems: 'center',
    gap: 6,
  },
  noKIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutralPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tip: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.limeTint,
  },
  errRow: { alignItems: 'center' },
  sheetBody: { marginTop: -6, marginBottom: 14 },
  sheetList: { borderWidth: 1, borderColor: colors.line, ...shadow.none },
  done: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24 },
  celebRing: {
    position: 'absolute',
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    borderRadius: 50,
    backgroundColor: colors.lime,
    opacity: 0.35,
  },
  celeb: {
    width: 128,
    height: 128,
    borderRadius: 40,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebLogo: { width: 92, height: 92 },
  doneSub: { color: colors.mute, marginTop: 12, maxWidth: 320 },
  sumrow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 22 },
  sumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  doneActions: { alignSelf: 'stretch', gap: 10, marginTop: 'auto', paddingTop: 34 },
  noteCenter: { justifyContent: 'center', marginTop: 6 },
});
