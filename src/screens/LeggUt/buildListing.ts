import type { Listing, ListingType, PriceMode, PublicProfile } from '@/domain/types';
import { nok } from '@/domain/price';
import { categoryBySlug } from '@/domain/categories';
import { formatFriendlyDate } from '@/lib/calendar';
import { CATEGORY_INTAKE } from '@/domain/categoryIntake';

const catBySlug = categoryBySlug;

// The owner is assigned server-side from the auth session on createListing;
// this placeholder only satisfies the local `Listing` shape for the preview.
const placeholderOwner: PublicProfile = {
  id: 'me',
  displayName: 'Deg',
  initials: 'D',
  memberSince: '',
  location: { municipality: '', place: '' },
  isBusiness: false,
  verifications: [],
};

export type TaskForm = {
  categorySlug: string;
  title: string;
  description: string;
  images: string[];
  place: string;
  area: string;
  dateMode: 'ASAP' | 'FLEXIBLE' | 'PICK';
  date: Date | null;
  timeFrom: string;
  timeTo: string;
  duration: string;
  priceMode: 'BUDGET' | 'WANT_OFFERS';
  amountKr: string;
  equipCanBorrow: boolean;
  equipBringOwn: boolean;
  equipExtra: string;
  whoCanOffer: 'ALL_VERIFIED' | 'BUSINESS_ONLY';
  isDugnad: boolean;
  recurrence: '' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  /** category-specific intake answers, keyed by field key */
  intake: Record<string, string>;
  confirmed: boolean;
};

export type OfferForm = {
  categorySlug: string;
  title: string;
  about: string;
  images: string[];
  services: string[];
  experience: string;
  experienceText: string;
  place: string;
  maxDistanceKm: number;
  days: string[];
  timeOfDay: string[];
  timeFrom: string;
  timeTo: string;
  ownTransport: boolean;
  instantBook: boolean;
  priceMode: 'FROM' | 'BY_AGREEMENT';
  amountKr: string;
  priceUnit: 'per oppdrag' | 'per time';
  whoCanContact: 'ALL_VERIFIED' | 'BUSINESS_ONLY';
  confirmed: boolean;
};

const newId = () => `l-user-${Date.now()}`;
const toImages = (urls: string[]) => urls.map((url, i) => ({ id: `ui-${i}-${Date.now()}`, url }));

function priceFrom(mode: PriceMode, amountKr: string) {
  if (mode === 'BY_AGREEMENT') return undefined;
  const n = Number(amountKr.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? nok(n) : undefined;
}

const dateLabel = (f: TaskForm) =>
  f.dateMode === 'ASAP'
    ? 'Så snart som mulig'
    : f.dateMode === 'FLEXIBLE'
      ? 'Fleksibel dato'
      : f.date
        ? formatFriendlyDate(f.date)
        : undefined;

const timeLabel = (from: string, to: string) =>
  from && to ? `${from}–${to}` : from || to || undefined;

export function buildTaskListing(form: TaskForm): Listing {
  const scheduledParts = [dateLabel(form), timeLabel(form.timeFrom, form.timeTo)]
    .filter(Boolean)
    .join(', ');
  const intake = (CATEGORY_INTAKE[form.categorySlug] ?? [])
    .map((f) => ({ label: f.label, value: (form.intake[f.key] ?? '').trim() }))
    .filter((a) => a.value.length > 0);
  return {
    id: newId(),
    type: 'TASK_REQUEST' as ListingType,
    title: form.title.trim(),
    category: catBySlug(form.categorySlug),
    priceMode: form.isDugnad ? 'BY_AGREEMENT' : form.priceMode === 'BUDGET' ? 'BUDGET' : 'BY_AGREEMENT',
    price: form.isDugnad || form.priceMode !== 'BUDGET' ? undefined : priceFrom('BUDGET', form.amountKr),
    location: {
      municipality: form.place.trim(),
      place: form.place.trim(),
      distanceKm: 0,
    },
    images: toImages(form.images),
    owner: placeholderOwner,
    createdAt: new Date().toISOString(),
    status: 'PUBLISHED',
    task: {
      description: form.description.trim(),
      equipment: form.equipCanBorrow
        ? 'Kan lånes'
        : form.equipBringOwn
          ? 'Ta med eget utstyr'
          : undefined,
      meetingNote: 'Adresse deles når tilbud er godtatt',
      durationText: form.duration.trim() || undefined,
      scheduledText: scheduledParts || undefined,
      isDugnad: form.isDugnad || undefined,
      recurrence: form.recurrence || undefined,
      intake: intake.length ? intake : undefined,
    },
  };
}

const DAY_INDEX: Record<string, number> = {
  Søn: 0, Man: 1, Tir: 2, Ons: 3, Tor: 4, Fre: 5, Lør: 6,
};

export function buildOfferListing(form: OfferForm): Listing {
  const availability = [
    form.days.length ? form.days.join(', ') : null,
    timeLabel(form.timeFrom, form.timeTo),
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    id: newId(),
    type: 'SERVICE_OFFER' as ListingType,
    title: form.title.trim(),
    category: catBySlug(form.categorySlug),
    priceMode: form.priceMode === 'FROM' ? 'FROM' : 'BY_AGREEMENT',
    price: form.priceMode === 'FROM' ? priceFrom('FROM', form.amountKr) : undefined,
    location: {
      municipality: form.place.trim(),
      place: form.place.trim(),
      distanceKm: 0,
    },
    images: toImages(form.images),
    owner: placeholderOwner,
    createdAt: new Date().toISOString(),
    status: 'ACTIVE',
    offer: {
      about: form.about.trim(),
      services: form.services,
      experienceYears: /(\d+)/.exec(form.experience)?.[1]
        ? Number(/(\d+)/.exec(form.experience)![1])
        : undefined,
      availabilityText: availability || undefined,
      availableWeekdays: form.days.map((d) => DAY_INDEX[d]).filter((n) => n !== undefined),
      instantBook: form.instantBook || undefined,
      equipmentText: form.ownTransport ? 'Har egen transport' : undefined,
      maxDistanceKm: form.maxDistanceKm,
    },
  };
}
