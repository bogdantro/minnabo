import type { Listing, ListingType, PriceMode } from '@/domain/types';
import { nok } from '@/domain/price';
import { categories, profiles } from '@/data/seed';

const catBySlug = (slug: string) =>
  categories.find((c) => c.slug === slug) ?? categories[categories.length - 1];

export type TaskForm = {
  title: string;
  description: string;
  categorySlug: string;
  place: string;
  scheduledText: string;
  durationText: string;
  priceMode: 'FIXED' | 'BUDGET' | 'BY_AGREEMENT';
  amountKr: string;
  equipment: string;
};

export type OfferForm = {
  title: string;
  about: string;
  categorySlug: string;
  services: string[];
  experienceYears: string;
  completedJobs: string;
  place: string;
  maxDistanceKm: string;
  availabilityText: string;
  equipmentText: string;
  priceMode: 'FROM' | 'BY_AGREEMENT';
  amountKr: string;
};

const newId = () => `l-user-${Date.now()}`;

function priceFor(mode: PriceMode, amountKr: string) {
  if (mode === 'BY_AGREEMENT') return undefined;
  const n = Number(amountKr.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? nok(n) : undefined;
}

export function buildTaskListing(form: TaskForm): Listing {
  return {
    id: newId(),
    type: 'TASK_REQUEST' as ListingType,
    title: form.title.trim(),
    category: catBySlug(form.categorySlug),
    priceMode: form.priceMode,
    price: priceFor(form.priceMode, form.amountKr),
    location: { municipality: form.place.trim(), place: form.place.trim(), distanceKm: 0 },
    images: [],
    owner: profiles.mb,
    createdAt: new Date().toISOString(),
    status: 'PUBLISHED',
    task: {
      description: form.description.trim(),
      equipment: form.equipment.trim() || undefined,
      meetingNote: 'Adresse deles når tilbud er godtatt',
      durationText: form.durationText.trim() || undefined,
      scheduledText: form.scheduledText.trim() || undefined,
    },
  };
}

export function buildOfferListing(form: OfferForm): Listing {
  return {
    id: newId(),
    type: 'SERVICE_OFFER' as ListingType,
    title: form.title.trim(),
    category: catBySlug(form.categorySlug),
    priceMode: form.priceMode,
    price: priceFor(form.priceMode, form.amountKr),
    location: { municipality: form.place.trim(), place: form.place.trim(), distanceKm: 0 },
    images: [],
    owner: profiles.mb,
    createdAt: new Date().toISOString(),
    status: 'ACTIVE',
    offer: {
      about: form.about.trim(),
      services: form.services,
      experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
      completedJobs: form.completedJobs ? Number(form.completedJobs) : undefined,
      availabilityText: form.availabilityText.trim() || undefined,
      equipmentText: form.equipmentText.trim() || undefined,
      maxDistanceKm: form.maxDistanceKm ? Number(form.maxDistanceKm) : undefined,
    },
  };
}
