import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ListingExtras } from '@/api/ApiClient';
import type { Listing, PublicProfile } from '@/domain/types';
import { nok, groupThousands } from '@/domain/price';
import { categoryArtId, categoryBySlug, slugForArtId, categoryLabel } from '@/domain/categories';
import { type CategoryId } from '@/theme/theme';
import { EQUIPMENT, FORMS, TIMES_OF_DAY, type EquipKey, type IntakeField } from './wizardConfig';

export type WhenMode = 'fast' | 'flex' | 'innen';
export type PriceMode = 'budget' | 'offer';
export type Who = 'alle' | 'verif';
/** One answer to a category question: choice(s), a number or free text. */
export type Answer = string | string[] | number;

/** Everything the 9-step wizard collects. Serialisable (saved as a draft). */
export type WizardState = {
  cat: CategoryId | null;
  title: string;
  desc: string;
  /** answers to the category's questions (wizardConfig FORMS), by field key */
  answers: Record<string, Answer>;
  /** how many helpers are needed */
  helpers: number;
  /** "Haster" – shown as a tag on the oppdrag */
  urgent: boolean;
  /** Editing an older oppdrag: its free-text time, kept until new days are picked. */
  keepWhen?: string;
  photos: string[];
  kommune: string;
  area: string;
  whenMode: WhenMode;
  /** ISO dates (yyyy-mm-dd) */
  days: string[];
  tod: string[];
  hours: number;
  /** the oppdrag repeats (undefined = one time) */
  repeat?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
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
  answers: defaultAnswers('annet'),
  helpers: 1,
  urgent: false,
  photos: [],
  kommune,
  area: '',
  whenMode: 'flex',
  days: [],
  tod: [],
  hours: 2,
  priceMode: 'offer',
  amount: '',
  eq: { utstyr: false, materialer: false, parkering: false, dyr: false, hjemme: false, nokkel: false, strom: false, avfall: false, trapp: false },
  practical: '',
  who: 'alle',
  km: 10,
});

/** Defaults for a category's questions (numbers + yes/no; choices start empty). */
export function defaultAnswers(cat: CategoryId): Record<string, Answer> {
  const out: Record<string, Answer> = {};
  for (const f of FORMS[cat].fields) {
    if (f.kind === 'number') out[f.key] = f.def;
    if (f.kind === 'yesno') out[f.key] = f.def ?? 'Ja';
  }
  return out;
}

/** Choosing a category resets its questions and picks sensible defaults. */
export function applyCategory(s: WizardState, cat: CategoryId): Partial<WizardState> {
  const f = FORMS[cat];
  return { cat, answers: defaultAnswers(cat), hours: f.hours, helpers: f.helpers };
}

/** Rough quantities (stepped in 5s, 10s …) read "ca. 300 m²"; counts read "2 etg.". */
export const isApprox = (f: IntakeField) => f.kind === 'number' && f.step > 1;

/** "Plen, Hekk" / "ca. 300 m²" / "Ja" – how an answer reads on the oppdrag. */
export function answerText(f: IntakeField, a: Answer | undefined): string | null {
  if (a == null || a === '' || (Array.isArray(a) && a.length === 0)) return null;
  if (f.kind === 'number') return `${isApprox(f) ? 'ca. ' : ''}${a} ${f.unit}`;
  if (Array.isArray(a)) return a.join(', ');
  return String(a);
}

/** Category answers + helpers + urgency → `task.intake` label/value pairs. */
export function intakeOf(s: WizardState): { label: string; value: string }[] {
  const cat = s.cat ?? 'annet';
  const rows = FORMS[cat].fields
    .map((f) => {
      const v = answerText(f, s.answers[f.key]);
      return v ? { label: f.label, value: v } : null;
    })
    .filter((x): x is { label: string; value: string } => !!x);
  if (s.helpers > 1) rows.push({ label: 'Antall hjelpere', value: `${s.helpers} personer` });
  if (s.urgent) rows.push({ label: 'Haster', value: 'Ja' });
  return rows;
}

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
  if (!sel.length) return s.keepWhen ?? '';
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

export type WizardError = { field: 'cat' | 'title' | 'desc' | 'area' | 'days' | 'amount' | `q:${string}`; message: string };

export function validateStep(step: number, s: WizardState): WizardError | null {
  if (step === 1 && !s.cat) return { field: 'cat', message: 'Velg en kategori for å gå videre.' };
  if (step === 2) {
    const l = s.title.trim().length;
    if (l === 0) return { field: 'title', message: 'Skriv en tittel for oppdraget.' };
    if (l < 5) return { field: 'title', message: 'Tittelen må ha minst 5 tegn.' };
  }
  if (step === 3 && s.desc.trim().length < 20) return { field: 'desc', message: 'Beskriv oppdraget med minst 20 tegn.' };
  if (step === 3) {
    const missing = FORMS[s.cat ?? 'annet'].fields.find(
      (f) => f.kind === 'choice' && f.required && answerText(f, s.answers[f.key]) == null,
    );
    if (missing) return { field: `q:${missing.key}`, message: `Svar på «${missing.label.replace(/\?$/, '')}».` };
  }
  if (step === 4 && !s.area.trim()) return { field: 'area', message: 'Skriv inn område eller bydel.' };
  if (step === 5 && s.days.length === 0 && !s.keepWhen) {
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
  const amt = Number(s.amount) || 0;
  const n = s.photos.length;
  const details = intakeOf(s).map((r) => `${r.label.replace(/\?$/, '')}: ${r.value}`).join(' · ');
  const desc = s.desc.length > 84 ? `${s.desc.slice(0, 82).trim()} …` : s.desc;
  const tod = TIMES_OF_DAY.filter((t) => s.tod.includes(t.label)).map((t) => t.label.toLowerCase());
  const eqOn = EQUIPMENT.filter((e) => s.eq[e.id]).map((e) => e.label);
  const oppdrag: SummaryRow[] = [
    { k: 'Kategori', v: s.cat ? categoryLabel(s.cat) : '', step: 1 },
    { k: 'Tittel', v: s.title.trim(), step: 2 },
    { k: 'Beskrivelse', v: desc, step: 3 },
    { k: 'Detaljer', v: details || 'Ingen detaljer', step: 3 },
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

/** Wizard → `Listing` for preview + createListing / updateListing. */
export function buildListing(s: WizardState, days: DayItem[]): Listing {
  const cat = s.cat ?? 'annet';
  const tod = TIMES_OF_DAY.filter((t) => s.tod.includes(t.label)).map((t) => t.label.toLowerCase());
  const eqOn = EQUIPMENT.filter((e) => FORMS[cat].equipment.includes(e.id) && s.eq[e.id]).map((e) => e.label);
  const amt = Number(s.amount) || 0;
  const intake = intakeOf(s);

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
      recurrence: s.repeat,
      intake,
    },
  };
}

/** Settings stored next to the listing ("Hvem kan gi tilbud", km, private estimate, the form itself). */
export function extrasFor(s: WizardState): ListingExtras {
  const amt = Number(s.amount) || 0;
  return {
    offerAudience: s.who === 'verif' ? 'VERIFIED' : 'ALL',
    maxDistanceKm: s.km,
    privateEstimateMinor: s.priceMode === 'offer' && amt > 0 ? amt * 100 : null,
    estimatedMinutes: s.hours * 60,
    wizard: s,
  };
}

/** A saved form is only trusted when it has the current shape. */
export function isWizardState(v: unknown): v is WizardState {
  return !!v && typeof v === 'object' && 'answers' in v && 'title' in v && 'eq' in v;
}

/**
 * Rebuild the form from a published oppdrag that has no saved form (older
 * oppdrag): category, text, place, price, photos, settings.
 */
export function wizardFromListing(l: Listing, privateEstimateMinor: number | null): WizardState {
  const cat = categoryArtId(l.category.slug);
  const base = { ...emptyWizard(l.location.municipality), ...applyCategory(emptyWizard(), cat) };
  const budget = l.priceMode === 'BUDGET' || l.priceMode === 'FIXED';
  const amountKr = budget ? (l.price?.amountMinor ?? 0) / 100 : (privateEstimateMinor ?? 0) / 100;
  // Read the category answers back from the detail rows ("Hva skal males?: Gjerde").
  const answers = { ...base.answers };
  let helpers = base.helpers;
  let urgent = false;
  for (const row of l.task?.intake ?? []) {
    if (row.label === 'Antall hjelpere') helpers = parseInt(row.value, 10) || helpers;
    if (row.label === 'Haster') urgent = row.value === 'Ja';
    const f = FORMS[cat].fields.find((x) => x.label === row.label);
    if (!f) continue;
    if (f.kind === 'number') {
      const n = parseInt(row.value.replace(/\D+/g, ' ').trim(), 10);
      if (n) answers[f.key] = Math.min(f.max, Math.max(f.min, n));
    } else if (f.kind === 'choice') {
      const picked = row.value.split(', ').filter((v) => f.options.includes(v));
      if (picked.length) answers[f.key] = f.multi ? picked : picked[0];
    } else {
      answers[f.key] = row.value;
    }
  }
  return {
    ...base,
    cat,
    answers,
    helpers,
    urgent,
    repeat: l.task?.recurrence,
    title: l.title,
    desc: l.task?.description ?? '',
    keepWhen: l.task?.scheduledText,
    kommune: l.location.municipality,
    area: l.location.place,
    photos: l.images.map((im) => im.url),
    priceMode: budget ? 'budget' : 'offer',
    amount: amountKr > 0 ? String(Math.round(amountKr)) : '',
    practical: l.task?.meetingNote ?? '',
    hours: l.estimatedMinutes ? Math.max(1, Math.round(l.estimatedMinutes / 60)) : base.hours,
    who: l.offerAudience === 'VERIFIED' ? 'verif' : 'alle',
    km: l.maxDistanceKm ?? base.km,
  };
}

// ---------------------------------------------------------------- draft

const DRAFT_KEY = 'minnabo.leggUt.draft.v3';

export const wizardDraft = {
  async load(): Promise<{ state: WizardState; step: number } | null> {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      const d = raw ? (JSON.parse(raw) as { state: unknown; step: number }) : null;
      return d && isWizardState(d.state) ? { state: { ...emptyWizard(), ...d.state }, step: d.step } : null;
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
