import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { categories } from '@/data/seed';
import { draftStore } from '@/data/draftStore';
import { safePush } from '@/lib/nav';
import { Wizard, type WizardStep } from '@/components/Wizard';
import { TextField } from '@/components/ui/TextField';
import { SelectField } from '@/components/ui/SelectField';
import { PickerPills } from '@/components/ui/PickerPills';
import { ImagePickerField } from '@/components/ui/ImagePickerField';
import { SelectionCard } from '@/components/ui/SelectionCard';
import { ToggleCard, ToggleRow } from '@/components/ui/ToggleRow';
import { InfoBox } from '@/components/ui/InfoBox';
import { AppText } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { buildTaskListing, type TaskForm } from './buildListing';
import type { IconName } from '@/components/ui/Icon';

const EMPTY: TaskForm = {
  categorySlug: '',
  title: '',
  description: '',
  images: [],
  place: 'Lillehammer',
  area: '',
  dateMode: 'ASAP',
  dateText: '',
  timeFrom: '',
  timeTo: '',
  duration: '',
  priceMode: 'BUDGET',
  amountKr: '',
  equipCanBorrow: false,
  equipBringOwn: false,
  equipExtra: '',
  whoCanOffer: 'ALL_VERIFIED',
  confirmed: false,
};

const QUICK = ['hage', 'renhold', 'flytting', 'montering'];
const HOURS = Array.from({ length: 15 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);

export function TaskRequestForm() {
  const router = useRouter();
  const [form, setForm] = useState<TaskForm>(EMPTY);
  const set = <K extends keyof TaskForm>(k: K, v: TaskForm[K]) => setForm((f) => ({ ...f, [k]: v }));

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
            showCheck
          />
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
        </>
      ),
    },
    {
      title: nb.leggUt.imagesTitle,
      subtitle: nb.leggUt.imagesSub,
      render: () => (
        <>
          <ImagePickerField value={form.images} onChange={(v) => set('images', v)} />
          <InfoBox icon="zap">{nb.leggUt.photoTipsBody}</InfoBox>
        </>
      ),
    },
    {
      title: nb.leggUt.taskS3Title,
      subtitle: nb.leggUt.taskS3Sub,
      validate: () => (!form.place.trim() ? nb.leggUt.errRequired : null),
      render: () => (
        <>
          <TextField label={nb.leggUt.placeLabel} value={form.place} onChangeText={(t) => set('place', t)} />
          <TextField
            label={nb.leggUt.areaLabel}
            floatingLabel
            value={form.area}
            onChangeText={(t) => set('area', t)}
            placeholder="2615 Lillehammer"
          />
          <InfoBox icon="shield">{nb.leggUt.addressPrivateNote}</InfoBox>

          <AppText variant="meta" weight="bold">
            {nb.leggUt.wishedDate}
          </AppText>
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
            <TextField
              label={nb.leggUt.datePick}
              floatingLabel
              value={form.dateText}
              onChangeText={(t) => set('dateText', t)}
              placeholder="I morgen, 29. august 2026"
            />
          ) : null}

          <AppText variant="meta" weight="bold">
            {nb.leggUt.timeLabel}
          </AppText>
          <View style={styles.timeRow}>
            <View style={styles.timeCell}>
              <SelectField
                label={nb.leggUt.timeFrom}
                placeholder={nb.leggUt.timeFrom}
                showLabel={false}
                icon="clock"
                value={form.timeFrom || undefined}
                options={HOURS.map((h) => ({ value: h, label: `${nb.leggUt.timeFrom} ${h}` }))}
                onChange={(v) => set('timeFrom', v)}
              />
            </View>
            <View style={styles.timeCell}>
              <SelectField
                label={nb.leggUt.timeTo}
                placeholder={nb.leggUt.timeTo}
                showLabel={false}
                icon="clock"
                value={form.timeTo || undefined}
                options={HOURS.map((h) => ({ value: h, label: `${nb.leggUt.timeTo} ${h}` }))}
                onChange={(v) => set('timeTo', v)}
              />
            </View>
          </View>

          <SelectField
            label={nb.leggUt.durationLabel}
            placeholder="Velg varighet"
            value={form.duration || undefined}
            options={[
              'Under 1 time',
              'Omtrent 1–2 timer',
              'Omtrent 2–4 timer',
              'En hel dag',
              'Flere dager',
            ].map((v) => ({ value: v, label: v }))}
            onChange={(v) => set('duration', v)}
          />
        </>
      ),
    },
    {
      title: nb.leggUt.taskS4Title,
      subtitle: nb.leggUt.taskS4Sub,
      validate: () =>
        form.priceMode === 'BUDGET' && !form.amountKr.trim()
          ? nb.leggUt.errPrice
          : !form.confirmed
            ? nb.leggUt.errConfirm
            : null,
      render: () => (
        <>
          <AppText variant="cardTitle" weight="bold">
            {nb.leggUt.priceQuestion}
          </AppText>
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
            <>
              <AmountInput value={form.amountKr} onChange={(v) => set('amountKr', v)} />
              <AppText variant="meta" color="navyMuted">
                {nb.leggUt.budgetHint}
              </AppText>
            </>
          ) : null}

          <AppText variant="cardTitle" weight="bold">
            {nb.leggUt.equipQuestion}
          </AppText>
          <ToggleCard>
            <ToggleRow
              icon="feather"
              label={nb.leggUt.equipCanBorrow}
              value={form.equipCanBorrow}
              onValueChange={(v) => set('equipCanBorrow', v)}
            />
            <ToggleRow
              icon="calendar"
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

          <AppText variant="cardTitle" weight="bold">
            {nb.leggUt.whoQuestion}
          </AppText>
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
          <AppText variant="meta" color="navyMuted">
            {nb.leggUt.whoHint}
          </AppText>

          <InfoBox icon="shield">{nb.leggUt.noPaymentNote}</InfoBox>

          <ConfirmRow value={form.confirmed} onChange={(v) => set('confirmed', v)} />
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

export function AmountInput({
  value,
  onChange,
  unitLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  unitLabel?: string;
}) {
  return (
    <View style={styles.amount}>
      <View style={styles.amountField}>
        <TextField
          label={nb.leggUt.amountLabel}
          hideLabel
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder="600"
        />
      </View>
      <View style={styles.amountUnit}>
        <AppText variant="cardTitle" weight="bold" color="navyMuted">
          {unitLabel ?? nb.leggUt.amountUnit}
        </AppText>
      </View>
    </View>
  );
}

export function ConfirmRow({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={nb.leggUt.confirmInfo}
      onPress={() => onChange(!value)}
      style={styles.confirm}
    >
      <View style={[styles.checkbox, value && styles.checkboxOn]}>
        {value ? <Icon name="check" size={14} color="white" /> : null}
      </View>
      <AppText variant="meta" style={styles.confirmText}>
        {nb.leggUt.confirmInfo}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  timeRow: { flexDirection: 'row', gap: tokens.space.md },
  timeCell: { flex: 1 },
  cardRow: { flexDirection: 'row', gap: tokens.space.md },
  amount: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  amountField: { flex: 1 },
  amountUnit: { paddingBottom: 2 },
  confirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.tile,
    padding: tokens.space.md,
    backgroundColor: tokens.color.surface,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: tokens.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: tokens.color.lime, borderColor: tokens.color.lime },
  confirmText: { flex: 1 },
});
