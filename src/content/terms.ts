/**
 * Vilkår for bruk (design/screens/Vilkar.dc.html).
 * The texts are the design's working copy – the final legal wording comes from a
 * lawyer (docs/LEFT_OUT.md). Fill in the values below; a sentence whose value is
 * empty is left out instead of showing a placeholder.
 */
export const TERMS = {
  version: '1.0',
  /** ISO date the version applies from */
  validFrom: '2026-10-01',
  readMinutes: 6,
  /** youngest age that can create an account (Vipps requires 15) */
  minAge: 15,
  /** days of notice before bigger changes */
  noticeDays: 30,
  /** contact address for questions – empty hides the sentence */
  contactEmail: '',
  /** the company that owns and runs MinNabo (Enhetsregisteret) */
  owner: { name: 'Webiser AS', orgNr: '933 452 107' },
} as const;

export const TERMS_SUMMARY = [
  'Du logger inn med Vipps, så vi vet at du er deg.',
  'Avtaler inngås mellom dere, ikke med MinNabo.',
  'MinNabo håndterer ikke betaling.',
  'Vær ærlig, vær grei, og si fra hvis noe er galt.',
];

export type TermsSection = { title: string; short: string; body: string[]; link?: { label: string; route: string } };

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: 'Om MinNabo',
    short: 'MinNabo kobler naboer som trenger hjelp med naboer som kan hjelpe. Vi er møteplassen – ikke arbeidsgiver.',
    body: [
      'MinNabo er en tjeneste for småjobber i nærmiljøet. Du kan legge ut et oppdrag når du trenger hjelp, og gi tilbud på oppdrag når du kan hjelpe andre. Tjenesten er foreløpig tilgjengelig i Innlandet.',
      `MinNabo eies og drives av ${TERMS.owner.name}, org.nr. ${TERMS.owner.orgNr}.`,
      'MinNabo er ikke part i avtalene mellom brukerne, og er ikke arbeidsgiver eller oppdragsgiver for noen som utfører jobber gjennom tjenesten.',
    ],
  },
  {
    title: 'Konto og innlogging med Vipps',
    short: 'Én person, én konto. Du logger inn med Vipps, og navnet ditt hentes derfra.',
    body: [
      'For å bruke MinNabo må du logge inn med Vipps. Vi bruker Vipps kun til å bekrefte hvem du er – aldri til betaling. Navnet på profilen din hentes fra Vipps og kan ikke endres fritt.',
      `Du er ansvarlig for det som skjer på kontoen din. Du må være minst ${TERMS.minAge} år for å opprette konto.`,
    ],
  },
  {
    title: 'Oppføringer',
    short: 'Beskriv jobben ærlig. Andre ser bare omtrentlig område, aldri adressen din.',
    body: [
      'Oppføringer er oppdrag – en jobb du trenger hjelp til. Oppføringen skal beskrive en reell jobb, med riktig kategori og omtrentlig sted.',
      'Det er ikke lov å legge ut ulovlige tjenester, reklame, diskriminerende innhold eller oppføringer som ber om betaling på forhånd. Vi kan skjule eller fjerne oppføringer som bryter reglene.',
    ],
  },
  {
    title: 'Tilbud og avtaler',
    short: 'Når et tilbud godtas, blir det en avtale mellom dere to. Endringer gjør dere i chatten.',
    body: [
      'Et tilbud inneholder pris, tidspunkt og eventuelle forbehold. Når tilbudet godtas, lagrer MinNabo en oversikt over avtalen med tidspunkt, slik at dere begge har det samme utgangspunktet.',
      'Avtalen er mellom dere som brukere. Må en avtale endres eller avlyses, gi beskjed så tidlig som mulig i chatten.',
    ],
  },
  {
    title: 'Betaling',
    short: 'MinNabo håndterer ikke betaling. Pris og betaling avtales direkte mellom dere.',
    body: [
      'Vi tar ikke imot, holder eller formidler penger. Hvordan og når det betales, avtaler dere selv. Vær forsiktig med å betale på forhånd til noen du ikke kjenner.',
      'Hver bruker er selv ansvarlig for eventuelle plikter knyttet til skatt og rapportering av inntekt.',
    ],
  },
  {
    title: 'Vurderinger',
    short: 'Etter en fullført jobb kan dere vurdere hverandre. Vurderinger skal være ærlige og handle om jobben.',
    body: [
      'En vurdering består av 1–5 stjerner, korte stikkord som «Punktlig» eller «Grundig», og en valgfri kommentar. Bare de som har hatt en avtale sammen, kan vurdere hverandre.',
      'Det er ikke lov å kjøpe, bytte eller presse fram vurderinger. Vi kan fjerne vurderinger som er usanne, krenkende eller ikke handler om jobben.',
    ],
  },
  {
    title: 'Trygghet og rapportering',
    short: 'Si fra hvis noe virker galt. Vi ser på alle rapporter. Ved fare – ring 112.',
    body: [
      'Du kan rapportere brukere, oppføringer, meldinger og oppslag. Rapporter behandles av MinNabos moderatorer, og vi kan advare, skjule innhold eller stenge kontoer.',
      'Du kan legge til trygge kontakter som får beskjed når du skal på en jobb. Er noen i akutt fare, kontakt nødetatene direkte.',
    ],
  },
  {
    title: 'Personvern',
    short: 'Vi bruker opplysningene dine bare for at tjenesten skal virke. Du kan laste ned eller slette dem.',
    body: ['Hvordan vi behandler personopplysninger, står i personvernerklæringen. Der kan du også laste ned dataene dine og endre samtykker.'],
    link: { label: 'Les personvernerklæringen', route: '/personvern' },
  },
  {
    title: 'Endringer',
    short: 'Hvis vilkårene endres, sier vi fra i appen før endringene gjelder.',
    body: [
      `Vi kan oppdatere vilkårene når tjenesten endres eller regelverket krever det. Større endringer varsles i appen minst ${TERMS.noticeDays} dager før de trer i kraft, med nytt versjonsnummer og dato.`,
      ...(TERMS.contactEmail ? [`Spørsmål om vilkårene? Kontakt oss på ${TERMS.contactEmail}.`] : []),
    ],
  },
];

/** Plain-text version for "Del" (share sheet). */
export function termsAsText(): string {
  const head = `MinNabo – Vilkår for bruk\nVersjon ${TERMS.version}\n\n`;
  return (
    head +
    TERMS_SECTIONS.map((s, i) => `${i + 1}. ${s.title}\n\nKort fortalt: ${s.short}\n\n${s.body.join('\n\n')}`).join('\n\n')
  );
}
