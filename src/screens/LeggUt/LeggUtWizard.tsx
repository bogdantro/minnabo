import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { draftStore } from '@/data/draftStore';
import { KOMMUNE_AREAS, LAUNCH_KOMMUNER } from '@/data/kommuner';
import { detectKommune, locationErrorText } from '@/lib/geo';
import { pickAndUploadMany } from '@/lib/uploads';
import { slugForArtId } from '@/domain/categories';
import { useListing, useListingEditData, usePriceGuidance } from '@/api/queries';
import { formatAmount } from '@/components/ui/Field';
import { toast } from '@/lib/toast';
import { useSession } from '@/auth/session';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  categoryLabels,
  colors,
  radius,
  safeTopExtra,
  screenPadding,
  shadow,
  text,
  type CategoryId,
} from '@/theme/theme';
import {
  AmountInput,
  Button,
  CategoryArt,
  Chip,
  Dialog,
  ErrorText,
  FadeUp,
  Field,
  FooterRow,
  Icon,
  IconButton,
  Input,
  ListGroup,
  ListingCard,
  ListRow,
  Note,
  OptionCard,
  PhotoAddTile,
  Radio,
  RangeSlider,
  ScaleIn,
  Screen,
  Segmented,
  SelectBox,
  Shake,
  Sheet,
  SlideIn,
  Spinner,
  StickyFooter,
  Toggle,
  type IconKey,
} from '@/components/ui';
import { EQUIPMENT, FORMS, MAX_HELPERS, QUICK_AMOUNTS, STEP_NAMES, TIMES_OF_DAY, type IntakeField } from './wizardConfig';
import {
  applyCategory,
  buildListing,
  emptyWizard,
  extrasFor,
  isApprox,
  isWizardState,
  wizardFromListing,
  type Answer,
  fmtKr,
  hoursLabel,
  placeLine,
  summary,
  upcomingDays,
  validateStep,
  whenLabel,
  wizardDraft,
  type WizardError,
  type WizardState,
} from './wizardModel';

// "Annet" first, so nobody has to scroll past every category to find it
const CATS: CategoryId[] = ['annet', ...(Object.keys(categoryLabels) as CategoryId[]).filter((c) => c !== 'annet')];
const LAST = 9;
const MAX_PHOTOS = 6;

/** "/" and long words wrap nicely in the 3-column grid. */
const tileLabel = (l: string) => l.replace('/', '/​').replace('Arrangementshjelp', 'Arrangements­hjelp');

/** `.stepper` – − value + (44 px buttons). */
function Stepper({
  value,
  onMinus,
  onPlus,
  minusLabel,
  plusLabel,
  card,
}: {
  value: ReactNode;
  onMinus: () => void;
  onPlus: () => void;
  minusLabel: string;
  plusLabel: string;
  card?: boolean;
}) {
  return (
    <View style={[styles.stepper, card && [styles.stepperCard, shadow.card]]}>
      <Pressable accessibilityRole="button" accessibilityLabel={minusLabel} onPress={onMinus} style={styles.stepBtn}>
        <Icon name="minus" size={18} />
      </Pressable>
      <View style={styles.flex}>{value}</View>
      <Pressable accessibilityRole="button" accessibilityLabel={plusLabel} onPress={onPlus} style={styles.stepBtn}>
        <Icon name="plus" size={18} />
      </Pressable>
    </View>
  );
}

/** Decorative map with the approximate area as a breathing circle – never a pin (rule 6). */
function AreaMap({ label }: { label: string }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.set(withRepeat(withSequence(withTiming(1.07, { duration: 1600, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) })), -1));
    return () => cancelAnimation(s);
  }, [s]);
  const zone = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <View style={styles.mapc} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={`h${i}`} style={[styles.gridH, { top: i * 26 }]} />
      ))}
      {Array.from({ length: 16 }).map((_, i) => (
        <View key={`v${i}`} style={[styles.gridV, { left: i * 26 }]} />
      ))}
      <View style={styles.lake} />
      <View style={[styles.road, { left: -20, right: -20, top: 58, height: 9 }]} />
      <View style={[styles.road, { left: 140, top: -20, bottom: -20, width: 8 }]} />
      <View style={[styles.road, { left: 40, top: 100, width: 180, height: 6 }]} />
      <Animated.View style={[styles.zone, zone]} />
      <View style={[styles.mapLbl, shadow.card]}>
        <Icon name="pin" size={14} color={colors.limeDeep} />
        <Text style={text.metaBold}>{label}</Text>
      </View>
    </View>
  );
}

/**
 * Legg ut – 9-step oppdrag wizard (design/screens/LeggUt.dc.html).
 * Opened directly by the Legg ut button (rule 2). Ends in Forhåndsvisning.
 */
export function LeggUtWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useSession();
  const me = useCurrentUser();
  // Edit mode: /legg-ut?rediger=<id>[&tilbake=<path>] reopens a published oppdrag.
  const params = useLocalSearchParams<{ rediger?: string; tilbake?: string }>();
  const editId = typeof params.rediger === 'string' && params.rediger ? params.rediger : undefined;
  const editing = !!editId;
  const editListing = useListing(editId ?? '');
  const editData = useListingEditData(editId);
  const [editSeeded, setEditSeeded] = useState(false);
  const [s, setS] = useState<WizardState>(() => emptyWizard(me.municipality ?? ''));
  const [step, setStep] = useState(1);
  // every step starts at its top, however far down the previous one was scrolled
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  const [dir, setDir] = useState<'forward' | 'back'>('forward');
  const [ret, setRet] = useState(false);
  const [err, setErr] = useState<WizardError | null>(null);
  const [errN, setErrN] = useState(0);
  const [kSheet, setKSheet] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [located, setLocated] = useState<string | null>(null);
  const [today] = useState(() => new Date());
  const days = useMemo(() => upcomingDays(today), [today]);

  // Edit mode: fill the form from the saved form (or rebuild it from the oppdrag) and open the summary.
  if (editing && !editSeeded && editListing.data && editData.data) {
    setEditSeeded(true);
    const w = editData.data.wizard;
    setS(isWizardState(w) ? { ...emptyWizard(), ...w, photos: editListing.data.images.map((im) => im.url) } : wizardFromListing(editListing.data, editData.data.privateEstimateMinor));
    setStep(LAST);
  }

  // Continue a saved draft ("fortsette der du slapp") – not when editing a published oppdrag.
  useEffect(() => {
    if (editing) return;
    let alive = true;
    wizardDraft.load().then((d) => {
      if (alive && d) {
        setS(d.state);
        setStep(d.step);
      }
    });
    return () => {
      alive = false;
    };
  }, [editing]);

  // Profile kommune may arrive after the first render.
  const [kommuneSeeded, setKommuneSeeded] = useState(false);
  if (!kommuneSeeded && !s.kommune && me.municipality) {
    setKommuneSeeded(true);
    setS((p) => ({ ...p, kommune: me.municipality ?? '' }));
  }

  const edit = (patch: Partial<WizardState>) => {
    setS((p) => ({ ...p, ...patch }));
    setErr(null);
  };
  const go = (n: number, d: 'forward' | 'back', returning = false) => {
    setErr(null);
    setDir(d);
    setRet(returning);
    setStep(n);
  };
  const next = () => {
    const v = validateStep(step, s);
    if (v) {
      setErr(v);
      setErrN((n) => n + 1);
      return;
    }
    if (ret) return go(LAST, 'forward');
    if (step < LAST) go(step + 1, 'forward');
  };
  const back = () => {
    if (step > 1) go(step - 1, 'back');
    else setCloseOpen(true);
  };
  const saveDraft = async () => {
    await wizardDraft.save(s, step);
    toast.success(nb.wizard.draftSaved, { icon: 'bookmark', bottom: 130 });
  };
  const preview = () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const v = validateStep(n, s);
      if (v) {
        go(n, 'back', true);
        setErr(v);
        setErrN((x) => x + 1);
        return;
      }
    }
    draftStore.set(buildListing(s, days), {
      extras: extrasFor(s),
      editId,
      back: typeof params.tilbake === 'string' && params.tilbake ? params.tilbake : editId ? `/oppdrag/${editId}` : undefined,
    });
    router.push('/legg-ut/forhandsvisning');
  };

  const form = FORMS[s.cat ?? 'annet'];
  const { data: guidance } = usePriceGuidance(s.cat ? slugForArtId(s.cat) : undefined);
  const setAnswer = (key: string, a: Answer) => edit({ answers: { ...s.answers, [key]: a } });
  const amt = Number(s.amount) || 0;
  const errOn = (f: WizardError['field']) => err?.field === f;
  const when = whenLabel(s, days);
  // Only the launch kommuner; an oppdrag being edited keeps the kommune it already has.
  const kommuneList = [...new Set([...(s.kommune ? [s.kommune] : []), ...LAUNCH_KOMMUNER])];
  const areaChips = KOMMUNE_AREAS[s.kommune] ?? [];
  const sum = summary(s, days);

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    setLocated(null);
    const res = await detectKommune();
    setLocating(false);
    if ('municipality' in res) {
      const area = res.place && res.place !== res.municipality ? res.place : s.area;
      edit({ kommune: res.municipality, area });
      setLocated(area ? `${area}, ${res.municipality}` : res.municipality);
    } else {
      toast.error(locationErrorText(res.error), { bottom: 130 });
    }
  };

  const [uploading, setUploading] = useState(0);
  const addPhoto = async () => {
    const room = MAX_PHOTOS - s.photos.length;
    if (room <= 0) return;
    try {
      // Pick several at once; uploads run in parallel.
      if (!userId) throw new Error(nb.wizard.photoFailed);
      const urls = (await pickAndUploadMany({ bucket: 'listing-images', folder: userId, max: room, onStart: setUploading })).map((r) => r.publicUrl);
      setUploading(0);
      if (!urls.length) return;
      setS((p) => ({ ...p, photos: [...p.photos, ...urls].slice(0, MAX_PHOTOS) }));
      const n = s.photos.length + urls.length;
      toast.success(n >= MAX_PHOTOS ? nb.wizard.photoAddedMax : nb.wizard.photosAdded(urls.length), { icon: 'image', bottom: 130 });
    } catch (e) {
      setUploading(0);
      toast.error(e instanceof Error ? e.message : nb.wizard.photoFailed, { bottom: 130 });
    }
  };

  const errorLine = err ? (
    <View style={styles.mt14}>
      <ErrorText shakeKey={errN}>{err.message}</ErrorText>
    </View>
  ) : null;

  const header = (
    <View style={[styles.wzh, { paddingTop: insets.top + safeTopExtra }]}>
      <BlurView intensity={36} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.wzhBg]} />
      <View style={styles.subbar}>
        <IconButton icon="back" accessibilityLabel={step === 1 ? nb.wizard.close : nb.wizard.prev} onPress={back} />
        <Text style={[text.subbarTitle, styles.flex, styles.center]} numberOfLines={1} accessibilityRole="header">
          {editing ? nb.wizard.editTitle : nb.wizard.title}
        </Text>
        <IconButton icon="x" accessibilityLabel={nb.wizard.close} onPress={() => setCloseOpen(true)} />
      </View>
      <View style={styles.wzmeta}>
        <View style={styles.st}>
          <Text style={text.eyebrow}>{nb.wizard.stepOf(step, LAST)}</Text>
          <Text style={[text.label, styles.stepName]}>{STEP_NAMES[step - 1]}</Text>
        </View>
        {editing ? null : (
          <Pressable accessibilityRole="button" onPress={saveDraft} style={styles.draftbtn}>
            <Icon name="bookmark" size={16} />
            <Text style={[text.metaBold, { fontSize: 13 }]}>{nb.wizard.saveDraft}</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.progWrap}>
        <ProgressBar value={step / LAST} />
      </View>
    </View>
  );

  return (
    <View style={styles.flex}>
      <Screen
        scroll
        spacer="foot"
        scrollRef={scrollRef}
        scrollProps={{ keyboardDismissMode: 'on-drag' }}
        contentStyle={{ paddingTop: insets.top + 160 }}
        footer={
          <StickyFooter>
            <FooterRow>
              {step > 1 ? (
                <Button
                  label=""
                  icon="back"
                  variant="ghost"
                  size="lg"
                  block={false}
                  accessibilityLabel={nb.wizard.prev}
                  onPress={back}
                  style={styles.backBtn}
                />
              ) : null}
              {step < LAST ? (
                <Button
                  label={ret ? nb.wizard.saveAndReview : nb.wizard.next}
                  size="lg"
                  iconRight="arrow"
                  onPress={next}
                  style={styles.flex}
                />
              ) : (
                <ScaleIn style={styles.flex}>
                  <Button label={editing ? nb.wizard.previewChanges : nb.wizard.preview} size="lg" icon="eye" onPress={preview} />
                </ScaleIn>
              )}
            </FooterRow>
          </StickyFooter>
        }
      >
        <SlideIn key={step} direction={dir} style={styles.px}>
          {step === 1 ? (
            <>
              <Text style={styles.q} accessibilityRole="header">{nb.wizard.s1.q}</Text>
              <Text style={styles.qs}>{nb.wizard.s1.sub}</Text>
              <Shake shakeKey={errOn('cat') ? errN : 0} style={[styles.ctgrid, errOn('cat') && styles.ctgridErr]}>
                {CATS.map((c, i) => {
                  const on = s.cat === c;
                  return (
                    <FadeUp key={c} delay={Math.min(i + 1, 10) * 50} style={styles.ctCell}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={categoryLabels[c]}
                        accessibilityState={{ selected: on }}
                        onPress={() => edit(on ? {} : applyCategory(s, c))}
                        style={({ pressed }) => [styles.ct, on && [styles.ctOn, shadow.selected], pressed && styles.ctPressed]}
                      >
                        <CategoryArt category={c} width={58} height={58} radius={19} iconSize={26} />
                        <Text style={styles.ctL}>{tileLabel(categoryLabels[c])}</Text>
                        {on ? (
                          <ScaleIn style={styles.ctCk}>
                            <Icon name="check" size={14} color={colors.lime} />
                          </ScaleIn>
                        ) : null}
                      </Pressable>
                    </FadeUp>
                  );
                })}
              </Shake>
              {errorLine}
              <Note style={styles.mt18}>{nb.wizard.s1.note}</Note>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.q} accessibilityRole="header">{nb.wizard.s2.q}</Text>
              <Text style={styles.qs}>{nb.wizard.s2.sub}</Text>
              <Field
                label={nb.wizard.s2.label}
                hint={`${s.title.length}/60`}
                style={styles.mt22}
                help={err ? undefined : nb.wizard.s2.help}
              >
                <Shake shakeKey={errOn('title') ? errN : 0}>
                  <Input
                    value={s.title}
                    onChangeText={(v) => edit({ title: v.slice(0, 60) })}
                    maxLength={60}
                    placeholder={nb.wizard.s2.ph}
                    autoComplete="off"
                    accessibilityLabel={nb.wizard.s2.label}
                    error={errOn('title')}
                  />
                </Shake>
                {errOn('title') ? <ErrorText shakeKey={errN}>{err!.message}</ErrorText> : null}
              </Field>
              <View style={styles.mt26}>
                <View style={styles.qlab}>
                  <Icon name="sparkle" size={16} color={colors.limeDeep} />
                  <Text style={text.label}>{nb.wizard.s2.suggest(s.cat ? categoryLabels[s.cat] : nb.wizard.s2.task)}</Text>
                </View>
                <View style={styles.sug}>
                  {form.titles.map((t) => {
                    const on = s.title === t;
                    return (
                      <Pressable
                        key={t}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => edit({ title: t })}
                        style={[styles.sugc, on && styles.sugcOn]}
                      >
                        <Icon name={on ? 'check' : 'plus'} size={14} color={colors.limeDeep} />
                        <Text style={[text.chip, { color: on ? colors.limeDeep : colors.ink }]}>{t}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={[styles.goodCard, shadow.card]}>
                <Text style={text.label}>{nb.wizard.s2.goodTitle}</Text>
                <View style={styles.goodRow}>
                  <View style={[styles.goodIcon, { backgroundColor: colors.okTint }]}>
                    <Icon name="check" size={14} color={colors.ok} />
                  </View>
                  <Text style={[text.body, { fontSize: 14 }]}>{nb.wizard.s2.good}</Text>
                </View>
                <View style={styles.goodRow}>
                  <View style={[styles.goodIcon, { backgroundColor: colors.dangerTint }]}>
                    <Icon name="x" size={14} color={colors.danger} />
                  </View>
                  <Text style={[text.body, { fontSize: 14, color: colors.mute }]}>{nb.wizard.s2.bad}</Text>
                </View>
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.q} accessibilityRole="header">{nb.wizard.s3.q}</Text>
              <Text style={styles.qs}>{nb.wizard.s3.sub}</Text>
              <Field label={nb.wizard.s3.label} hint={`${s.desc.length}/600`} style={styles.mt22}>
                <Shake shakeKey={errOn('desc') ? errN : 0}>
                  <Input
                    multiline
                    value={s.desc}
                    onChangeText={(v) => edit({ desc: v.slice(0, 600) })}
                    maxLength={600}
                    placeholder={s.cat ? form.descPh : nb.wizard.s3.ph}
                    accessibilityLabel={nb.wizard.s3.label}
                    error={errOn('desc')}
                  />
                </Shake>
                {errOn('desc') ? <ErrorText shakeKey={errN}>{err!.message}</ErrorText> : null}
              </Field>
              <Text style={[text.eyebrow, styles.eyebrowGap]}>{nb.wizard.s3.quick}</Text>
              <View style={[styles.qcard, shadow.card]}>
                {form.fields.map((f, i) => (
                  <View key={`${s.cat}-${f.key}`}>
                    {i > 0 ? <View style={[styles.divider, styles.mb16]} /> : null}
                    <IntakeQuestion
                      field={f}
                      value={s.answers[f.key]}
                      onChange={(a) => setAnswer(f.key, a)}
                      error={err?.field === `q:${f.key}`}
                      shakeKey={errN}
                    />
                  </View>
                ))}
                <View style={styles.divider} />
                <View>
                  <QLabel icon="users">{nb.wizard.s3.helpers}</QLabel>
                  <Stepper
                    minusLabel={nb.wizard.s3.fewerHelpers}
                    plusLabel={nb.wizard.s3.moreHelpers}
                    onMinus={() => edit({ helpers: Math.max(1, s.helpers - 1) })}
                    onPlus={() => edit({ helpers: Math.min(MAX_HELPERS, s.helpers + 1) })}
                    value={
                      <Text style={styles.sv}>
                        {s.helpers}
                        <Text style={styles.svSmall}> {s.helpers === 1 ? nb.wizard.s3.person : nb.wizard.s3.persons}</Text>
                      </Text>
                    }
                  />
                </View>
                <View style={styles.divider} />
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel={nb.wizard.s3.urgent}
                  accessibilityState={{ checked: s.urgent }}
                  onPress={() => edit({ urgent: !s.urgent })}
                  style={styles.urgentRow}
                >
                  <View style={styles.flex}>
                    <QLabel icon="zap">{nb.wizard.s3.urgent}</QLabel>
                    <Text style={text.meta}>{nb.wizard.s3.urgentSub}</Text>
                  </View>
                  <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <Toggle value={s.urgent} onValueChange={() => undefined} accessibilityLabel={nb.wizard.s3.urgent} />
                  </View>
                </Pressable>
              </View>
              <View style={[styles.labelRow, styles.mt26]}>
                <Text style={text.label}>{nb.wizard.s3.photos}</Text>
                <Text style={text.hint}>{nb.wizard.s3.photoCount(s.photos.length)}</Text>
              </View>
              <View style={styles.phgrid}>
                {s.photos.map((url, i) => (
                  <ScaleIn key={url} style={styles.phCell}>
                    <Image source={{ uri: url }} style={styles.ph} accessibilityIgnoresInvertColors />
                    {i === 0 ? (
                      <View style={styles.phcover}>
                        <Text style={[text.pill, { fontSize: 10.5 }]}>{nb.wizard.s3.cover}</Text>
                      </View>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={nb.wizard.s3.removePhoto(i + 1)}
                      onPress={() => {
                        edit({ photos: s.photos.filter((p) => p !== url) });
                        toast.success(nb.wizard.photoRemoved, { icon: 'trash', bottom: 130 });
                      }}
                      style={styles.phx}
                    >
                      <Icon name="x" size={14} color={colors.white} />
                    </Pressable>
                  </ScaleIn>
                ))}
                {uploading > 0
                  ? Array.from({ length: uploading }).map((_, i) => (
                      <View key={`up${i}`} style={[styles.phCell, styles.phUploading]}>
                        <Spinner />
                      </View>
                    ))
                  : null}
                {s.photos.length + uploading < MAX_PHOTOS ? (
                  <View style={styles.phCell}>
                    <PhotoAddTile onPress={addPhoto} />
                  </View>
                ) : null}
              </View>
              <Note style={styles.mt12}>{nb.wizard.s3.photoNote}</Note>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Text style={styles.q} accessibilityRole="header">{nb.wizard.s4.q}</Text>
              <Text style={styles.qs}>{nb.wizard.s4.sub}</Text>
              <Button
                label={locating ? nb.oppdrag.locating : nb.oppdrag.useLocation}
                icon={locating ? undefined : 'locate'}
                variant="ink"
                loading={locating}
                onPress={locate}
                style={styles.mt22}
              />
              {located ? (
                <FadeUp style={styles.found}>
                  <ScaleIn style={styles.okCircle}>
                    <Icon name="check" size={14} color={colors.white} />
                  </ScaleIn>
                  <Text style={[text.okChip, { fontSize: 14 }]}>{nb.wizard.s4.found(located)}</Text>
                </FadeUp>
              ) : null}
              <Field label={nb.wizard.s4.kommune} style={styles.mt20}>
                <SelectBox
                  value={s.kommune}
                  placeholder={nb.oppdrag.pickKommune}
                  icon="building"
                  onPress={() => setKSheet(true)}
                  accessibilityLabel={nb.wizard.s4.pickKommuneA11y(s.kommune)}
                />
              </Field>
              <Field label={nb.wizard.s4.area} style={styles.mt16}>
                <Shake shakeKey={errOn('area') ? errN : 0}>
                  <Input
                    value={s.area}
                    onChangeText={(v) => edit({ area: v.slice(0, 40) })}
                    placeholder={nb.wizard.s4.areaPh}
                    autoComplete="off"
                    accessibilityLabel={nb.wizard.s4.area}
                    error={errOn('area')}
                  />
                </Shake>
                {errOn('area') ? <ErrorText shakeKey={errN}>{err!.message}</ErrorText> : null}
                {areaChips.length ? (
                  <View style={styles.qchips}>
                    {areaChips.map((a) => (
                      <Chip key={a} label={a} size="sm" tone="lime" selected={s.area === a} onPress={() => edit({ area: a })} />
                    ))}
                  </View>
                ) : null}
              </Field>
              <View style={styles.mt22}>
                <AreaMap label={`${s.area.trim() || nb.wizard.s4.areaFallback}, ${s.kommune || '…'} · ${nb.wizard.s4.approx}`} />
              </View>
              <View style={[styles.lockCard, shadow.card]}>
                <View style={styles.lockIcon}>
                  <Icon name="lock" size={16} color={colors.lime} />
                </View>
                <Text style={[text.explain, styles.flex]}>
                  <Text style={{ fontFamily: text.label.fontFamily, color: colors.ink }}>{nb.wizard.s4.onlyApprox}</Text>{' '}
                  {nb.wizard.s4.onlyApproxBody}
                </Text>
              </View>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <Text style={styles.q} accessibilityRole="header">{nb.wizard.s5.q}</Text>
              <Text style={styles.qs}>{nb.wizard.s5.help[s.whenMode]}</Text>
              <Segmented
                style={styles.mt20}
                value={s.whenMode}
                onChange={(m) => {
                  if (m === s.whenMode) return;
                  const sel = [...s.days].sort();
                  const keep = sel.length ? (m === 'innen' ? sel[sel.length - 1] : sel[0]) : days[Math.min(9, days.length - 1)].iso;
                  edit({ whenMode: m, days: m === 'flex' ? s.days : [keep] });
                }}
                options={[
                  { value: 'fast', label: nb.wizard.s5.fast },
                  { value: 'flex', label: nb.wizard.s5.flex },
                  { value: 'innen', label: nb.wizard.s5.innen },
                ]}
              />
              <Shake shakeKey={errOn('days') ? errN : 0}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dstrip}
                  style={styles.dstripWrap}
                  accessibilityLabel={nb.wizard.s5.pickDays}
                >
                  {days.map((d) => {
                    const on = s.days.includes(d.iso);
                    return (
                      <Pressable
                        key={d.iso}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${d.wd} ${d.d}. ${d.mo}`}
                        onPress={() =>
                          edit({
                            days: s.whenMode === 'flex' ? (on ? s.days.filter((x) => x !== d.iso) : [...s.days, d.iso]) : [d.iso],
                            keepWhen: undefined,
                          })
                        }
                        style={[
                          styles.dchip,
                          d.nextWeek && styles.dchipWeek,
                          errOn('days') && styles.dchipErr,
                          on && [styles.dchipOn, shadow.btnInk],
                        ]}
                      >
                        {d.weekTag ? (
                          <View style={styles.wtag}>
                            <Text style={styles.wtagText}>{d.weekTag}</Text>
                          </View>
                        ) : null}
                        <Text style={[styles.wd, on && styles.onDim]}>{d.wd}</Text>
                        <Text style={[styles.dn, on && { color: colors.white }]}>{d.d}</Text>
                        <Text style={[styles.mo, on && styles.onDim]}>{d.mo}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Shake>
              {errOn('days') ? <ErrorText shakeKey={errN}>{err!.message}</ErrorText> : null}
              {when ? (
                <ScaleIn style={[styles.sumpill, shadow.card]}>
                  <Icon name="cal" size={16} color={colors.limeDeep} />
                  <Text style={text.label}>{when}</Text>
                </ScaleIn>
              ) : null}
              <View style={[styles.labelRow, styles.mt26]}>
                <Text style={text.label}>{nb.wizard.s5.tod}</Text>
                <Text style={text.hint}>{nb.wizard.s5.todHint}</Text>
              </View>
              <View style={styles.tod}>
                {TIMES_OF_DAY.map((t) => {
                  const on = s.tod.includes(t.label);
                  return (
                    <Pressable
                      key={t.label}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => edit({ tod: on ? s.tod.filter((x) => x !== t.label) : [...s.tod, t.label] })}
                      style={[styles.todb, on && styles.todbOn]}
                    >
                      <View style={[styles.ti2, on && { backgroundColor: colors.lime }]}>
                        <Icon name={t.icon} size={18} color={colors.ink} />
                      </View>
                      <View>
                        <Text style={text.label}>{t.label}</Text>
                        <Text style={text.small}>{t.sub}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <View style={[styles.labelRow, styles.mt26]}>
                <Text style={text.label}>{nb.wizard.s5.howLong}</Text>
                <Text style={text.hint}>{nb.wizard.s5.estimate}</Text>
              </View>
              <Stepper
                card
                minusLabel={nb.wizard.s5.shorter}
                plusLabel={nb.wizard.s5.longer}
                onMinus={() => edit({ hours: Math.max(1, s.hours - 1) })}
                onPlus={() => edit({ hours: Math.min(12, s.hours + 1) })}
                value={<Text style={styles.sv}>{hoursLabel(s.hours)}</Text>}
              />
              <Note style={styles.mt12}>{nb.wizard.s5.note}</Note>
              <View style={[styles.labelRow, styles.mt26]}>
                <Text style={text.label}>{nb.wizard.s5.repeat}</Text>
                <Text style={text.hint}>{nb.wizard.s5.repeatHint}</Text>
              </View>
              <View style={styles.repeatRow} accessibilityRole="radiogroup" accessibilityLabel={nb.wizard.s5.repeat}>
                {(['ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const).map((r) => (
                  <Chip
                    key={r}
                    label={nb.wizard.s5.repeatOptions[r]}
                    size="sm"
                    selected={(s.repeat ?? 'ONCE') === r}
                    onPress={() => edit({ repeat: r === 'ONCE' ? undefined : r })}
                  />
                ))}
              </View>
              {s.repeat ? (
                <FadeUp>
                  <Note icon="repeat" style={styles.mt12}>
                    {nb.wizard.s5.repeatNote}
                  </Note>
                </FadeUp>
              ) : null}
            </>
          ) : null}

          {step === 6 ? (
            <>
              <Text style={styles.q} accessibilityRole="header">{nb.wizard.s6.q}</Text>
              <Text style={styles.qs}>{nb.wizard.s6.sub}</Text>
              <Segmented
                style={styles.mt20}
                value={s.priceMode}
                onChange={(m) => edit({ priceMode: m })}
                options={[
                  { value: 'budget', label: nb.wizard.s6.budget },
                  { value: 'offer', label: nb.wizard.s6.offers },
                ]}
              />
              {s.priceMode === 'budget' ? (
                <FadeUp style={styles.mt20}>
                  <Field label={nb.wizard.s6.budgetLabel} hint={nb.wizard.s6.budgetHint}>
                    <Shake shakeKey={errOn('amount') ? errN : 0}>
                      <AmountInput
                        value={s.amount}
                        onChangeText={(v) => edit({ amount: v })}
                        placeholder="0"
                        error={errOn('amount')}
                        accessibilityLabel={nb.wizard.s6.budgetLabel}
                      />
                    </Shake>
                    {errOn('amount') ? <ErrorText shakeKey={errN}>{err!.message}</ErrorText> : null}
                    <View style={styles.qchips}>
                      {QUICK_AMOUNTS.map((v) => (
                        <Chip key={v} label={fmtKr(v)} size="sm" tone="lime" selected={amt === v} onPress={() => edit({ amount: String(v) })} />
                      ))}
                    </View>
                  </Field>
                </FadeUp>
              ) : (
                <FadeUp style={styles.offerBlock}>
                  <View style={styles.offerInfo}>
                    <View style={styles.offerIcon}>
                      <Icon name="tag" size={18} color={colors.lime} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[text.rowTitle, { fontFamily: text.label.fontFamily }]}>{nb.wizard.s6.showsWant}</Text>
                      <Text style={[text.meta, { color: colors.ink2 }]}>{nb.wizard.s6.showsWantBody}</Text>
                    </View>
                  </View>
                  <Field label={nb.wizard.s6.guess} hint={nb.wizard.s6.guessHint} help={nb.wizard.s6.guessHelp}>
                    <AmountInput value={s.amount} onChangeText={(v) => edit({ amount: v })} placeholder="0" accessibilityLabel={nb.wizard.s6.guess} />
                  </Field>
                </FadeUp>
              )}
              <View style={styles.priceNotes}>
                {s.cat ? (
                  <Note icon="chart">
                    {/* real numbers from earlier tilbud when there are enough; otherwise the fixed range */}
                    {guidance
                      ? nb.wizard.s6.usualArea(categoryLabels[s.cat].toLowerCase(), formatAmount(String(guidance.low)), formatAmount(String(guidance.high)))
                      : nb.wizard.s6.usual(categoryLabels[s.cat].toLowerCase(), formatAmount(String(form.price[0])), formatAmount(String(form.price[1])))}
                  </Note>
                ) : null}
                <Note icon="tag">
                  <Text style={{ fontFamily: text.label.fontFamily, color: colors.ink2 }}>{nb.wizard.s6.guiding}</Text>
                </Note>
                <Note>{nb.wizard.s6.payment}</Note>
              </View>
            </>
          ) : null}

          {step === 7 ? (
            <>
              <Text style={styles.q} accessibilityRole="header">{nb.wizard.s7.q}</Text>
              <Text style={styles.qs}>{nb.wizard.s7.sub}</Text>
              <ListGroup style={styles.mt20}>
                {EQUIPMENT.filter((e) => form.equipment.includes(e.id)).map((e) => (
                  <ListRow
                    key={e.id}
                    icon={e.icon}
                    iconColor={colors.limeDeep}
                    title={e.label}
                    subtitle={e.sub}
                    chevron={false}
                    accessibilityLabel={e.label}
                    onPress={() => edit({ eq: { ...s.eq, [e.id]: !s.eq[e.id] } })}
                    right={
                      <Toggle
                        value={s.eq[e.id]}
                        onValueChange={(v) => edit({ eq: { ...s.eq, [e.id]: v } })}
                        accessibilityLabel={e.label}
                      />
                    }
                  />
                ))}
              </ListGroup>
              <Field
                label={nb.wizard.s7.other}
                hint={`${s.practical.length}/300`}
                help={nb.wizard.s7.otherHelp}
                style={styles.mt22}
              >
                <Input
                  multiline
                  value={s.practical}
                  onChangeText={(v) => edit({ practical: v.slice(0, 300) })}
                  maxLength={300}
                  placeholder={nb.wizard.s7.otherPh}
                  accessibilityLabel={nb.wizard.s7.other}
                />
              </Field>
            </>
          ) : null}

          {step === 8 ? (
            <>
              <Text style={styles.q} accessibilityRole="header">{nb.wizard.s8.q}</Text>
              <Text style={styles.qs}>{nb.wizard.s8.sub}</Text>
              <View style={styles.whoList}>
                {(
                  [
                    { id: 'alle', icon: 'users' },
                    { id: 'verif', icon: 'verified' },
                  ] as { id: WizardState['who']; icon: IconKey }[]
                ).map((w) => (
                  <OptionCard
                    key={w.id}
                    selected={s.who === w.id}
                    onPress={() => edit({ who: w.id })}
                    accessibilityLabel={nb.wizard.s8.who[w.id].label}
                  >
                    <View style={styles.whoIcon}>
                      <Icon name={w.icon} size={18} color={colors.limeDeep} />
                    </View>
                    <View style={[styles.flex, { gap: 3 }]}>
                      <Text style={[text.rowTitle, { fontFamily: text.label.fontFamily }]}>{nb.wizard.s8.who[w.id].label}</Text>
                      <Text style={text.meta}>{nb.wizard.s8.who[w.id].sub}</Text>
                    </View>
                    <Radio selected={s.who === w.id} />
                  </OptionCard>
                ))}
              </View>
              <View style={[styles.kmCard, shadow.card]}>
                <View style={styles.labelRow}>
                  <Text style={text.label}>{nb.wizard.s8.maxKm}</Text>
                  <Text style={[text.num, { fontSize: 18 }]}>{s.km} km</Text>
                </View>
                <View style={styles.kmRow}>
                  <View style={styles.rings} accessibilityElementsHidden>
                    <View
                      style={[
                        styles.rg,
                        { width: 26 + s.km * 3.2, height: 26 + s.km * 3.2, marginLeft: -(26 + s.km * 3.2) / 2, marginTop: -(26 + s.km * 3.2) / 2 },
                      ]}
                    />
                    <View style={styles.meDot} />
                  </View>
                  <View style={[styles.flex, { gap: 6 }]}>
                    <Text style={[text.h4, { fontFamily: text.h3.fontFamily, fontSize: 16 }]}>
                      {s.km <= 3 ? nb.wizard.s8.near : s.km <= 12 ? nb.wizard.s8.mid(s.kommune || nb.oppdrag.yourKommune) : nb.wizard.s8.far}
                    </Text>
                    <Text style={text.meta}>{nb.wizard.s8.hidden}</Text>
                  </View>
                </View>
                <View style={styles.mt20}>
                  <RangeSlider
                    value={s.km}
                    min={1}
                    max={30}
                    onChange={(v) => edit({ km: v })}
                    accessibilityLabel={nb.wizard.s8.kmA11y}
                    formatValue={(v) => `${v} km`}
                  />
                </View>
                <View style={styles.ticks}>
                  <Text style={text.meta}>1 km</Text>
                  <Text style={text.meta}>15 km</Text>
                  <Text style={text.meta}>30 km</Text>
                </View>
              </View>
            </>
          ) : null}

          {step === 9 ? (
            <>
              <Text style={styles.q} accessibilityRole="header">{nb.wizard.s9.q}</Text>
              <Text style={styles.qs}>{nb.wizard.s9.sub}</Text>
              <ListingCard
                style={styles.mt20}
                title={s.title.trim() || nb.wizard.s9.untitled}
                category={s.cat ?? 'annet'}
                photoUri={s.photos[0]}
                place={placeLine(s)}
                priceLabel={s.priceMode === 'budget' ? nb.card.budget : ''}
                priceValue={s.priceMode === 'budget' ? fmtKr(amt) : nb.card.wantsOffers}
              />
              <View style={styles.sgroups}>
                <SumGroup icon="clip" title={nb.wizard.s9.groups.oppdrag} rows={sum.oppdrag} onEdit={(n) => go(n, 'back', true)} />
                <SumGroup icon="pin" title={nb.wizard.s9.groups.sted} rows={sum.stedTid} onEdit={(n) => go(n, 'back', true)} />
                <SumGroup icon="tag" title={nb.wizard.s9.groups.pris} rows={sum.prisPraktisk} onEdit={(n) => go(n, 'back', true)} />
                <SumGroup icon="users" title={nb.wizard.s9.groups.synlighet} rows={sum.synlighet} onEdit={(n) => go(n, 'back', true)} />
              </View>
              <Note style={styles.mt16}>{nb.wizard.s9.note}</Note>
            </>
          ) : null}
        </SlideIn>
      </Screen>

      {header}

      <Sheet visible={kSheet} onClose={() => setKSheet(false)} title={nb.wizard.s4.pickKommune} titleSize="h2" scroll>
        <View style={styles.klist}>
          {kommuneList.map((k) => (
            <OptionCard
              key={k}
              selected={s.kommune === k}
              accessibilityLabel={k}
              onPress={() => {
                edit({ kommune: k, area: k === s.kommune ? s.area : '' });
                setLocated(null);
                setKSheet(false);
              }}
              style={styles.kopt}
            >
              <Radio selected={s.kommune === k} />
              <Text style={[text.optionName, styles.flex, { fontSize: 15 }]}>{k}</Text>
              <Text style={text.meta}>{nb.setup.region}</Text>
            </OptionCard>
          ))}
        </View>
        <Note style={styles.mt16}>{nb.wizard.s4.onlyInnlandet}</Note>
      </Sheet>

      <Dialog
        visible={closeOpen}
        onClose={() => setCloseOpen(false)}
        icon={editing ? 'edit' : 'bookmark'}
        tone={editing ? 'neutral' : 'ok'}
        title={editing ? nb.wizard.editCloseTitle : nb.wizard.closeTitle}
        body={editing ? nb.wizard.editCloseBody : nb.wizard.closeBody}
        actions={
          editing ? (
            <>
              <Button label={nb.wizard.keepEditing} variant="ink" onPress={() => setCloseOpen(false)} />
              <Button
                label={nb.wizard.discardChanges}
                variant="dangerGhost"
                onPress={() => {
                  setCloseOpen(false);
                  if (router.canGoBack()) router.back();
                  else router.replace('/mine');
                }}
              />
            </>
          ) : (
          <>
            <Button
              label={nb.wizard.saveAndClose}
              variant="ink"
              onPress={async () => {
                await wizardDraft.save(s, step);
                setCloseOpen(false);
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
            />
            <Button label={nb.wizard.keepEditing} variant="ghost" onPress={() => setCloseOpen(false)} />
            <Pressable
              accessibilityRole="button"
              style={styles.discard}
              onPress={async () => {
                await wizardDraft.clear();
                setCloseOpen(false);
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
            >
              <Text style={[text.bodySemi, { color: colors.danger, textDecorationLine: 'underline' }]}>{nb.wizard.discard}</Text>
            </Pressable>
          </>
          )
        }
      />
    </View>
  );
}

/** One category question: chips (single/multi), a stepper, Ja/Nei or a short text. */
function IntakeQuestion({
  field: f,
  value,
  onChange,
  error,
  shakeKey,
}: {
  field: IntakeField;
  value: Answer | undefined;
  onChange: (a: Answer) => void;
  error: boolean;
  shakeKey: number;
}) {
  const icon = f.icon ?? 'info';
  if (f.kind === 'choice') {
    const sel = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [];
    return (
      <Shake shakeKey={error ? shakeKey : 0}>
        <QLabel icon={icon}>{f.multi ? `${f.label} ${nb.wizard.s3.pickMany}` : f.label}</QLabel>
        <View style={styles.optrow} accessibilityRole={f.multi ? undefined : 'radiogroup'}>
          {f.options.map((o) => {
            const on = sel.includes(o);
            return (
              <Pressable
                key={o}
                accessibilityRole={f.multi ? 'checkbox' : 'radio'}
                accessibilityState={f.multi ? { checked: on } : { selected: on }}
                onPress={() => onChange(f.multi ? (on ? sel.filter((x) => x !== o) : [...sel, o]) : on ? '' : o)}
                style={[styles.ochip, on && styles.ochipOn, error && !on && styles.ochipErr]}
              >
                {f.multi && on ? <Icon name="check" size={13} color={colors.okText} /> : null}
                <Text style={[text.segment, { color: on ? colors.okText : colors.ink2 }]}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
        {error ? <ErrorText shakeKey={shakeKey}>{nb.wizard.s3.answerThis}</ErrorText> : null}
      </Shake>
    );
  }
  if (f.kind === 'number') {
    const n = typeof value === 'number' ? value : f.def;
    return (
      <View>
        <QLabel icon={icon}>{f.label}</QLabel>
        <Stepper
          minusLabel={`${nb.wizard.s3.less}: ${f.label}`}
          plusLabel={`${nb.wizard.s3.more}: ${f.label}`}
          onMinus={() => onChange(Math.max(f.min, n - f.step))}
          onPlus={() => onChange(Math.min(f.max, n + f.step))}
          value={
            <Text style={styles.sv}>
              {isApprox(f) ? 'ca. ' : ''}
              {n}
              <Text style={styles.svSmall}> {f.unit}</Text>
            </Text>
          }
        />
      </View>
    );
  }
  if (f.kind === 'yesno') {
    return (
      <View>
        <QLabel icon={icon}>{f.label}</QLabel>
        <Segmented
          value={value === 'Nei' ? 'Nei' : 'Ja'}
          onChange={(v) => onChange(v)}
          accessibilityLabel={f.label}
          options={[
            { value: 'Ja', label: 'Ja' },
            { value: 'Nei', label: 'Nei' },
          ]}
        />
      </View>
    );
  }
  return (
    <View>
      <QLabel icon={icon}>{`${f.label} ${nb.wizard.s3.optional}`}</QLabel>
      <Input
        value={typeof value === 'string' ? value : ''}
        onChangeText={(v) => onChange(v.slice(0, f.max ?? 80))}
        placeholder={f.placeholder}
        maxLength={f.max ?? 80}
        accessibilityLabel={f.label}
      />
    </View>
  );
}

function QLabel({ icon, children }: { icon: IconKey; children: string }) {
  return (
    <View style={styles.qlab}>
      <View style={styles.qIcon}>
        <Icon name={icon} size={14} color={colors.limeDeep} />
      </View>
      <Text style={text.label}>{children}</Text>
    </View>
  );
}

function SumGroup({
  icon,
  title,
  rows,
  onEdit,
}: {
  icon: IconKey;
  title: string;
  rows: { k: string; v: string; step: number }[];
  onEdit: (step: number) => void;
}) {
  return (
    <View style={[styles.sgroup, shadow.card]}>
      <View style={styles.gh}>
        <Icon name={icon} size={14} color={colors.mute} />
        <Text style={text.eyebrow}>{title}</Text>
      </View>
      {rows.map((r) => (
        <View key={r.k} style={styles.srow}>
          <View style={styles.sv2}>
            <Text style={[text.small, { fontSize: 12.5 }]}>{r.k}</Text>
            <Text style={[text.bodySemi, { fontSize: 14.5, lineHeight: 19.6 }]}>{r.v}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Endre ${r.k}`} onPress={() => onEdit(r.step)} style={styles.editBtn}>
            <Text style={[text.link, { fontSize: 13.5 }]}>Endre</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/** 7 px lime progress bar that animates its width. */
function ProgressBar({ value }: { value: number }) {
  const w = useSharedValue(value);
  useEffect(() => {
    w.set(withTiming(value, { duration: 500, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, [value, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.prog} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 1, now: value }}>
      <Animated.View style={[styles.progFill, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  repeatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  px: { paddingHorizontal: screenPadding },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  mt20: { marginTop: 20 },
  mt22: { marginTop: 22 },
  mt26: { marginTop: 26 },
  wzh: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, borderBottomWidth: 1, borderBottomColor: colors.navHairline, overflow: 'hidden' },
  wzhBg: { backgroundColor: colors.wizardHeaderBg },
  subbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 2 },
  wzmeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: screenPadding, paddingBottom: 8 },
  st: { gap: 4, minWidth: 0 },
  stepName: { fontSize: 15.5, lineHeight: 17 },
  draftbtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progWrap: { marginHorizontal: screenPadding, marginBottom: 14 },
  prog: { height: 7, borderRadius: 4, backgroundColor: colors.progressTrack, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4, backgroundColor: colors.lime },
  backBtn: { width: 58, paddingHorizontal: 0 },
  q: { fontFamily: text.h1.fontFamily, fontSize: 27, lineHeight: 29, letterSpacing: -0.81, color: colors.ink },
  qs: { ...text.body, lineHeight: 21.75, color: colors.ink2, marginTop: 8 },
  ctgrid: { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10, borderRadius: 24 },
  ctgridErr: { ...shadow.errorOutline, padding: 6, margin: -6, marginTop: 14 },
  ctCell: { width: '30%', flexGrow: 1 },
  ct: {
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    gap: 9,
    paddingTop: 14,
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  ctOn: { borderColor: colors.ink, backgroundColor: colors.consentOnBg },
  ctPressed: { transform: [{ scale: 0.95 }] },
  ctL: { ...text.label, fontSize: 12.5, lineHeight: 15, textAlign: 'center', minHeight: 30, textAlignVertical: 'center' },
  ctCk: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qlab: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  qIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  sug: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sugc: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.suggestBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sugcOn: { backgroundColor: colors.limeTint, borderStyle: 'solid', borderColor: colors.chipLimeBorder },
  goodCard: { marginTop: 24, padding: 18, gap: 12, borderRadius: radius.card, backgroundColor: colors.white },
  goodRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goodIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  eyebrowGap: { marginTop: 26, marginBottom: 12 },
  qcard: { backgroundColor: colors.white, borderRadius: radius.card, padding: 16, gap: 16 },
  optrow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ochip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.line,
    justifyContent: 'center',
  },
  ochipOn: { backgroundColor: colors.limeTint, borderColor: colors.lime2 },
  ochipErr: { borderColor: colors.dateErrBorder },
  mb16: { marginBottom: 16 },
  urgentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  phUploading: { borderRadius: radius.thumb, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: colors.line },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface2, borderRadius: 18, padding: 6 },
  stepperCard: { backgroundColor: colors.white },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.stepBtn,
  },
  sv: { fontFamily: text.h3.fontFamily, fontSize: 20, lineHeight: 22, letterSpacing: -0.4, textAlign: 'center', color: colors.ink },
  svSmall: { fontFamily: text.bodySemi.fontFamily, fontSize: 13, color: colors.mute },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  phgrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  phCell: { width: '31%', aspectRatio: 1 },
  ph: { width: '100%', height: '100%', borderRadius: 18 },
  phcover: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  phx: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.photoClose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  found: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.okTint,
  },
  okCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' },
  qchips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  mapc: { height: 156, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.mapGreen, borderWidth: 1, borderColor: colors.navHairline },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.mapGrid },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.mapGrid },
  lake: { position: 'absolute', right: -40, top: -30, width: 150, height: 110, borderRadius: 75, backgroundColor: colors.mapLake },
  road: { position: 'absolute', backgroundColor: colors.white, borderRadius: 6 },
  zone: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 124,
    height: 124,
    marginLeft: -62,
    marginTop: -62,
    borderRadius: 62,
    backgroundColor: colors.reachRingOn,
    borderWidth: 2,
    borderColor: colors.mapZoneBorder,
  },
  mapLbl: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.locButtonBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockCard: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  lockIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  dstripWrap: { marginHorizontal: -screenPadding },
  dstrip: { gap: 8, paddingTop: 14, paddingHorizontal: screenPadding, paddingBottom: 8 },
  dchip: {
    width: 60,
    height: 80,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dchipWeek: { backgroundColor: colors.consentOnBg },
  dchipErr: { borderColor: colors.dateErrBorder },
  dchipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  wd: { fontFamily: text.label.fontFamily, fontSize: 11.5, lineHeight: 11.5, color: colors.mute, textTransform: 'uppercase', letterSpacing: 0.46 },
  dn: { fontFamily: text.h3.fontFamily, fontSize: 23, lineHeight: 23, letterSpacing: -0.46, color: colors.ink },
  mo: { fontFamily: text.bodySemi.fontFamily, fontSize: 11, lineHeight: 11, color: colors.faint },
  onDim: { color: colors.onInk72 },
  wtag: {
    position: 'absolute',
    top: -10,
    left: '50%',
    marginLeft: -24,
    width: 48,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wtagText: { fontFamily: text.count.fontFamily, fontSize: 9.5, lineHeight: 18, color: colors.ink, letterSpacing: 0.38 },
  sumpill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  tod: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  todb: {
    width: '48.5%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  todbOn: { borderColor: colors.lime2, backgroundColor: colors.todOnBg },
  ti2: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  offerBlock: { marginTop: 20, gap: 16 },
  offerInfo: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: colors.limeTint,
    borderWidth: 1,
    borderColor: colors.offerInfoBorder,
  },
  offerIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  priceNotes: {
    marginTop: 22,
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  whoList: { gap: 10, marginTop: 20 },
  whoIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  kmCard: { marginTop: 22, padding: 18, borderRadius: radius.card, backgroundColor: colors.white },
  kmRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 4 },
  rings: { width: 124, height: 124, borderRadius: 62, backgroundColor: colors.bg },
  rg: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderRadius: 999,
    backgroundColor: colors.wizardRing,
    borderWidth: 1.5,
    borderColor: colors.limeDot,
  },
  meDot: {
    position: 'absolute',
    left: 55,
    top: 55,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.ink,
    ...shadow.whiteRing4,
  },
  ticks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  sgroups: { gap: 12, marginTop: 16 },
  sgroup: { backgroundColor: colors.white, borderRadius: radius.card, paddingVertical: 4, paddingHorizontal: 16 },
  gh: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, paddingBottom: 6 },
  srow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line2 },
  sv2: { flex: 1, minWidth: 0, gap: 3 },
  editBtn: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
  klist: { gap: 8 },
  kopt: { paddingVertical: 13, paddingHorizontal: 14 },
  discard: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
