import { useState } from 'react';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import { categories } from '@/data/seed';
import { draftStore } from '@/data/draftStore';
import { Wizard, type WizardStep } from '@/components/Wizard';
import { TextField } from '@/components/ui/TextField';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { buildTaskListing, type TaskForm } from './buildListing';

const EMPTY: TaskForm = {
  title: '',
  description: '',
  categorySlug: '',
  place: '',
  scheduledText: '',
  durationText: '',
  priceMode: 'FIXED',
  amountKr: '',
  equipment: '',
};

export function TaskRequestForm() {
  const router = useRouter();
  const [form, setForm] = useState<TaskForm>(EMPTY);
  const set = <K extends keyof TaskForm>(key: K, value: TaskForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const steps: WizardStep[] = [
    {
      title: nb.leggUt.stepAboutTask,
      validate: () =>
        !form.title.trim()
          ? nb.leggUt.errRequired
          : !form.categorySlug
            ? nb.leggUt.errCategory
            : !form.description.trim()
              ? nb.leggUt.errRequired
              : null,
      render: () => (
        <>
          <TextField label={nb.leggUt.fieldTitle} value={form.title} onChangeText={(t) => set('title', t)} placeholder="F.eks. Klippe plen" />
          <ChipSelect
            label={nb.leggUt.fieldCategory}
            options={categories.map((c) => ({ value: c.slug, label: c.label }))}
            value={form.categorySlug || undefined}
            onChange={(v) => set('categorySlug', v)}
          />
          <TextField
            label={nb.leggUt.fieldDescription}
            value={form.description}
            onChangeText={(t) => set('description', t)}
            multiline
            placeholder="Beskriv hva som skal gjøres"
          />
        </>
      ),
    },
    {
      title: nb.leggUt.stepWhereWhen,
      validate: () => (!form.place.trim() ? nb.leggUt.errRequired : null),
      render: () => (
        <>
          <TextField label={nb.leggUt.fieldPlace} value={form.place} onChangeText={(t) => set('place', t)} placeholder="Kommune eller sted" hint="Kun omtrentlig sted vises offentlig." />
          <TextField label={nb.leggUt.fieldWhen} value={form.scheduledText} onChangeText={(t) => set('scheduledText', t)} placeholder="F.eks. I morgen kl. 17:00" />
          <TextField label={nb.leggUt.fieldDuration} value={form.durationText} onChangeText={(t) => set('durationText', t)} placeholder="F.eks. Omtrent 1–2 timer" />
        </>
      ),
    },
    {
      title: nb.leggUt.stepPrice,
      validate: () =>
        form.priceMode !== 'BY_AGREEMENT' && !form.amountKr.trim() ? nb.leggUt.errPrice : null,
      render: () => (
        <>
          <ChipSelect
            label={nb.leggUt.fieldPriceMode}
            options={[
              { value: 'FIXED', label: nb.leggUt.priceModeFixed },
              { value: 'BUDGET', label: nb.leggUt.priceModeBudget },
              { value: 'BY_AGREEMENT', label: nb.leggUt.priceModeWantOffers },
            ]}
            value={form.priceMode}
            onChange={(v) => set('priceMode', v)}
          />
          {form.priceMode !== 'BY_AGREEMENT' ? (
            <TextField
              label={nb.leggUt.fieldAmount}
              value={form.amountKr}
              onChangeText={(t) => set('amountKr', t)}
              keyboardType="numeric"
              placeholder="600"
            />
          ) : null}
          <TextField label={nb.leggUt.fieldEquipment} value={form.equipment} onChangeText={(t) => set('equipment', t)} placeholder="F.eks. Kan lånes" />
        </>
      ),
    },
  ];

  return (
    <Wizard
      heading={nb.leggUt.needTitle}
      steps={steps}
      finalLabel={nb.leggUt.previewTitle}
      onFinish={() => {
        draftStore.set(buildTaskListing(form));
        router.push('/legg-ut/forhandsvisning');
      }}
    />
  );
}
