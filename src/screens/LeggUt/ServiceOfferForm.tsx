import { useState } from 'react';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import { categories } from '@/data/seed';
import { draftStore } from '@/data/draftStore';
import { Wizard, type WizardStep } from '@/components/Wizard';
import { TextField } from '@/components/ui/TextField';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { TagInput } from '@/components/ui/TagInput';
import { buildOfferListing, type OfferForm } from './buildListing';

const EMPTY: OfferForm = {
  title: '',
  about: '',
  categorySlug: '',
  services: [],
  experienceYears: '',
  completedJobs: '',
  place: '',
  maxDistanceKm: '',
  availabilityText: '',
  equipmentText: '',
  priceMode: 'FROM',
  amountKr: '',
};

export function ServiceOfferForm() {
  const router = useRouter();
  const [form, setForm] = useState<OfferForm>(EMPTY);
  const set = <K extends keyof OfferForm>(key: K, value: OfferForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const steps: WizardStep[] = [
    {
      title: nb.leggUt.stepAboutYou,
      validate: () =>
        !form.title.trim()
          ? nb.leggUt.errRequired
          : !form.categorySlug
            ? nb.leggUt.errCategory
            : !form.about.trim()
              ? nb.leggUt.errRequired
              : null,
      render: () => (
        <>
          <TextField label={nb.leggUt.fieldTitle} value={form.title} onChangeText={(t) => set('title', t)} placeholder="F.eks. Jeg kan klippe plenen din" />
          <ChipSelect
            label={nb.leggUt.fieldCategory}
            options={categories.map((c) => ({ value: c.slug, label: c.label }))}
            value={form.categorySlug || undefined}
            onChange={(v) => set('categorySlug', v)}
          />
          <TextField label={nb.leggUt.fieldAbout} value={form.about} onChangeText={(t) => set('about', t)} multiline placeholder="Fortell hva du tilbyr" />
        </>
      ),
    },
    {
      title: nb.leggUt.stepServices,
      render: () => (
        <>
          <TagInput
            label={nb.leggUt.fieldServices}
            placeholder="F.eks. Gressklipping"
            values={form.services}
            onChange={(v) => set('services', v)}
          />
          <TextField label={nb.leggUt.fieldExperienceYears} value={form.experienceYears} onChangeText={(t) => set('experienceYears', t)} keyboardType="numeric" placeholder="2" />
          <TextField label={nb.leggUt.fieldCompletedJobs} value={form.completedJobs} onChangeText={(t) => set('completedJobs', t)} keyboardType="numeric" placeholder="9" />
        </>
      ),
    },
    {
      title: nb.leggUt.stepAreaPrice,
      validate: () =>
        !form.place.trim()
          ? nb.leggUt.errRequired
          : form.priceMode === 'FROM' && !form.amountKr.trim()
            ? nb.leggUt.errPrice
            : null,
      render: () => (
        <>
          <TextField label={nb.leggUt.fieldPlace} value={form.place} onChangeText={(t) => set('place', t)} placeholder="Kommune eller sted" />
          <TextField label={nb.leggUt.fieldMaxDistance} value={form.maxDistanceKm} onChangeText={(t) => set('maxDistanceKm', t)} keyboardType="numeric" placeholder="15" />
          <TextField label={nb.leggUt.fieldAvailability} value={form.availabilityText} onChangeText={(t) => set('availabilityText', t)} placeholder="F.eks. Ledig ettermiddager og helger" />
          <TextField label={nb.leggUt.fieldEquipment} value={form.equipmentText} onChangeText={(t) => set('equipmentText', t)} placeholder="F.eks. Har egen gressklipper" />
          <ChipSelect
            label={nb.leggUt.fieldPriceMode}
            options={[
              { value: 'FROM', label: nb.leggUt.priceModeFrom },
              { value: 'BY_AGREEMENT', label: nb.leggUt.priceModeByAgreement },
            ]}
            value={form.priceMode}
            onChange={(v) => set('priceMode', v)}
          />
          {form.priceMode === 'FROM' ? (
            <TextField label={nb.leggUt.fieldAmount} value={form.amountKr} onChangeText={(t) => set('amountKr', t)} keyboardType="numeric" placeholder="500" />
          ) : null}
        </>
      ),
    },
  ];

  return (
    <Wizard
      heading={nb.leggUt.offerTitle}
      steps={steps}
      finalLabel={nb.leggUt.previewTitle}
      onFinish={() => {
        draftStore.set(buildOfferListing(form));
        router.push('/legg-ut/forhandsvisning');
      }}
    />
  );
}
