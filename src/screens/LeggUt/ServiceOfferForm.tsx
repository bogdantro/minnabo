import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { CATEGORIES as categories } from '@/domain/categories';
import { draftStore } from '@/data/draftStore';
import { safePush } from '@/lib/nav';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Wizard, type WizardStep } from '@/components/Wizard';
import { KommunePicker } from '@/components/KommunePicker';
import { TextField } from '@/components/ui/TextField';
import { SelectField } from '@/components/ui/SelectField';
import { TimeField } from '@/components/ui/TimeField';
import { PickerPills } from '@/components/ui/PickerPills';
import { ImagePickerField } from '@/components/ui/ImagePickerField';
import { SelectionCard } from '@/components/ui/SelectionCard';
import { ToggleCard, ToggleRow } from '@/components/ui/ToggleRow';
import { DistanceSlider } from '@/components/ui/DistanceSlider';
import { InfoBox } from '@/components/ui/InfoBox';
import { AmountField } from '@/components/ui/AmountField';
import { FieldGroup } from '@/components/ui/FieldGroup';
import { ConfirmCheckbox } from '@/components/ui/ConfirmCheckbox';
import { Button } from '@/components/ui/Button';
import { AppText } from '@/components/ui/Text';
import { buildOfferListing, type OfferForm } from './buildListing';
import type { IconName } from '@/components/ui/Icon';

const EMPTY: OfferForm = {
  categorySlug: '',
  title: '',
  about: '',
  images: [],
  services: [],
  experience: '',
  experienceText: '',
  place: 'Lillehammer',
  municipality: '',
  maxDistanceKm: 15,
  days: ['Man', 'Ons', 'Fre'],
  timeOfDay: [],
  timeFrom: '',
  timeTo: '',
  ownTransport: true,
  instantBook: false,
  priceMode: 'FROM',
  amountKr: '',
  priceUnit: 'per oppdrag',
  whoCanContact: 'ALL_VERIFIED',
  confirmed: false,
};

const QUICK = ['hage', 'renhold', 'flytting', 'montering'];
const SERVICE_OPTS: { value: string; label: string; icon: IconName }[] = [
  { value: 'Gressklipping', label: 'Gressklipping', icon: 'feather' },
  { value: 'Kantklipping', label: 'Kantklipping', icon: 'feather' },
  { value: 'Enkelt hagearbeid', label: 'Enkelt hagearbeid', icon: 'feather' },
  { value: 'Rydding', label: 'Rydding', icon: 'trash-2' },
  { value: 'Montering', label: 'Montering', icon: 'tool' },
  { value: 'Rengjøring', label: 'Rengjøring', icon: 'droplet' },
];
const DAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const TIME_OF_DAY = ['Morgen', 'Dagtid', 'Ettermiddag', 'Kveld'];
const EXPERIENCE = ['Under 1 år', '1 års erfaring', '2 års erfaring', '3–5 års erfaring', 'Mer enn 5 år'];

export function ServiceOfferForm() {
  const router = useRouter();
  const me = useCurrentUser();
  const [form, setForm] = useState<OfferForm>(() => ({
    ...EMPTY,
    place: me.place ?? EMPTY.place,
    municipality: me.municipality ?? '',
  }));
  const set = <K extends keyof OfferForm>(k: K, v: OfferForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleIn = (key: 'services' | 'days' | 'timeOfDay', v: string) =>
    set(key, form[key].includes(v) ? form[key].filter((x) => x !== v) : [...form[key], v]);

  const steps: WizardStep[] = [
    {
      title: nb.leggUt.offerS1Title,
      subtitle: nb.leggUt.offerS1Sub,
      validate: () =>
        !form.categorySlug
          ? nb.leggUt.errCategory
          : !form.title.trim()
            ? nb.leggUt.errRequired
            : !form.about.trim()
              ? nb.leggUt.errRequired
              : null,
      render: () => (
        <>
          <View style={styles.catGroup}>
            <SelectField
              label={nb.leggUt.fieldCategory}
              placeholder={nb.leggUt.selectCategory}
              icon="grid"
              value={form.categorySlug || undefined}
              options={categories.map((c) => ({ value: c.slug, label: c.label }))}
              onChange={(v) => set('categorySlug', v)}
            />
            <PickerPills
              scroll
              options={QUICK.map((slug) => {
                const c = categories.find((x) => x.slug === slug)!;
                return { value: slug, label: c.label, icon: c.icon as IconName };
              })}
              selected={form.categorySlug ? [form.categorySlug] : []}
              onToggle={(v) => set('categorySlug', v)}
            />
          </View>
          <TextField
            label={nb.leggUt.offerHeadlineLabel}
            value={form.title}
            onChangeText={(t) => set('title', t)}
            placeholder="Jeg kan klippe plenen din"
            maxLength={60}
            hint={nb.leggUt.offerHeadlineHint}
          />
          <TextField
            label={nb.leggUt.offerAboutLabel}
            value={form.about}
            onChangeText={(t) => set('about', t)}
            multiline
            maxLength={500}
            hint={nb.leggUt.offerAboutHint}
          />
          <InfoBox icon="user">{nb.leggUt.offerVisibilityNote}</InfoBox>
        </>
      ),
    },
    {
      title: nb.leggUt.offerS2Title,
      subtitle: nb.leggUt.offerS2Sub,
      validate: () => (form.services.length === 0 ? nb.leggUt.errRequired : null),
      render: () => (
        <>
          <FieldGroup title="Bilder">
            <ImagePickerField
              compact
              value={form.images}
              onChange={(v) => set('images', v)}
              uploadSub={nb.leggUt.offerUploadSub}
            />
          </FieldGroup>

          <FieldGroup title={nb.leggUt.servicesLabel}>
            <PickerPills
              options={SERVICE_OPTS}
              selected={form.services}
              onToggle={(v) => toggleIn('services', v)}
              showCheck
            />
          </FieldGroup>

          <SelectField
            label={nb.leggUt.experienceLabel}
            placeholder="Velg erfaring"
            value={form.experience || undefined}
            options={EXPERIENCE.map((v) => ({ value: v, label: v }))}
            onChange={(v) => set('experience', v)}
          />
          <TextField
            label={nb.leggUt.experienceTextLabel}
            floatingLabel
            value={form.experienceText}
            onChangeText={(t) => set('experienceText', t)}
            multiline
            placeholder="Jeg har klippet plener for familie og naboer de siste to årene."
          />
          <InfoBox icon="shield">{nb.leggUt.offerRightsNote}</InfoBox>
        </>
      ),
    },
    {
      title: nb.leggUt.offerS3Title,
      subtitle: nb.leggUt.offerS3Sub,
      validate: () => (!form.place.trim() ? nb.leggUt.errRequired : null),
      render: () => (
        <>
          <SelectField
            label={nb.leggUt.startPoint}
            placeholder={nb.leggUt.startPoint}
            icon="map-pin"
            value={form.place || undefined}
            options={['Lillehammer', 'Hamar', 'Gjøvik', 'Elverum', 'Otta'].map((v) => ({ value: v, label: v }))}
            onChange={(v) => set('place', v)}
          />
          <FieldGroup title={nb.location.pickKommune}>
            <KommunePicker value={form.municipality} onChange={(k) => set('municipality', k)} />
          </FieldGroup>
          <FieldGroup title={nb.leggUt.travelDistance} hint={nb.leggUt.areaApproxNote}>
            <DistanceSlider label={nb.leggUt.travelDistance} value={form.maxDistanceKm} onChange={(v) => set('maxDistanceKm', v)} />
          </FieldGroup>

          <FieldGroup title={nb.leggUt.availableDays}>
            <PickerPills
              options={DAYS.map((d) => ({ value: d, label: d }))}
              selected={form.days}
              onToggle={(v) => toggleIn('days', v)}
            />
          </FieldGroup>

          <FieldGroup title={nb.leggUt.timeLabel}>
            <PickerPills
              options={TIME_OF_DAY.map((t) => ({ value: t, label: t }))}
              selected={form.timeOfDay}
              onToggle={(v) => toggleIn('timeOfDay', v)}
              tone="cyan"
              showCheck
            />
            <View style={styles.timeRow}>
              <View style={styles.timeCell}>
                <TimeField
                  label={nb.leggUt.timeFrom}
                  showLabel={false}
                  placeholder={nb.leggUt.timeFrom}
                  value={form.timeFrom || null}
                  onChange={(v) => set('timeFrom', v)}
                />
              </View>
              <View style={styles.timeCell}>
                <TimeField
                  label={nb.leggUt.timeTo}
                  showLabel={false}
                  placeholder={nb.leggUt.timeTo}
                  value={form.timeTo || null}
                  onChange={(v) => set('timeTo', v)}
                />
              </View>
            </View>
          </FieldGroup>

          <FieldGroup title={nb.leggUt.transportLabel}>
            <ToggleCard>
              <ToggleRow
                icon="truck"
                label={nb.leggUt.ownTransport}
                hint={nb.leggUt.ownTransportHint}
                value={form.ownTransport}
                onValueChange={(v) => set('ownTransport', v)}
                last
              />
            </ToggleCard>
          </FieldGroup>

          <FieldGroup title={nb.leggUt.instantBookTitle} hint={nb.leggUt.instantBookHint}>
            <ToggleCard>
              <ToggleRow
                icon="zap"
                label={nb.leggUt.instantBookLabel}
                value={form.instantBook}
                onValueChange={(v) => set('instantBook', v)}
                last
              />
            </ToggleCard>
          </FieldGroup>
        </>
      ),
    },
    {
      title: nb.leggUt.offerS4Title,
      subtitle: nb.leggUt.offerS4Sub,
      validate: () =>
        form.priceMode === 'FROM' && !form.amountKr.trim()
          ? nb.leggUt.errPrice
          : !form.confirmed
            ? nb.leggUt.errConfirm
            : null,
      render: () => (
        <>
          <FieldGroup title={nb.leggUt.offerPriceQuestion} hint={form.priceMode === 'FROM' ? nb.leggUt.fromPriceHint : undefined}>
            <View style={styles.cardRow}>
              <SelectionCard
                label={nb.leggUt.priceModeFrom}
                icon="tag"
                tone="lime"
                selected={form.priceMode === 'FROM'}
                onPress={() => set('priceMode', 'FROM')}
              />
              <SelectionCard
                label={nb.leggUt.priceModeByAgreement}
                icon="message-circle"
                tone="cyan"
                selected={form.priceMode === 'BY_AGREEMENT'}
                onPress={() => set('priceMode', 'BY_AGREEMENT')}
              />
            </View>
            {form.priceMode === 'FROM' ? (
              <View style={styles.priceRow}>
                <View style={styles.priceAmount}>
                  <AmountField value={form.amountKr} onChange={(v) => set('amountKr', v)} placeholder="500" />
                </View>
                <View style={styles.priceUnit}>
                  <SelectField
                    label={nb.leggUt.perJob}
                    showLabel={false}
                    placeholder={nb.leggUt.perJob}
                    value={form.priceUnit}
                    options={[
                      { value: 'per oppdrag', label: nb.leggUt.perJob },
                      { value: 'per time', label: nb.leggUt.perHour },
                    ]}
                    onChange={(v) => set('priceUnit', v as OfferForm['priceUnit'])}
                  />
                </View>
              </View>
            ) : null}
          </FieldGroup>

          <FieldGroup title={nb.leggUt.offerEquipQuestion}>
            <ToggleCard>
              <ToggleRow
                icon="feather"
                label="Egen gressklipper"
                value={form.services.includes('Gressklipping')}
                onValueChange={() => toggleIn('services', 'Gressklipping')}
              />
              <ToggleRow
                icon="feather"
                label="Kantklipper"
                value={form.services.includes('Kantklipping')}
                onValueChange={() => toggleIn('services', 'Kantklipping')}
              />
              <ToggleRow
                icon="package"
                label="Hageavfallssekker"
                value={form.services.includes('Rydding')}
                onValueChange={() => toggleIn('services', 'Rydding')}
                last
              />
            </ToggleCard>
            <Button label={nb.leggUt.addEquipment} variant="secondary" iconLeft="plus" onPress={() => {}} />
          </FieldGroup>

          <FieldGroup title={nb.leggUt.offerWhoQuestion} hint={nb.leggUt.offerWhoHint}>
            <SelectField
              label={nb.leggUt.offerWhoQuestion}
              showLabel={false}
              placeholder={nb.leggUt.whoAllVerified}
              icon="users"
              value={form.whoCanContact}
              options={[
                { value: 'ALL_VERIFIED', label: nb.leggUt.whoAllVerified },
                { value: 'BUSINESS_ONLY', label: nb.leggUt.whoBusinessOnly },
              ]}
              onChange={(v) => set('whoCanContact', v as OfferForm['whoCanContact'])}
            />
          </FieldGroup>

          <InfoBox icon="shield">{nb.leggUt.noPaymentNote}</InfoBox>
          <ConfirmCheckbox value={form.confirmed} onChange={(v) => set('confirmed', v)}>
            {nb.leggUt.confirmInfo}
          </ConfirmCheckbox>
        </>
      ),
    },
  ];

  return (
    <Wizard
      heading={nb.leggUt.wizardOfferHeading}
      badge={nb.leggUt.offerBadge}
      badgeTone="cyan"
      steps={steps}
      finalLabel={nb.leggUt.previewOfferCta}
      onSaveDraft={() => {
        draftStore.set(buildOfferListing(form));
        safePush('/mine');
      }}
      onFinish={() => {
        draftStore.set(buildOfferListing(form));
        router.push('/legg-ut/forhandsvisning');
      }}
    />
  );
}

const styles = StyleSheet.create({
  catGroup: { gap: tokens.space.sm },
  timeRow: { flexDirection: 'row', gap: tokens.space.md },
  timeCell: { flex: 1 },
  cardRow: { flexDirection: 'row', gap: tokens.space.md },
  priceRow: { flexDirection: 'row', gap: tokens.space.md, alignItems: 'flex-start' },
  priceAmount: { flex: 1 },
  priceUnit: { flex: 1 },
});
