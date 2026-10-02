import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Listing, PublicProfile } from '@/domain/types';
import { nok, groupThousands } from '@/domain/price';
import { categoryBySlug, slugForArtId } from '@/domain/categories';
import { categoryLabels, type CategoryId } from '@/theme/theme';
import { EQUIPMENT, INTAKE, TIMES_OF_DAY, type EquipKey } from './wizardConfig';

export type WhenMode = 'fast' | 'flex' | 'innen';
export type PriceMode = 'budget' | 'offer';
export type Who = 'alle' | 'verif';

/** Everything the 9-step wizard collects. Serialisable (saved as a draft). */
export type WizardState = {
  cat: CategoryId | null;
  title: string;
  desc: string;
  q1: string | null;
  size: number;
  q3: 'Ja' | 'Nei';
  photos: string[];
  kommune: string;
  area: string;
  whenMode: WhenMode;
  /** ISO dates (yyyy-mm-dd) */
  days: string[];
  tod: string[];
  hours: number;
  priceMode: PriceMode;
  amount: string;
  eq: Record<EquipKey, boolean>;
  practical: string;
  who: Who;
  km: number;
};

export const emptyWizard = (kommune = ''): WizardState => ({
  cat: null,
  title: '',
  desc: '',
  q1: null,
  size: INTAKE.annet.def,
  q3: 'Ja',
  photos: [],
  kommune,
  area: '',
  whenMode: 'flex',
  days: [],
  tod: [],
  hours: 2,
  priceMode: 'offer',
  amount: '',
  eq: { utstyr: false, materialer: false, parkering: false, dyr: false },
  practical: '',
  who: 'alle',
  km: 10,
});

// ---------------------------------------------------------------- dates

const WD = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** ISO week number (Norwegian weeks start on Monday). */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

export type DayItem = { iso: string; wd: string; d: number; mo: string; nextWeek: boolean; weekTag?: string };

/** The next 12 days; next week's Monday carries a "UKE n" tag. */
export function upcomingDays(from: Date, count = 12): DayItem[] {
  const out: DayItem[] = [];
  const monday = new Date(from);
  monday.setDate(from.getDate() + ((8 - from.getDay()) % 7 || 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  for (let i = 0; i < count; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const iso = isoDay(d);
    out.push({
      iso,
      wd: WD[d.getDay()],
      d: d.getDate(),
      mo: MONTHS[d.getMonth()],
      nextWeek: d >= monday && d <= sunday,
      weekTag: iso === isoDay(monday) ? `UKE ${isoWeek(monday)}` : undefined,
    });
  }
  return out;
}

const dayLabel = (iso: string) => {
  const d = parseDay(iso);
  return `${WD[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
};

/** "Uke 41 · fleksibel", "Innen fre 9. okt", "Fleksibel · 3 dager, 5.–9. okt" … */
export function whenLabel(s: WizardState, days: DayItem[]): string {
  const sel = [...s.days].sort();
  if (!sel.length) return '';
  const a = sel[0];
  const b = sel[sel.length - 1];
  if (s.whenMode === 'fast') return dayLabel(a);
  if (s.whenMode === 'innen') return `Innen ${dayLabel(b).charAt(0).toLowerCase()}${dayLabel(b).slice(1)}`;
  const week = days.filter((d) => d.nextWeek).map((d) => d.iso);
  if (week.length === 7 && sel.length === 7 && sel.every((x) => week.includes(x))) {
    return `Uke ${isoWeek(parseDay(a))} · fleksibel`;
  }
  if (sel.length === 1) return `Fleksibel · ${dayLabel(a)}`;
  const da = parseDay(a);
  const db = parseDay(b);
  return `Fleksibel · ${sel.length} dager, ${da.getDate()}.–${db.getDate()}. ${MONTHS[db.getMonth()]}`;
}

export const hoursLabel = (h: number) => `ca. ${h} ${h === 1 ? 'time' : 'timer'}`;
export const fmtKr = (n: number) => `${groupThousands(n)} kr`;

// ---------------------------------------------------------------- validation

export type WizardError = { field: 'cat' | 'title' | 'desc' | 'area' | 'days' | 'amount'; message: string };

export function validateStep(step: number, s: WizardState): WizardError | null {
  if (step === 1 && !s.cat) return { field: 'cat', message: 'Velg en kategori for å gå videre.' };
  if (step === 2) {
    const l = s.title.trim().length;
    if (l === 0) return { field: 'title', message: 'Skriv en tittel for oppdraget.' };
    if (l < 5) return { field: 'title', message: 'Tittelen må ha minst 5 tegn.' };
  }
  if (step === 3 && s.desc.trim().length < 20) return { field: 'desc', message: 'Beskriv oppdraget med minst 20 tegn.' };
  if (step === 4 && !s.area.trim()) return { field: 'area', message: 'Skriv inn område eller bydel.' };
  if (step === 5 && s.days.length === 0) {
    return { field: 'days', message: s.whenMode === 'flex' ? 'Velg minst én dag som passer.' : 'Velg en dato.' };
  }
  if (step === 6 && s.priceMode === 'budget' && !(Number(s.amount) > 0)) {
    return { field: 'amount', message: 'Skriv inn et budsjett, eller velg «Ønsker tilbud».' };
  }
  return null;
}

// ---------------------------------------------------------------- summary + listing

/** "Nordre Ål, Lillehammer" – either part may be missing. */
export const placeLine = (s: WizardState) => [s.area.trim(), s.kommune].filter(Boolean).join(', ');

export type SummaryRow = { k: string; v: string; step: number };

export function summary(s: WizardState, days: DayItem[]) {
  const I = INTAKE[s.cat ?? 'annet'];
  const amt = Number(s.amount) || 0;
  const n = s.photos.length;
  const desc = s.desc.length > 84 ? `${s.desc.slice(0, 82).trim()} …` : s.desc;
  const tod = TIMES_OF_DAY.filter((t) => s.tod.includes(t.label)).map((t) => t.label.toLowerCase());
  const eqOn = EQUIPMENT.filter((e) => s.eq[e.id]).map((e) => e.label);
  const oppdrag: SummaryRow[] = [
    { k: 'Kategori', v: s.cat ? categoryLabels[s.cat] : '', step: 1 },
    { k: 'Tittel', v: s.title.trim(), step: 2 },
    { k: 'Beskrivelse', v: desc, step: 3 },
    { k: 'Detaljer', v: `${s.q1 ?? 'Ikke valgt'} · ca. ${s.size} ${I.unit} · ${I.q3.replace('?', '')}: ${s.q3}`, step: 3 },
    { k: 'Bilder', v: n === 0 ? 'Ingen bilder' : `${n} ${n === 1 ? 'bilde' : 'bilder'}`, step: 3 },
  ];
  const stedTid: SummaryRow[] = [
    { k: 'Sted', v: `${placeLine(s)} (omtrentlig)`, step: 4 },
    { k: 'Når', v: whenLabel(s, days) + (tod.length ? ` · ${tod.join(', ')}` : ''), step: 5 },
    { k: 'Varighet', v: hoursLabel(s.hours), step: 5 },
  ];
  const prisPraktisk: SummaryRow[] = [
    {
      k: 'Pris',
      v:
        s.priceMode === 'budget'
          ? `Budsjett ${fmtKr(amt)}`
          : `Ønsker tilbud${amt ? ` · ditt anslag ${fmtKr(amt)} (vises ikke)` : ''}`,
      step: 6,
    },
    { k: 'Praktisk', v: eqOn.length ? eqOn.join(', ') : 'Ingenting valgt', step: 7 },
  ];
  const synlighet: SummaryRow[] = [
    { k: 'Hvem kan gi tilbud', v: s.who === 'alle' ? 'Alle naboer' : 'Kun verifiserte', step: 8 },
    { k: 'Maks avstand', v: `Innen ${s.km} km`, step: 8 },
  ];
  return { oppdrag, stedTid, prisPraktisk, synlighet };
}

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

/**
 * Wizard → `Listing` for preview + createListing.
 * Not persisted yet (no columns for oppdrag): "Hvem kan gi tilbud", "Maks
 * avstand" and the private price estimate when "Ønsker tilbud" is chosen.
 */
export function buildListing(s: WizardState, days: DayItem[]): Listing {
  const cat = s.cat ?? 'annet';
  const I = INTAKE[cat];
  const tod = TIMES_OF_DAY.filter((t) => s.tod.includes(t.label)).map((t) => t.label.toLowerCase());
  const eqOn = EQUIPMENT.filter((e) => s.eq[e.id]).map((e) => e.label);
  const amt = Number(s.amount) || 0;
  const intake = [
    s.q1 ? { label: I.q1, value: s.q1 } : null,
    { label: I.sz, value: `ca. ${s.size} ${I.unit}` },
    { label: I.q3, value: s.q3 },
  ].filter((x): x is { label: string; value: string } => !!x);

  return {
    id: `l-user-${Date.now()}`,
    type: 'TASK_REQUEST',
    title: s.title.trim(),
    category: categoryBySlug(slugForArtId(cat)),
    priceMode: s.priceMode === 'budget' ? 'BUDGET' : 'BY_AGREEMENT',
    price: s.priceMode === 'budget' && amt > 0 ? nok(amt) : undefined,
    // No distance on your own listing (it would read "0 km").
    location: { municipality: s.kommune, place: s.area.trim() || s.kommune },
    images: s.photos.map((url, i) => ({ id: `ui-${i}-${Date.now()}`, url })),
    owner: placeholderOwner,
    createdAt: new Date().toISOString(),
    status: 'PUBLISHED',
    task: {
      description: s.desc.trim(),
      equipment: eqOn.length ? eqOn.join(', ') : undefined,
      meetingNote: s.practical.trim() || undefined,
      durationText: hoursLabel(s.hours),
      scheduledText: [whenLabel(s, days), tod.join(', ')].filter(Boolean).join(' · ') || undefined,
      intake,
    },
  };
}

// ---------------------------------------------------------------- draft

const DRAFT_KEY = 'minnabo.leggUt.draft.v2';

export const wizardDraft = {
  async load(): Promise<{ state: WizardState; step: number } | null> {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  async save(state: WizardState, step: number) {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ state, step }));
  },
  async clear() {
    await AsyncStorage.removeItem(DRAFT_KEY).catch(() => undefined);
  },
};
