import type { Donation, Partner } from '@/domain/types';

/** Test fixtures for Fellesskap — the app reads these from Supabase. */
export const partners: Partner[] = [
  { id: 'p-main-1', name: 'Innlandet Sparebank', tagline: 'Støtter lokalt initiativ', url: null, logoUrl: null, municipality: 'Hamar', featured: true },
  { id: 'p-main-2', name: 'Fjellbygg AS', tagline: 'Bygg og vedlikehold i hele Innlandet', url: null, logoUrl: null, municipality: 'Lillehammer', featured: true },
  { id: 'p-local-1', name: 'Mjøsa Elektro', tagline: 'Autorisert elektriker', url: null, logoUrl: null, municipality: 'Gjøvik', featured: false },
  { id: 'p-local-2', name: 'Gudbrandsdal Hage', tagline: 'Planteskole og hagehjelp', url: null, logoUrl: null, municipality: 'Sel', featured: false },
  { id: 'p-local-3', name: 'Toten Transport', tagline: 'Frakt og flytting', url: null, logoUrl: null, municipality: 'Vestre Toten', featured: false },
  { id: 'p-local-4', name: 'Hedmark Rør', tagline: 'Rørlegger med lang erfaring', url: null, logoUrl: null, municipality: 'Elverum', featured: false },
];

export const documentedDonations: Donation[] = [
  { id: 'd1', period: '2026 Q1', amountKr: 18500, recipient: 'Norges Røde Kors', transferredAt: '2026-04-02T10:00:00Z' },
  { id: 'd2', period: '2025 Q4', amountKr: 14200, recipient: 'Norges Røde Kors', transferredAt: '2026-01-05T10:00:00Z' },
];
