import type {
  Category,
  Listing,
  PublicProfile,
  Verification,
} from '@/domain/types';
import { nok } from '@/domain/price';
import { CATEGORIES } from '@/domain/categories';

const phoneVerified = (): Verification => ({
  kind: 'PHONE',
  verified: true,
  explanation: 'Telefonnummeret er bekreftet med engangskode.',
});

const businessVerified = (): Verification => ({
  kind: 'BUSINESS',
  verified: true,
  explanation: 'Organisasjonsnummer og kontaktperson er kontrollert.',
});

export const categories: Category[] = CATEGORIES;

const bySlug = (slug: string): Category =>
  categories.find((c) => c.slug === slug) ?? categories[categories.length - 1];

/** The 5 chips on the Oppdrag front page (homepage.png). */
export const homeCategories: Category[] = [
  { id: 'c-alle', slug: 'alle', label: 'Alle', icon: 'grid' },
  bySlug('hage'),
  { id: 'c-renhold-home', slug: 'renhold', label: 'Renhold', icon: 'droplet' },
  { id: 'c-transport-home', slug: 'transport', label: 'Transport', icon: 'truck' },
  bySlug('montering'),
];

const lillehammer = { municipality: 'Lillehammer', place: 'Lillehammer' };

export const profiles: Record<string, PublicProfile> = {
  mb: {
    id: 'u-mb',
    displayName: 'Marius B.',
    initials: 'MB',
    role: 'admin',
    onboardedAt: '2026-01-15T09:00:00Z',
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=60',
    memberSince: '2026',
    location: lillehammer,
    verifications: [
      phoneVerified(),
      { kind: 'EMAIL', verified: true, explanation: 'E-postadressen er bekreftet.' },
    ],
    isBusiness: false,
    rating: { average: 4.8, count: 6 },
    presentation:
      'Bor på Lillehammer og hjelper gjerne til med hagearbeid og enkel montering. Punktlig og ryddig.',
    services: ['Hagearbeid', 'Montering', 'Bæring'],
    categorySlugs: ['hage', 'montering', 'flytting'],
    completedTasks: 6,
  },
  jonas: {
    id: 'u-jonas',
    displayName: 'Jonas Berg',
    initials: 'JB',
    avatarUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=60',
    memberSince: '2025',
    location: lillehammer,
    verifications: [phoneVerified()],
    isBusiness: false,
    rating: { average: 4.9, count: 18 },
  },
  andreas: {
    id: 'u-andreas',
    displayName: 'Andreas',
    initials: 'A',
    avatarUrl:
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=60',
    memberSince: '2026',
    location: lillehammer,
    verifications: [phoneVerified()],
    isBusiness: false,
    rating: { average: 4.9, count: 12 },
    portfolio: [
      'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=400&q=60',
      'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=400&q=60',
    ],
  },
  emma: {
    id: 'u-emma',
    displayName: 'Emma Larsen',
    initials: 'EL',
    avatarUrl:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=60',
    memberSince: '2026',
    location: lillehammer,
    verifications: [phoneVerified()],
    isBusiness: false,
    rating: { average: 4.7, count: 9 },
  },
  martin: {
    id: 'u-martin',
    displayName: 'Martin Solberg',
    initials: 'MS',
    avatarUrl:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=60',
    memberSince: '2025',
    location: { municipality: 'Gjøvik', place: 'Gjøvik' },
    verifications: [phoneVerified()],
    isBusiness: false,
    rating: { average: 4.6, count: 4 },
    homeNotes: 'Enebolig med hage. Parkering i innkjørselen. Vi har en snill hund som er ute i hagen.',
  },
  fjellbygg: {
    id: 'u-fjellbygg',
    displayName: 'Fjellbygg AS',
    initials: 'FA',
    memberSince: '2024',
    location: lillehammer,
    verifications: [businessVerified(), phoneVerified()],
    isBusiness: true,
    rating: { average: 4.8, count: 27 },
  },
};

/** Profiles shown as "active now" on the tilbydere page. */
export const activeProfiles: PublicProfile[] = [
  profiles.andreas,
  profiles.emma,
  profiles.martin,
  profiles.fjellbygg,
];

const img = (id: string, url: string) => ({ id, url });

const mower =
  'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?auto=format&fit=crop&w=1000&q=60';
const boxes =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=60';
const gardener =
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1000&q=60';
const cleaning =
  'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1000&q=60';
const wardrobe =
  'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=1000&q=60';
const handyman =
  'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1000&q=60';

export const listings: Listing[] = [
  {
    id: 'l-klippe-plen',
    type: 'TASK_REQUEST',
    title: 'Klippe plen',
    category: bySlug('hage'),
    price: nok(600),
    priceMode: 'FIXED',
    location: { ...lillehammer, distanceKm: 1.2 },
    images: [
      img('i1', mower),
      img('i2', gardener),
      img('i3', cleaning),
    ],
    owner: profiles.jonas,
    createdAt: '2026-08-26T09:00:00Z',
    status: 'PUBLISHED',
    task: {
      description:
        'Jeg trenger hjelp til å klippe plenen foran og bak huset. Plenen er omtrent 250 m². Gressklipper kan lånes hvis du ikke har egen.',
      equipment: 'Kan lånes',
      meetingNote: 'Adresse deles når tilbud er godtatt',
      durationText: 'Omtrent 1–2 timer',
      scheduledText: 'I morgen kl. 17:00',
    },
  },
  {
    id: 'l-flytting',
    type: 'TASK_REQUEST',
    title: 'Hjelp med flytting',
    category: bySlug('transport'),
    price: nok(1500),
    priceMode: 'FIXED',
    location: { ...lillehammer, distanceKm: 2.8 },
    images: [img('i4', boxes)],
    owner: profiles.martin,
    createdAt: '2026-08-25T14:30:00Z',
    status: 'PUBLISHED',
    task: {
      description:
        'Trenger to personer som kan hjelpe med å bære møbler og flyttekasser fra leilighet i andre etasje til flyttebil. Beregn cirka tre timer.',
      equipment: 'Jeg har trillebår og bæreseler',
      meetingNote: 'Adresse deles når tilbud er godtatt',
      durationText: 'Omtrent 3 timer',
      scheduledText: 'Lørdag kl. 10:00',
    },
  },
  {
    id: 'l-vaskehjelp',
    type: 'TASK_REQUEST',
    title: 'Vaskehjelp før visning',
    category: bySlug('renhold'),
    priceMode: 'BUDGET',
    price: nok(900),
    location: { ...lillehammer, distanceKm: 3.4 },
    images: [img('i5', cleaning)],
    owner: profiles.emma,
    createdAt: '2026-08-24T08:15:00Z',
    status: 'PUBLISHED',
    task: {
      description:
        'Ønsker grundig vask av en leilighet på 58 m² før visning. Kjøkken, bad, vinduer og gulv. Vaskemidler finnes i leiligheten.',
      equipment: 'Utstyr og vaskemidler finnes',
      meetingNote: 'Adresse deles når tilbud er godtatt',
      durationText: 'Omtrent 3–4 timer',
      scheduledText: 'Torsdag formiddag',
    },
  },
  {
    id: 'l-montere-garderobe',
    type: 'TASK_REQUEST',
    title: 'Montere garderobeskap',
    category: bySlug('montering'),
    priceMode: 'FROM',
    price: nok(700),
    location: { ...lillehammer, distanceKm: 0.9 },
    images: [img('i6', wardrobe)],
    owner: profiles.emma,
    createdAt: '2026-08-23T17:45:00Z',
    status: 'PUBLISHED',
    task: {
      description:
        'To garderobeskap fra IKEA (PAX) skal monteres. Deler og beslag er pakket ut. Trenger noen med erfaring og eget verktøy.',
      equipment: 'Ta med eget verktøy',
      meetingNote: 'Adresse deles når tilbud er godtatt',
      durationText: 'Omtrent 2 timer',
      scheduledText: 'Denne uka',
    },
  },
  {
    id: 'l-male-gjerdet',
    type: 'TASK_REQUEST',
    title: 'Male gjerdet',
    category: bySlug('maling'),
    price: nok(2500),
    priceMode: 'BUDGET',
    location: { ...lillehammer, distanceKm: 0 },
    images: [img('i10', gardener)],
    owner: profiles.mb,
    createdAt: '2026-08-20T08:00:00Z',
    status: 'RECEIVING_OFFERS',
    task: {
      description:
        'Gjerdet rundt hagen skal males. Omtrent 25 meter, hvit maling. Maling og pensler kan lånes.',
      equipment: 'Kan lånes',
      meetingNote: 'Adresse deles når tilbud er godtatt',
      durationText: 'Omtrent en dag',
      scheduledText: 'Førstkommende helg',
    },
  },
  {
    id: 'l-tilbyr-gressklipping',
    type: 'SERVICE_OFFER',
    title: 'Jeg kan klippe plenen din',
    category: bySlug('hage'),
    priceMode: 'FROM',
    price: nok(500),
    location: { ...lillehammer, distanceKm: 1.6 },
    images: [img('i7', handyman)],
    owner: profiles.andreas,
    createdAt: '2026-08-26T07:00:00Z',
    status: 'ACTIVE',
    offer: {
      about:
        'Jeg tilbyr gressklipping for små og mellomstore hager. Jeg har egen gressklipper og kan også ta med kantklipper. Send meg en melding med bilde eller størrelse på plenen, så avtaler vi pris og tidspunkt.',
      experienceYears: 2,
      completedJobs: 9,
      services: ['Gressklipping', 'Kantklipping', 'Enkelt hagearbeid'],
      availabilityText: 'Ledig ettermiddager og helger',
      equipmentText: 'Har egen gressklipper',
      maxDistanceKm: 15,
    },
  },
  {
    id: 'l-tilbyr-rengjoring',
    type: 'SERVICE_OFFER',
    title: 'Fast eller enkeltvis rengjøring',
    category: bySlug('renhold'),
    priceMode: 'BY_AGREEMENT',
    location: { ...lillehammer, distanceKm: 4.1 },
    images: [img('i8', cleaning)],
    owner: profiles.emma,
    createdAt: '2026-08-22T11:20:00Z',
    status: 'ACTIVE',
    offer: {
      about:
        'Jeg hjelper med rengjøring i hjemmet, fast hver uke eller ved behov. Nøyaktig og pålitelig. Tar med eget utstyr ved behov.',
      experienceYears: 4,
      completedJobs: 21,
      services: ['Hjemmerengjøring', 'Vindusvask', 'Flyttevask'],
      availabilityText: 'Ledig på dagtid mandag–fredag',
      equipmentText: 'Kan ta med eget utstyr',
      maxDistanceKm: 20,
    },
  },
  {
    id: 'l-tilbyr-montering',
    type: 'SERVICE_OFFER',
    title: 'Montering og småreparasjoner',
    category: bySlug('montering'),
    priceMode: 'FROM',
    price: nok(450),
    location: { municipality: 'Gjøvik', place: 'Gjøvik', distanceKm: 6.0 },
    images: [img('i9', handyman)],
    owner: profiles.martin,
    createdAt: '2026-08-21T09:40:00Z',
    status: 'ACTIVE',
    offer: {
      about:
        'Erfaren hobbysnekker som hjelper med møbelmontering, oppheng, listverk og små reparasjoner i hjemmet.',
      experienceYears: 6,
      completedJobs: 34,
      services: ['Møbelmontering', 'Oppheng', 'Listverk', 'Små reparasjoner'],
      availabilityText: 'Ledig kvelder og helger',
      equipmentText: 'Har eget verktøy',
      maxDistanceKm: 25,
    },
  },
];
