import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import nb from '@/i18n/nb';
import { apiClient } from '@/api/client';
import { listingKeys, profileKeys, useListing } from '@/api/queries';
import { useActiveCategories } from '@/hooks/useCategories';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSession } from '@/auth/session';
import { LAUNCH_KOMMUNER, WHOLE_KOMMUNE } from '@/data/kommuner';
import { AreaSearch } from '@/components/AreaSearch';
import { categoryArtId, categoryBySlug, categoryLabel, slugForArtId } from '@/domain/categories';
import { WEEKDAYS, experienceText } from '@/domain/offer';
import { nok } from '@/domain/price';
import type { Listing, PriceMode, PublicProfile } from '@/domain/types';
import { serverMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { scrollIntoView, ERROR_SCROLL_MARGIN } from '@/lib/scrollIntoView';
import { tileLabel } from '@/lib/tileLabel';
import { toast } from '@/lib/toast';
import { pickAndUploadMany } from '@/lib/uploads';
import { colors, radius, screenPadding, shadow, text, type CategoryId } from '@/theme/theme';
import { listingPrice, listingSchedule } from '@/components/OppdragCard';
import { Image } from '@/components/ui/Image';
import {
  AmountInput,
  Button,
  CategoryArt,
  Chip,
  ErrorText,
  FadeUp,
  Field,
  FooterRow,
  Icon,
  Input,
  ListingCard,
  OptionCard,
  PaymentNote,
  PhotoAddTile,
  Radio,
  ScaleIn,
  Screen,
  SelectBox,
  Sheet,
  SlideIn,
  Spinner,
  StepProgress,
  StickyFooter,
  SubHeader,
} from '@/components/ui';

const LAST = 5;
const MAX_PHOTOS = 6;
const TITLE_MAX = 60;
const ABOUT_MAX = 600;
const MAX_KM = 30;
const MAX_YEARS = 40;

type Price = 'FROM' | 'FIXED' | 'BY_AGREEMENT';
type Form = {
  cat: CategoryId | null;
  services: string[];
  title: string;
  about: string;
  years: number;
  /** 0–11, on top of the years */
  months: number;
  equipment: string;
  photos: string[];
  price: Price;
  amount: string;
  days: number[];
  when: string;
  kommune: string;
  area: string;
  km: number;
};
type Err = { field: 'cat' | 'title' | 'about' | 'amount' | 'days' | 'area'; message: string } | null;

const empty = (kommune: string): Form => ({
  cat: null, services: [], title: '', about: '', years: 0, months: 0, equipment: '', photos: [],
  price: 'FROM', amount: '', days: [], when: '', kommune, area: '', km: 10,
});

/** Step → the first problem, or null. Exported for the tests. */
export function offerError(step: number, f: Form): Err {
  if (step === 1 && !f.cat) return { field: 'cat', message: nb.offer.err.cat };
  if (step === 2 && f.title.trim().length < 5) return { field: 'title', message: nb.offer.err.title };
  if (step === 2 && f.about.trim().length < 20) return { field: 'about', message: nb.offer.err.about };
  if (step === 3 && f.price !== 'BY_AGREEMENT' && !(Number(f.amount) > 0)) return { field: 'amount', message: nb.offer.err.amount };
  if (step === 4 && !f.days.length) return { field: 'days', message: nb.offer.err.days };
  if (step === 4 && !f.area.trim()) return { field: 'area', message: nb.offer.err.area };
  return null;
}

/** The form → a Listing for createListing / updateOffer and the preview card. */
export function offerListing(f: Form, owner: PublicProfile): Listing {
  const cat = f.cat ?? 'annet';
  const amt = Number(f.amount) || 0;
  const priceMode: PriceMode = f.price === 'BY_AGREEMENT' ? 'BY_AGREEMENT' : f.price;
  return {
    id: `l-offer-${Date.now()}`,
    type: 'SERVICE_OFFER',
    title: f.title.trim(),
    category: categoryBySlug(slugForArtId(cat)),
    priceMode,
    price: priceMode !== 'BY_AGREEMENT' && amt > 0 ? nok(amt) : undefined,
    location: { municipality: f.kommune, place: f.area.trim() || f.kommune },
    images: f.photos.map((url, i) => ({ id: `op-${i}`, url })),
    owner,
    createdAt: new Date().toISOString(),
    status: 'PUBLISHED',
    offer: {
      about: f.about.trim(),
      services: f.services,
      experienceMonths: f.years * 12 + f.months || undefined,
      equipmentText: f.equipment.trim() || undefined,
      availabilityText: f.when.trim() || undefined,
      availableWeekdays: [...f.days].sort(),
      maxDistanceKm: f.km,
    },
  };
}

function fromListing(l: Listing): Form {
  const o = l.offer;
  return {
    cat: categoryArtId(l.category.slug),
    services: o?.services ?? [],
    title: l.title,
    about: o?.about ?? '',
    years: Math.floor((o?.experienceMonths ?? 0) / 12),
    months: (o?.experienceMonths ?? 0) % 12,
    equipment: o?.equipmentText ?? '',
    photos: l.images.map((im) => im.url),
    price: l.priceMode === 'BY_AGREEMENT' || !l.price ? 'BY_AGREEMENT' : l.priceMode === 'FIXED' ? 'FIXED' : 'FROM',
    amount: l.price ? String(Math.round(l.price.amountMinor / 100)) : '',
    days: o?.availableWeekdays ?? [],
    when: o?.availabilityText ?? '',
    kommune: l.location.municipality,
    // place = kommune means «Hele kommunen» (AreaSearch shows it as such)
    area: l.location.place,
    km: o?.maxDistanceKm ?? 10,
  };
}

/** «Tilby hjelp» – a nabo posts what they can do (0076). /legg-ut/tilbyr[?rediger=<id>] */
export function OfferWizard() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useCurrentUser();
  const { userId } = useSession();
  const params = useLocalSearchParams<{ rediger?: string }>();
  const editId = typeof params.rediger === 'string' && params.rediger ? params.rediger : undefined;
  const editing = useListing(editId ?? '');
  const cats = useActiveCategories();
  const [f, setF] = useState<Form>(() => empty(me.municipality ?? ''));
  const [seeded, setSeeded] = useState(false);
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<'forward' | 'back'>('forward');
  const [err, setErr] = useState<Err>(null);
  const [kSheet, setKSheet] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const [targets] = useState(() => new Map<string, View | null>());
  const target = (k: string) => (el: View | null) => {
    targets.set(k, el);
  };

  if (editId && !seeded && editing.data) {
    setSeeded(true);
    setF(fromListing(editing.data));
  }
  // the kommune on the profile fills an empty Kommune, also when it arrives after the first render
  if (!f.kommune && me.municipality && (!editId || seeded)) setF((p) => (p.kommune ? p : { ...p, kommune: me.municipality ?? '' }));

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  useEffect(() => {
    if (!err) return;
    const t = setTimeout(() => scrollIntoView(targets.get(err.field), contentRef.current, scrollRef.current, ERROR_SCROLL_MARGIN * 2), 80);
    return () => clearTimeout(t);
  }, [err, targets]);

  const set = (patch: Partial<Form>) => {
    setF((p) => ({ ...p, ...patch }));
    setErr(null);
  };
  const owner: PublicProfile = useMemo(
    () => ({
      id: me.id || 'me',
      displayName: me.displayName || 'Deg',
      initials: me.initials,
      avatarUrl: me.avatarUrl,
      memberSince: '',
      location: { municipality: f.kommune, place: f.area || f.kommune },
      isBusiness: false,
      verifications: [],
    }),
    [me.id, me.displayName, me.initials, me.avatarUrl, f.kommune, f.area],
  );
  const preview = offerListing(f, owner);

  const go = (n: number, d: 'forward' | 'back') => {
    setErr(null);
    setDir(d);
    setStep(n);
  };
  const next = () => {
    const e = offerError(step, f);
    if (e) {
      haptics.warning();
      setErr(e);
      return;
    }
    if (step < LAST) go(step + 1, 'forward');
  };
  const back = () => (step > 1 ? go(step - 1, 'back') : router.canGoBack() ? router.back() : router.replace('/'));

  const publish = async () => {
    for (const n of [1, 2, 3, 4]) {
      const e = offerError(n, f);
      if (e) {
        go(n, 'back');
        setErr(e);
        return;
      }
    }
    setBusy(true);
    try {
      const saved = editId ? await apiClient.updateOffer(editId, preview) : await apiClient.createListing(preview);
      haptics.success();
      void qc.invalidateQueries({ queryKey: listingKeys.all });
      void qc.invalidateQueries({ queryKey: profileKeys.myListings('SERVICE_OFFER') });
      void qc.invalidateQueries({ queryKey: ['listing'] });
      toast.success(editId ? nb.offer.saved : nb.offer.published, { icon: 'check' });
      router.replace(`/oppdrag/${saved.id}`);
    } catch (e) {
      toast.error(serverMessage(e, nb.toast.genericError), { bottom: 150 });
    } finally {
      setBusy(false);
    }
  };

  const addPhotos = async () => {
    const room = MAX_PHOTOS - f.photos.length;
    if (room <= 0 || !userId) return;
    try {
      const urls = (await pickAndUploadMany({ bucket: 'listing-images', folder: userId, max: room, onStart: setUploading })).map((r) => r.publicUrl);
      setUploading(0);
      if (urls.length) setF((p) => ({ ...p, photos: [...p.photos, ...urls].slice(0, MAX_PHOTOS) }));
    } catch (e) {
      setUploading(0);
      toast.error(serverMessage(e, nb.wizard.photoFailed), { bottom: 150 });
    }
  };

  const toggleDay = (i: number) => set({ days: f.days.includes(i) ? f.days.filter((d) => d !== i) : [...f.days, i] });
  const errOn = (k: NonNullable<Err>['field']) => err?.field === k;
  const errText = (k: NonNullable<Err>['field']) => (errOn(k) ? <ErrorText>{err!.message}</ErrorText> : null);
  const kommuner = [...new Set([...(f.kommune ? [f.kommune] : []), ...LAUNCH_KOMMUNER])];
  const price = listingPrice(preview);

  return (
    <View style={styles.flex}>
      <Screen
        scroll
        spacer="foot"
        scrollRef={scrollRef}
        scrollProps={{ keyboardDismissMode: 'on-drag' }}
        header={
          <View>
            <SubHeader title={editId ? nb.offer.editTitle : nb.offer.title} onBack={back} />
            <View style={styles.prog}>
              <Text style={text.eyebrow}>{nb.offer.stepOf(step, LAST)}</Text>
              <Text style={[text.label, styles.stepName]}>{nb.offer.steps[step - 1]}</Text>
            </View>
            <View style={styles.px}>
              <StepProgress step={step} total={LAST} showLabel={false} />
            </View>
          </View>
        }
        footer={
          <StickyFooter>
            <FooterRow>
              {step > 1 ? (
                <Button label="" icon="back" variant="ghost" size="lg" block={false} accessibilityLabel={nb.offer.back} onPress={back} style={styles.backBtn} />
              ) : null}
              {step < LAST ? (
                <Button label={nb.offer.next} size="lg" iconRight="arrow" onPress={next} style={styles.flex} />
              ) : (
                <ScaleIn style={styles.flex}>
                  <Button
                    label={editId ? nb.offer.save : nb.offer.publish}
                    icon="check"
                    size="lg"
                    loading={busy}
                    loadingLabel={editId ? nb.offer.saving : nb.offer.publishing}
                    onPress={publish}
                  />
                </ScaleIn>
              )}
            </FooterRow>
          </StickyFooter>
        }
      >
        <SlideIn key={step} direction={dir} style={styles.px}>
          <View ref={contentRef} collapsable={false}>
            {step === 1 ? (
              <>
                <Text style={styles.q} accessibilityRole="header">{nb.offer.s1q}</Text>
                <Text style={styles.qs}>{nb.offer.s1sub}</Text>
                <View ref={target('cat')} collapsable={false} />
                <View style={[styles.grid, errOn('cat') && styles.gridErr]}>
                  {cats.map((c, i) => {
                    const on = f.cat === c;
                    const t = tileLabel(categoryLabel(c));
                    return (
                      <FadeUp key={c} delay={Math.min(i + 1, 10) * 40} style={styles.cell}>
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityLabel={categoryLabel(c)}
                          accessibilityState={{ checked: on }}
                          onPress={() => {
                            haptics.select();
                            set({ cat: c });
                          }}
                          style={({ pressed }) => [styles.tile, on && [styles.tileOn, shadow.selected], pressed && styles.pressed]}
                        >
                          <CategoryArt category={c} width={54} height={54} radius={18} iconSize={24} />
                          <Text style={[styles.tileL, t.small && styles.tileLSmall]}>{t.text}</Text>
                          {on ? (
                            <ScaleIn style={styles.tick}>
                              <Icon name="check" size={13} color={colors.white} />
                            </ScaleIn>
                          ) : null}
                        </Pressable>
                      </FadeUp>
                    );
                  })}
                </View>
                {errText('cat')}
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Text style={styles.q} accessibilityRole="header">{nb.offer.s2q}</Text>
                <Text style={styles.qs}>{nb.offer.s2sub}</Text>
                <View ref={target('title')} collapsable={false} />
                <Field label={nb.offer.titleLabel} hint={`${f.title.length}/${TITLE_MAX}`} style={styles.mt22}>
                  <Input
                    value={f.title}
                    onChangeText={(v) => set({ title: v.slice(0, TITLE_MAX) })}
                    maxLength={TITLE_MAX}
                    placeholder={nb.offer.titlePh}
                    accessibilityLabel={nb.offer.titleLabel}
                    error={errOn('title')}
                  />
                  {errText('title')}
                </Field>
                <View ref={target('about')} collapsable={false} />
                <Field label={nb.offer.aboutLabel} hint={`${f.about.length}/${ABOUT_MAX}`} style={styles.mt16}>
                  <Input
                    multiline
                    value={f.about}
                    onChangeText={(v) => set({ about: v.slice(0, ABOUT_MAX) })}
                    maxLength={ABOUT_MAX}
                    placeholder={nb.offer.aboutPh}
                    accessibilityLabel={nb.offer.aboutLabel}
                    error={errOn('about')}
                  />
                  {errText('about')}
                </Field>
                <View style={[styles.labelRow, styles.mt16]}>
                  <Text style={text.label}>{nb.offer.experienceLabel}</Text>
                  <Text style={text.hint}>{experienceText(f.years * 12 + f.months) ?? nb.offer.experienceHint}</Text>
                </View>
                {/* years and months side by side: "1 år og 6 mnd" */}
                <View style={styles.expRow}>
                  <View style={styles.flex}>
                    <Text style={[text.meta, styles.expUnit]}>{nb.offer.yearsUnit}</Text>
                    <Stepper
                      value={String(f.years)}
                      minusLabel={nb.offer.fewerYears}
                      plusLabel={nb.offer.moreYears}
                      onMinus={() => set({ years: Math.max(0, f.years - 1) })}
                      onPlus={() => set({ years: Math.min(MAX_YEARS, f.years + 1) })}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[text.meta, styles.expUnit]}>{nb.offer.monthsUnit}</Text>
                    <Stepper
                      value={String(f.months)}
                      minusLabel={nb.offer.fewerMonths}
                      plusLabel={nb.offer.moreMonths}
                      onMinus={() => set(f.months > 0 ? { months: f.months - 1 } : f.years > 0 ? { years: f.years - 1, months: 11 } : {})}
                      onPlus={() => set(f.months < 11 ? { months: f.months + 1 } : f.years < MAX_YEARS ? { years: f.years + 1, months: 0 } : {})}
                    />
                  </View>
                </View>
                <Field label={nb.offer.equipmentLabel} hint={nb.offer.experienceHint} style={styles.mt16}>
                  <Input
                    value={f.equipment}
                    onChangeText={(v) => set({ equipment: v.slice(0, 120) })}
                    placeholder={nb.offer.equipmentPh}
                    accessibilityLabel={nb.offer.equipmentLabel}
                  />
                </Field>
                <View style={[styles.labelRow, styles.mt20]}>
                  <Text style={text.label}>{nb.offer.photosLabel}</Text>
                  <Text style={text.hint}>{nb.wizard.s3.photoCount(f.photos.length)}</Text>
                </View>
                <View style={styles.photos}>
                  {f.photos.map((url, i) => (
                    <ScaleIn key={url} style={styles.photoCell}>
                      <Image source={{ uri: url }} style={styles.photo} />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={nb.wizard.s3.removePhoto(i + 1)}
                        onPress={() => set({ photos: f.photos.filter((p) => p !== url) })}
                        style={styles.photoX}
                      >
                        <Icon name="x" size={14} color={colors.white} />
                      </Pressable>
                    </ScaleIn>
                  ))}
                  {Array.from({ length: uploading }).map((_, i) => (
                    <View key={`up${i}`} style={[styles.photoCell, styles.photoBusy]}>
                      <Spinner />
                    </View>
                  ))}
                  {f.photos.length + uploading < MAX_PHOTOS ? (
                    <View style={styles.photoCell}>
                      <PhotoAddTile onPress={addPhotos} />
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <Text style={styles.q} accessibilityRole="header">{nb.offer.s3q}</Text>
                <Text style={styles.qs}>{nb.offer.s3sub}</Text>
                <View style={[styles.gap10, styles.mt22]} accessibilityRole="radiogroup">
                  {(
                    [
                      ['FROM', nb.offer.priceFrom, nb.offer.priceFromSub],
                      ['FIXED', nb.offer.priceFixed, nb.offer.priceFixedSub],
                      ['BY_AGREEMENT', nb.offer.priceAgree, nb.offer.priceAgreeSub],
                    ] as [Price, string, string][]
                  ).map(([id, title, sub]) => (
                    <OptionCard key={id} selected={f.price === id} onPress={() => set({ price: id })} accessibilityLabel={`${title}. ${sub}`} style={styles.opt}>
                      <Radio selected={f.price === id} />
                      <View style={styles.flex1}>
                        <Text style={text.label}>{title}</Text>
                        <Text style={text.meta}>{sub}</Text>
                      </View>
                    </OptionCard>
                  ))}
                </View>
                {f.price !== 'BY_AGREEMENT' ? (
                  <FadeUp style={styles.mt20}>
                    <View ref={target('amount')} collapsable={false} />
                    <Field label={nb.offer.amountLabel}>
                      <AmountInput value={f.amount} onChangeText={(v) => set({ amount: v.replace(/\D/g, '') })} accessibilityLabel={nb.offer.amountLabel} />
                      {errText('amount')}
                    </Field>
                  </FadeUp>
                ) : null}
                <PaymentNote style={styles.mt20} />
              </>
            ) : null}

            {step === 4 ? (
              <>
                <Text style={styles.q} accessibilityRole="header">{nb.offer.s4q}</Text>
                <Text style={styles.qs}>{nb.offer.s4sub}</Text>
                <View ref={target('days')} collapsable={false} />
                <View style={[styles.labelRow, styles.mt22]}>
                  <Text style={text.label}>{nb.offer.daysLabel}</Text>
                  <Text style={text.hint}>{nb.offer.daysHint}</Text>
                </View>
                <View style={[styles.days, errOn('days') && styles.daysErr]}>
                  {WEEKDAYS.map((w) => {
                    const on = f.days.includes(w.i);
                    return (
                      <Pressable
                        key={w.i}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={w.long}
                        onPress={() => {
                          haptics.select();
                          toggleDay(w.i);
                        }}
                        style={[styles.day, on && [styles.dayOn, shadow.btnInk]]}
                      >
                        <Text style={[styles.dayText, on && styles.dayTextOn]}>{w.short}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={[styles.chips, styles.mt10]}>
                  <Chip label={nb.offer.workdays} size="sm" onPress={() => set({ days: [1, 2, 3, 4, 5] })} />
                  <Chip label={nb.offer.weekend} size="sm" onPress={() => set({ days: [0, 6] })} />
                </View>
                {errText('days')}
                <Field label={nb.wizard.s4.kommune} style={styles.mt16}>
                  <SelectBox value={f.kommune} placeholder={nb.oppdrag.pickKommune} icon="building" onPress={() => setKSheet(true)} accessibilityLabel={nb.wizard.s4.pickKommuneA11y(f.kommune)} />
                </Field>
                <View ref={target('area')} collapsable={false} />
                <Field label={nb.wizard.s4.area} style={styles.mt16}>
                  {/* the nabolag MinNabo has in this kommune (database), «Hele kommunen» = the kommune itself */}
                  <AreaSearch
                    kommune={f.kommune}
                    value={!f.area ? '' : f.area === f.kommune ? WHOLE_KOMMUNE : f.area}
                    onChange={(a) => set({ area: a === WHOLE_KOMMUNE ? f.kommune : a })}
                    error={errOn('area')}
                  />
                  {errText('area')}
                </Field>
                <Text style={[text.label, styles.mt20]}>{nb.offer.distanceLabel}</Text>
                <Stepper
                  value={nb.offer.km(f.km)}
                  minusLabel={`${nb.offer.distanceLabel} –`}
                  plusLabel={`${nb.offer.distanceLabel} +`}
                  onMinus={() => set({ km: Math.max(1, f.km - 1) })}
                  onPlus={() => set({ km: Math.min(MAX_KM, f.km + 1) })}
                />
              </>
            ) : null}

            {step === 5 ? (
              <>
                <Text style={styles.q} accessibilityRole="header">{nb.offer.s5q}</Text>
                <Text style={styles.qs}>{nb.offer.s5sub}</Text>
                <FadeUp style={styles.mt22}>
                  <ListingCard
                    kind="offer"
                    title={preview.title}
                    category={f.cat ?? 'annet'}
                    photoUri={preview.images[0]?.url}
                    ownerName={owner.displayName}
                    place={preview.location.place}
                    schedule={listingSchedule(preview)}
                    priceLabel={price.label}
                    priceValue={price.value}
                  />
                </FadeUp>
                <View style={[styles.sum, shadow.card, styles.mt16]}>
                  {[
                    [nb.offer.steps[0], [f.cat ? categoryLabel(f.cat) : '', ...f.services].filter(Boolean).join(', '), 1],
                    [nb.offer.steps[1], f.about.length > 80 ? `${f.about.slice(0, 78).trim()} …` : f.about, 2],
                    [nb.offer.steps[2], price.label ? `${price.label} ${price.value}` : price.value, 3],
                    [nb.offer.steps[3], [listingSchedule(preview), `${preview.location.place} (omtrentlig)`].filter(Boolean).join(' · '), 4],
                  ].map(([k, v, s], i) => (
                    <Pressable
                      key={String(k)}
                      accessibilityRole="button"
                      accessibilityLabel={`${k}: ${v}. Endre`}
                      onPress={() => go(Number(s), 'back')}
                      style={[styles.sumRow, i > 0 && styles.sumLine]}
                    >
                      <View style={styles.flex1}>
                        <Text style={text.meta}>{String(k)}</Text>
                        <Text style={[text.label, styles.sumV]}>{String(v)}</Text>
                      </View>
                      <Icon name="edit" size={16} color={colors.mute} />
                    </Pressable>
                  ))}
                </View>
                <PaymentNote style={styles.mt16} />
              </>
            ) : null}
          </View>
        </SlideIn>
      </Screen>

      <Sheet visible={kSheet} onClose={() => setKSheet(false)} title={nb.oppdrag.pickKommune} scroll heightRatio={0.7}>
        {kommuner.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ checked: f.kommune === k }}
            onPress={() => {
              if (k !== f.kommune) set({ kommune: k, area: '' });
              setKSheet(false);
            }}
            style={styles.kRow}
          >
            <Text style={[text.body, styles.flex]}>{k}</Text>
            {f.kommune === k ? <Icon name="check" size={18} color={colors.limeDeep} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

function Stepper({ value, onMinus, onPlus, minusLabel, plusLabel }: { value: string; onMinus: () => void; onPlus: () => void; minusLabel: string; plusLabel: string }) {
  return (
    <View style={[styles.stepper, shadow.card]}>
      <Pressable accessibilityRole="button" accessibilityLabel={minusLabel} onPress={onMinus} style={styles.stepBtn}>
        <Icon name="minus" size={18} />
      </Pressable>
      <Text style={styles.stepV} accessibilityLiveRegion="polite">
        {value}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={plusLabel} onPress={onPlus} style={styles.stepBtn}>
        <Icon name="plus" size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex1: { flex: 1, minWidth: 0, gap: 2 },
  px: { paddingHorizontal: screenPadding },
  prog: { paddingHorizontal: screenPadding, paddingTop: 4, paddingBottom: 8, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  stepName: { fontSize: 14 },
  backBtn: { width: 58, paddingHorizontal: 0 },
  q: { fontFamily: text.h1.fontFamily, fontSize: 27, lineHeight: 29, letterSpacing: -0.81, color: colors.ink, marginTop: 14 },
  qs: { ...text.body, lineHeight: 21.75, color: colors.ink2, marginTop: 8 },
  mt10: { marginTop: 10 },
  mt16: { marginTop: 16 },
  mt20: { marginTop: 20 },
  mt22: { marginTop: 22 },
  gap10: { gap: 10 },
  grid: { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10, borderRadius: 24 },
  gridErr: { ...shadow.errorOutline, padding: 6, margin: -6, marginTop: 14 },
  cell: { width: '30%', flexGrow: 1 },
  tile: {
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  tileOn: { borderColor: colors.cyanDeep, backgroundColor: colors.cyanTint },
  pressed: { transform: [{ scale: 0.95 }] },
  tileL: { ...text.label, fontSize: 12.5, lineHeight: 15, textAlign: 'center', minHeight: 30, textAlignVertical: 'center' },
  tileLSmall: { fontSize: 11, lineHeight: 14 },
  tick: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.cyanDeep, alignItems: 'center', justifyContent: 'center' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCell: { width: '31%', aspectRatio: 1 },
  photo: { width: '100%', height: '100%', borderRadius: 16 },
  photoBusy: { borderRadius: 16, backgroundColor: colors.neutralPill, alignItems: 'center', justifyContent: 'center' },
  photoX: { position: 'absolute', top: 6, right: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.photoClose, alignItems: 'center', justifyContent: 'center' },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  days: { flexDirection: 'row', gap: 6, borderRadius: 16 },
  daysErr: { ...shadow.errorOutline, padding: 4, margin: -4 },
  day: { flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayText: { ...text.label, fontSize: 13 },
  dayTextOn: { color: colors.white },
  expRow: { flexDirection: 'row', gap: 10 },
  expUnit: { marginBottom: -4, marginLeft: 4 },
  stepper: { marginTop: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.card, padding: 6 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  stepV: { ...text.label, flex: 1, textAlign: 'center', fontSize: 16 },
  sum: { borderRadius: radius.card, backgroundColor: colors.white, paddingHorizontal: 14 },
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, minHeight: 56 },
  sumLine: { borderTopWidth: 1, borderTopColor: colors.line2 },
  sumV: { fontSize: 14.5 },
  kRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line2 },
});
