import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { CATEGORIES as categories } from '@/domain/categories';
import { TASK_TEMPLATES } from '@/domain/taskTemplates';
import { CATEGORY_INTAKE } from '@/domain/categoryIntake';
import { draftStore } from '@/data/draftStore';
import { haptics } from '@/lib/haptics';
import { outdoorWarningFor } from '@/lib/weather';
import { safePush } from '@/lib/nav';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Wizard, type WizardStep } from '@/components/Wizard';
import { KommunePicker } from '@/components/KommunePicker';
import { TextField } from '@/components/ui/TextField';
import { SelectField } from '@/components/ui/SelectField';
import { DateField } from '@/components/ui/DateField';
import { TimeField } from '@/components/ui/TimeField';
import { PickerPills } from '@/components/ui/PickerPills';
import { ImagePickerField } from '@/components/ui/ImagePickerField';
import { SelectionCard } from '@/components/ui/SelectionCard';
import { ToggleCard, ToggleRow } from '@/components/ui/ToggleRow';
import { InfoBox } from '@/components/ui/InfoBox';
import { AmountField } from '@/components/ui/AmountField';
import { FieldGroup } from '@/components/ui/FieldGroup';
import { ConfirmCheckbox } from '@/components/ui/ConfirmCheckbox';
import { AppText } from '@/components/ui/Text';
import { buildTaskListing, type TaskForm } from './buildListing';
import type { IconName } from '@/components/ui/Icon';

const EMPTY: TaskForm = {
  categorySlug: '',
  title: '',
  description: '',
  images: [],
  place: 'Lillehammer',
  municipality: '',
  area: '',
  dateMode: 'ASAP',
  date: null,
  timeFrom: '',
  timeTo: '',
  duration: '',
  priceMode: 'BUDGET',
  amountKr: '',
  equipCanBorrow: false,
  equipBringOwn: false,
  equipExtra: '',
  whoCanOffer: 'ALL_VERIFIED',
  isDugnad: false,
  recurrence: '',
  intake: {},
  confirmed: false,
};

const QUICK = ['hage', 'renhold', 'flytting', 'montering'];
const DURATIONS = ['Under 1 time', 'Omtrent 1–2 timer', 'Omtrent 2–4 timer', 'En hel dag', 'Flere dager'];

export function TaskRequestForm() {
  const router = useRouter();
  const me = useCurrentUser();
  const [form, setForm] = useState<TaskForm>(() => ({
    ...EMPTY,
    place: me.place ?? EMPTY.place,
    municipality: me.municipality ?? '',
  }));
  const set = <K extends keyof TaskForm>(k: K, v: TaskForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const applyTemplate = (id: string) => {
    const t = TASK_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    haptics.select();
    setForm((f) => ({
      ...f,
      categorySlug: t.categorySlug,
      title: t.title,
      description: t.description,
      duration: t.duration ?? f.duration,
      equipExtra: t.equipExtra ?? f.equipExtra,
    }));
  };

  const steps: WizardStep[] = [
    {
      title: nb.leggUt.taskS1Title,
      subtitle: nb.leggUt.taskS1Sub,
      validate: () =>
        !form.categorySlug
          ? nb.leggUt.errCategory
          : !form.title.trim()
            ? nb.leggUt.errRequired
            : !form.description.trim()
              ? nb.leggUt.errRequired
              : null,
      render: () => (
        <>
          <View style={styles.templateGroup}>
            <AppText variant="meta" weight="bold" color="navyMuted">
              {nb.leggUt.templatesLabel}
            </AppText>
            <PickerPills
              scroll
              options={TASK_TEMPLATES.map((t) => ({
                value: t.id,
                label: t.label,
                icon: t.icon,
              }))}
              selected={[]}
              onToggle={applyTemplate}
            />
          </View>
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
            label={nb.leggUt.taskTitleLabel}
            value={form.title}
            onChangeText={(t) => set('title', t)}
            placeholder="Klippe plen"
            maxLength={60}
          />
          <TextField
            label={nb.leggUt.taskDescLabel}
            value={form.description}
            onChangeText={(t) => set('description', t)}
            multiline
            maxLength={500}
            hint={nb.leggUt.taskDescHint}
          />

          {(CATEGORY_INTAKE[form.categorySlug] ?? []).map((field) =>
            field.type === 'choice' ? (
              <SelectField
                key={field.key}
                label={field.label}
                placeholder={nb.leggUt.selectPlaceholder}
                value={form.intake[field.key] || undefined}
                options={field.options.map((o) => ({ value: o, label: o }))}
                onChange={(v) => set('intake', { ...form.intake, [field.key]: v })}
              />
            ) : (
              <TextField
                key={field.key}
                label={field.label}
                placeholder={field.placeholder}
                value={form.intake[field.key] ?? ''}
                onChangeText={(t) => set('intake', { ...form.intake, [field.key]: t })}
              />
            ),
          )}
        </>
      ),
    },
    {
      title: nb.leggUt.imagesTitle,
      subtitle: nb.leggUt.imagesSub,
      render: () => (
        <>
          <ImagePickerField value={form.images} onChange={(v) => set('images', v)} />
          <InfoBox icon="zap" tone="cyan">
            <AppText variant="meta" weight="bold" color="navy">
              {nb.leggUt.photoTipsTitle}
            </AppText>
            {'  '}
            {nb.leggUt.photoTipsBody}
          </InfoBox>
        </>
      ),
    },
    {
      title: nb.leggUt.taskS3Title,
      subtitle: nb.leggUt.taskS3Sub,
      validate: () => (!form.place.trim() ? nb.leggUt.errRequired : null),
      render: () => (
        <>
          <FieldGroup title={nb.leggUt.placeLabel}>
            <KommunePicker value={form.municipality} onChange={(k) => set('municipality', k)} />
            <TextField label={nb.leggUt.placeLabel} hideLabel value={form.place} onChangeText={(t) => set('place', t)} />
            <TextField
              label={nb.leggUt.areaLabel}
              floatingLabel
              value={form.area}
              onChangeText={(t) => set('area', t)}
              placeholder="2615 Lillehammer"
            />
            <InfoBox icon="shield">{nb.leggUt.addressPrivateNote}</InfoBox>
          </FieldGroup>

          <FieldGroup title={nb.leggUt.wishedDate}>
            <PickerPills
              options={[
                { value: 'ASAP', label: nb.leggUt.dateAsap },
                { value: 'FLEXIBLE', label: nb.leggUt.dateFlexible },
                { value: 'PICK', label: nb.leggUt.datePick, icon: 'calendar' },
              ]}
              selected={[form.dateMode]}
              onToggle={(v) => set('dateMode', v as TaskForm['dateMode'])}
            />
            {form.dateMode === 'PICK' ? (
              <DateField
                label={nb.leggUt.datePick}
                showLabel={false}
                value={form.date}
                onChange={(d) => set('date', d)}
              />
            ) : null}
            {form.dateMode === 'PICK' && form.date
              ? (() => {
                  const w = outdoorWarningFor(form.categorySlug, form.date.toISOString());
                  return w ? (
                    <InfoBox icon="cloud-drizzle" tone="cyan">
                      {nb.leggUt.weatherWarning[w.kind]}
                    </InfoBox>
                  ) : null;
                })()
              : null}
          </FieldGroup>

          <FieldGroup title={nb.leggUt.timeLabel}>
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

          <SelectField
            label={nb.leggUt.durationLabel}
            placeholder="Velg varighet"
            value={form.duration || undefined}
            options={DURATIONS.map((v) => ({ value: v, label: v }))}
            onChange={(v) => set('duration', v)}
          />

          <FieldGroup title={nb.leggUt.recurrenceLabel} hint={nb.leggUt.recurrenceHint}>
            <PickerPills
              options={[
                { value: '', label: nb.leggUt.recurrenceOnce },
                { value: 'WEEKLY', label: nb.leggUt.recurrenceWeekly },
                { value: 'BIWEEKLY', label: nb.leggUt.recurrenceBiweekly },
                { value: 'MONTHLY', label: nb.leggUt.recurrenceMonthly },
              ]}
              selected={[form.recurrence]}
              onToggle={(v) => set('recurrence', v as TaskForm['recurrence'])}
            />
          </FieldGroup>
        </>
      ),
    },
    {
      title: nb.leggUt.taskS4Title,
      subtitle: nb.leggUt.taskS4Sub,
      validate: () =>
        !form.isDugnad && form.priceMode === 'BUDGET' && !form.amountKr.trim()
          ? nb.leggUt.errPrice
          : !form.confirmed
            ? nb.leggUt.errConfirm
            : null,
      render: () => (
        <>
          <ToggleCard>
            <ToggleRow
              icon="heart"
              label={nb.leggUt.dugnadLabel}
              value={form.isDugnad}
              onValueChange={(v) => set('isDugnad', v)}
              last
            />
          </ToggleCard>
          {form.isDugnad ? (
            <InfoBox icon="heart" tone="lime">
              {nb.leggUt.dugnadNote}
            </InfoBox>
          ) : (
            <FieldGroup title={nb.leggUt.priceQuestion} hint={form.priceMode === 'BUDGET' ? nb.leggUt.budgetHint : undefined}>
              <View style={styles.cardRow}>
                <SelectionCard
                  label={nb.leggUt.priceModeBudget}
                  icon="calendar"
                  tone="lime"
                  selected={form.priceMode === 'BUDGET'}
                  onPress={() => set('priceMode', 'BUDGET')}
                />
                <SelectionCard
                  label={nb.leggUt.priceModeWantOffers}
                  icon="tag"
                  tone="cyan"
                  selected={form.priceMode === 'WANT_OFFERS'}
                  onPress={() => set('priceMode', 'WANT_OFFERS')}
                />
              </View>
              {form.priceMode === 'BUDGET' ? (
                <AmountField value={form.amountKr} onChange={(v) => set('amountKr', v)} />
              ) : null}
            </FieldGroup>
          )}

          <FieldGroup title={nb.leggUt.equipQuestion}>
            <ToggleCard>
              <ToggleRow
                icon="feather"
                label={nb.leggUt.equipCanBorrow}
                value={form.equipCanBorrow}
                onValueChange={(v) => set('equipCanBorrow', v)}
              />
              <ToggleRow
                icon="tool"
                label={nb.leggUt.equipBringOwn}
                value={form.equipBringOwn}
                onValueChange={(v) => set('equipBringOwn', v)}
                last
              />
            </ToggleCard>
            <TextField
              label={nb.leggUt.equipExtra}
              floatingLabel
              value={form.equipExtra}
              onChangeText={(t) => set('equipExtra', t)}
              placeholder="Ta gjerne med kantklipper hvis du har."
            />
          </FieldGroup>

          <FieldGroup title={nb.leggUt.whoQuestion} hint={nb.leggUt.whoHint}>
            <SelectField
              label={nb.leggUt.whoQuestion}
              showLabel={false}
              placeholder={nb.leggUt.whoAllVerified}
              icon="users"
              value={form.whoCanOffer}
              options={[
                { value: 'ALL_VERIFIED', label: nb.leggUt.whoAllVerified },
                { value: 'BUSINESS_ONLY', label: nb.leggUt.whoBusinessOnly },
              ]}
              onChange={(v) => set('whoCanOffer', v as TaskForm['whoCanOffer'])}
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
      heading={nb.leggUt.wizardTaskHeading}
      badge={nb.leggUt.needBadge}
      badgeTone="lime"
      steps={steps}
      finalLabel={nb.leggUt.previewTaskCta}
      onSaveDraft={() => {
        draftStore.set(buildTaskListing(form));
        safePush('/mine');
      }}
      onFinish={() => {
        draftStore.set(buildTaskListing(form));
        router.push('/legg-ut/forhandsvisning');
      }}
    />
  );
}

// Re-exported for the offer form + preview screen.
export { ConfirmCheckbox as ConfirmRow } from '@/components/ui/ConfirmCheckbox';

const styles = StyleSheet.create({
  templateGroup: { gap: tokens.space.sm, marginBottom: tokens.space.md },
  catGroup: { gap: tokens.space.sm },
  timeRow: { flexDirection: 'row', gap: tokens.space.md },
  timeCell: { flex: 1 },
  cardRow: { flexDirection: 'row', gap: tokens.space.md },
});
