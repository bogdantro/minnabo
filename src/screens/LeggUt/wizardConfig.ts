import type { CategoryId } from '@/theme/theme';
import type { IconKey } from '@/components/ui/Icon';

/** Per-category quick questions on step 3 (LeggUt.dc.html › INTAKE). */
export type Intake = {
  q1: string;
  o1: string[];
  sz: string;
  unit: string;
  inc: number;
  def: number;
  q3: string;
};

export const INTAKE: Record<CategoryId, Intake> = {
  maling: { q1: 'Hva skal males?', o1: ['Gjerde', 'Terrasse', 'Vegg', 'Annet'], sz: 'Omtrentlig størrelse', unit: 'm²', inc: 5, def: 30, q3: 'Har du maling/beis?' },
  hage: { q1: 'Hva gjelder det?', o1: ['Plen', 'Hekk', 'Løv', 'Annet'], sz: 'Omtrentlig størrelse', unit: 'm²', inc: 25, def: 300, q3: 'Finnes det utstyr?' },
  rengjoring: { q1: 'Hva skal vaskes?', o1: ['Leilighet', 'Hus', 'Hytte', 'Vinduer'], sz: 'Omtrentlig størrelse', unit: 'm²', inc: 10, def: 70, q3: 'Har du vaskemidler?' },
  flytting: { q1: 'Hva skal bæres?', o1: ['Møbler', 'Esker', 'Hvitevarer', 'Annet'], sz: 'Antall etasjer', unit: 'etg.', inc: 1, def: 2, q3: 'Er det heis?' },
  transport: { q1: 'Hva skal fraktes?', o1: ['Møbler', 'Avfall', 'Varer', 'Annet'], sz: 'Omtrentlig avstand', unit: 'km', inc: 5, def: 10, q3: 'Trengs det bærehjelp?' },
  montering: { q1: 'Hva skal monteres?', o1: ['Møbler', 'Hyller', 'Lamper', 'Annet'], sz: 'Antall ting', unit: 'stk', inc: 1, def: 1, q3: 'Har du verktøy?' },
  snomaking: { q1: 'Hva skal måkes?', o1: ['Oppkjørsel', 'Tak', 'Trapp', 'Annet'], sz: 'Omtrentlig størrelse', unit: 'm²', inc: 10, def: 60, q3: 'Finnes det snøfres?' },
  dyrepass: { q1: 'Hvilket dyr?', o1: ['Hund', 'Katt', 'Kanin', 'Annet'], sz: 'Antall dager', unit: 'dager', inc: 1, def: 2, q3: 'Trengs det lufting?' },
  data: { q1: 'Hva gjelder det?', o1: ['Mobil', 'PC', 'Nettbrett', 'Annet'], sz: 'Antall enheter', unit: 'stk', inc: 1, def: 1, q3: 'Kan det gjøres hjemme hos deg?' },
  arrangement: { q1: 'Hva slags arrangement?', o1: ['Bursdag', 'Bryllup', 'Dugnad', 'Annet'], sz: 'Antall gjester', unit: 'pers.', inc: 10, def: 30, q3: 'Trengs det rigging?' },
  annet: { q1: 'Hva slags oppdrag?', o1: ['Innendørs', 'Utendørs', 'Begge', 'Annet'], sz: 'Personer som trengs', unit: 'pers.', inc: 1, def: 1, q3: 'Trengs det eget utstyr?' },
};

/** Title suggestions on step 2. */
export const TITLE_SUGGESTIONS: Record<CategoryId, string[]> = {
  maling: ['Male gjerdet i hagen', 'Beise terrassen', 'Male en vegg'],
  hage: ['Klippe plen og rake løv', 'Klippe hekken', 'Luke bedene'],
  rengjoring: ['Flyttevask av leilighet', 'Vaske vinduer', 'Vårrengjøring av hytta'],
  flytting: ['Bære sofa til 3. etasje', 'Hjelp med flyttelasset', 'Bære kjøleskap'],
  transport: ['Kjøre til gjenvinningsstasjonen', 'Hente en kommode', 'Frakte sykler til hytta'],
  montering: ['Montere garderobeskap', 'Henge opp hyller', 'Montere seng'],
  snomaking: ['Måke oppkjørselen', 'Måke taket', 'Strø trappa'],
  dyrepass: ['Lufte hunden på dagtid', 'Passe katten i helga', 'Mate kaninen i ferien'],
  data: ['Sette opp ny mobil', 'Hjelp med skriver og wifi', 'Flytte bilder til ny PC'],
  arrangement: ['Hjelp til bursdagsselskap', 'Rigge til fest', 'Servering på konfirmasjon'],
  annet: ['Barnevakt fredagskveld', 'Hjelp med handling', 'Vanne planter i ferien'],
};

export const STEP_NAMES = [
  'Kategori',
  'Tittel',
  'Beskrivelse',
  'Sted',
  'Når',
  'Pris',
  'Utstyr og praktisk',
  'Hvem kan gi tilbud',
  'Bekreft',
] as const;

export const TIMES_OF_DAY: { label: string; sub: string; icon: IconKey }[] = [
  { label: 'Morgen', sub: 'Før kl. 10', icon: 'sun' },
  { label: 'Formiddag', sub: 'kl. 10–13', icon: 'sun' },
  { label: 'Ettermiddag', sub: 'kl. 13–17', icon: 'clock' },
  { label: 'Kveld', sub: 'Etter kl. 17', icon: 'moon' },
];

export type EquipKey = 'utstyr' | 'materialer' | 'parkering' | 'dyr';
export const EQUIPMENT: { id: EquipKey; label: string; sub: string; icon: IconKey }[] = [
  { id: 'utstyr', label: 'Utstyr finnes', sub: 'Stige, pensler og det som trengs', icon: 'montering' },
  { id: 'materialer', label: 'Materialer kjøpes av meg', sub: 'Hjelperen trenger ikke kjøpe inn', icon: 'tag' },
  { id: 'parkering', label: 'Parkering tilgjengelig', sub: 'Plass til bil ved huset', icon: 'transport' },
  { id: 'dyr', label: 'Dyr i huset', sub: 'Nyttig å vite ved allergi', icon: 'dyrepass' },
];

export const QUICK_AMOUNTS = [500, 1000, 1500, 2000, 3000];
