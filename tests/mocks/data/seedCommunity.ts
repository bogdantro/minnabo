export type Partner = {
  id: string;
  name: string;
  tagline: string;
  tier: 'MAIN' | 'LOCAL';
  town: string;
  municipality: string;
};

/** Sponsor deals and payment are handled outside the app (spec §17, §21). */
export const partners: Partner[] = [
  { id: 'p-main-1', name: 'Innlandet Sparebank', tagline: 'Støtter lokalt initiativ', tier: 'MAIN', town: 'Hamar', municipality: 'Hamar' },
  { id: 'p-main-2', name: 'Fjellbygg AS', tagline: 'Bygg og vedlikehold i hele Innlandet', tier: 'MAIN', town: 'Lillehammer', municipality: 'Lillehammer' },
  { id: 'p-local-1', name: 'Mjøsa Elektro', tagline: 'Autorisert elektriker', tier: 'LOCAL', town: 'Gjøvik', municipality: 'Gjøvik' },
  { id: 'p-local-2', name: 'Gudbrandsdal Hage', tagline: 'Planteskole og hagehjelp', tier: 'LOCAL', town: 'Otta', municipality: 'Sel' },
  { id: 'p-local-3', name: 'Toten Transport', tagline: 'Frakt og flytting', tier: 'LOCAL', town: 'Raufoss', municipality: 'Vestre Toten' },
  { id: 'p-local-4', name: 'Hedmark Rør', tagline: 'Rørlegger med lang erfaring', tier: 'LOCAL', town: 'Elverum', municipality: 'Elverum' },
];

export const documentedDonations = [
  { id: 'd1', period: '2026 Q1', amountKr: 18500, recipient: 'Norges Røde Kors', transferred: true },
  { id: 'd2', period: '2025 Q4', amountKr: 14200, recipient: 'Norges Røde Kors', transferred: true },
];
