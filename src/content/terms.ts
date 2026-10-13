/**
 * Vilkår for bruk. The text is the same, word for word, as https://minnaboapp.no/vilkar/ –
 * change both together. The final legal wording is checked by a lawyer (docs/LEFT_OUT.md).
 */
export const TERMS = {
  version: '1.0',
  /** ISO date of the last change to the text */
  updated: '2026-10-13',
  readMinutes: 8,
  /** youngest age that can create an account (Vipps requires 15) */
  minAge: 15,
  /** days of notice before bigger changes */
  noticeDays: 30,
  contactEmail: 'kontakt@webiser.no',
  /** the company that owns and runs MinNabo (Enhetsregisteret) */
  owner: { name: 'Webiser AS', orgNr: '933 452 107', address: 'Lyngstien 9, 2608 Lillehammer' },
} as const;

export const TERMS_SUMMARY = [
  'Du logger inn med Vipps. Vipps brukes aldri til betaling.',
  'Pris og betaling avtales direkte mellom dere. MinNabo håndterer ikke betaling.',
  'Under 18 år? Du får en ungdomskonto som bare kan gi tilbud.',
  'Vær ærlig og hyggelig. Brudd kan føre til utestengelse.',
];

/** A paragraph, a bullet list, a sub-heading or a link to a screen in the app. */
export type TermsBlock = string | { list: string[] } | { heading: string } | { link: { label: string; route: string } };

export type TermsSection = { title: string; blocks: TermsBlock[] };

const { owner } = TERMS;

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: 'Om tjenesten',
    blocks: [
      `MinNabo er en digital møteplass for småjobber i Innlandet. Privatpersoner kan legge ut oppdrag når de trenger hjelp, og andre kan gi tilbud på oppdragene. Tjenesten leveres av ${owner.name}, org.nr. ${owner.orgNr}, ${owner.address} («MinNabo», «vi»).`,
      'MinNabo formidler kontakt mellom brukere. Vi er ikke part i avtalene dere inngår, vi utfører ikke jobbene, og vi er ikke arbeidsgiver for de som tar oppdrag.',
      'Når du oppretter en konto, godtar du disse vilkårene og vår personvernerklæring.',
      { link: { label: 'Les personvernerklæringen', route: '/personvern' } },
    ],
  },
  {
    title: 'Konto og innlogging med Vipps',
    blocks: [
      'Alle som bruker MinNabo, logger inn med Vipps. Slik vet alle hvem de avtaler med.',
      {
        list: [
          'Ved innlogging får vi navn, telefonnummer, fødselsdato og e-postadresse fra Vipps for å bekrefte hvem du er og hvor gammel du er.',
          'Kontoen er personlig. Du kan bare ha én konto, og du kan ikke la andre bruke den.',
          'Du er selv ansvarlig for at det du skriver i profilen din, er riktig.',
          'Du kan når som helst slette kontoen i appen under Meny → Innstillinger → Slett konto.',
          'Vipps brukes bare til innlogging og identitet – aldri til betaling i MinNabo.',
        ],
      },
    ],
  },
  {
    title: 'Ungdomskonto under 18',
    blocks: [
      `Er du mellom ${TERMS.minAge} og 18 år, får du automatisk en ungdomskonto når du logger inn med Vipps.`,
      {
        list: [
          'En ungdomskonto kan bare gi tilbud på oppdrag. Den kan ikke legge ut egne oppdrag.',
          'Du trenger ikke samtykke fra foresatte for å opprette en ungdomskonto. Alderen bekreftes med Vipps.',
          'Vi anbefaler at du avtaler jobber i dagslys, gjerne hos folk du kjenner, og deler jobbdagen med en voksen med Trygg tur i appen.',
          'Når du fyller 18 år, blir kontoen automatisk gjort om til en vanlig konto.',
        ],
      },
    ],
  },
  {
    title: 'Oppdrag og tilbud',
    blocks: [
      'MinNabo har én type oppføring: oppdrag («Trenger hjelp»). Andre brukere kan gi tilbud med pris, tidspunkt og en kort melding.',
      {
        list: [
          'Beskriv oppdraget ærlig og konkret, med riktig kategori og et realistisk tidspunkt.',
          'Bare omtrentlig sted vises offentlig. Eksakt adresse deler du selv i chatten etter at dere har avtalt jobben.',
          'En avtale er inngått når oppdragsgiveren godtar et tilbud. Da ser dere begge avtalen i appen, og dere ser hverandres telefonnummer.',
          'Må du avlyse, gi beskjed så tidlig som mulig. Gjentatte avlysninger vises på profilen din og kan påvirke kontoen.',
        ],
      },
    ],
  },
  {
    title: 'Pris og betaling',
    blocks: [
      'Pris og betaling avtales direkte mellom dere. MinNabo håndterer ikke betaling mellom brukere.',
      {
        list: [
          'Det er gratis å bruke MinNabo som privatperson.',
          'Dere avtaler selv pris, betalingsmåte og tidspunkt for betaling. MinNabo tar ikke imot, holder eller overfører penger mellom brukere.',
          'Dere er selv ansvarlige for eventuelle plikter knyttet til skatt og rapportering.',
          'Vær varsom hvis noen ber om forskuddsbetaling. Si fra til oss med «Rapporter» i appen.',
        ],
      },
    ],
  },
  {
    title: 'Vurderinger',
    blocks: [
      {
        list: [
          'Bare brukere som har gjennomført en avtale sammen, kan vurdere hverandre.',
          'Vurderinger skal være ærlige, saklige og bygge på egen erfaring med jobben.',
          'Det er ikke lov å kjøpe, bytte eller presse frem vurderinger.',
          'Vi kan fjerne teksten i en vurdering som bryter vilkårene. Vi skriver aldri om det noen har skrevet.',
        ],
      },
    ],
  },
  {
    title: 'Forbudt innhold',
    blocks: [
      'Det er ikke tillatt å legge ut, sende eller be om:',
      {
        list: [
          'Ulovlige tjenester eller varer, eller arbeid som krever autorisasjon eller sertifisering når utføreren ikke har det.',
          'Trakassering, trusler, hatefulle ytringer eller diskriminering.',
          'Seksuelt innhold eller innhold som utnytter barn og unge.',
          'Svindel, villedende oppføringer og krav om forskuddsbetaling til ukjente.',
          'Personopplysninger om andre uten samtykke – for eksempel eksakte adresser i offentlige oppføringer.',
          'Reklame for virksomheter utenfor partnerordningen.',
        ],
      },
    ],
  },
  {
    title: 'Moderering og utestengelse',
    blocks: [
      {
        list: [
          'Alle kan rapportere oppdrag, meldinger og profiler. Rapporter behandles av MinNabos moderatorer, normalt innen 12 timer.',
          'Ved brudd på vilkårene kan vi skjule innhold, gi en advarsel, suspendere kontoen midlertidig eller stenge den permanent.',
          'Innhold som flere har rapportert, kan bli skjult automatisk, og en konto som flere har rapportert, kan bli suspendert automatisk, til en moderator har sett på saken.',
          'Ved alvorlige forhold kan vi kontakte politiet.',
          `Du får beskjed om hva vi har gjort og hvorfor, og du kan klage på avgjørelsen til ${TERMS.contactEmail}.`,
        ],
      },
    ],
  },
  {
    title: 'Partnere og synlighet',
    blocks: [
      'Lokale bedrifter kan bli partnere som Lokal støttespiller, Lokale helter eller Hovedpartner (maks fire i hele Innlandet) mot en månedlig avgift. Det er den eneste betalingen i MinNabo.',
      {
        list: [
          'Partnere betaler for synlighet i Fellesskap – aldri for plass i søket.',
          'Partnere vises i Fellesskap i appen og på nettsiden, og er alltid tydelig merket.',
          'Oppdrag og tilbud blir aldri rangert etter om noen er partner.',
          '20 % av partnerinntektene går til lokale lag og foreninger.',
        ],
      },
      { heading: 'Vilkår for partnere' },
      {
        list: [
          'Partnere må være registrert i Enhetsregisteret. Den som registrerer bedriften, må ha rett til å inngå avtaler på vegne av den.',
          'Prisen er 600 / 1 700 / 5 000 kr per måned eks. mva. for Lokal støttespiller, Lokale helter og Hovedpartner. Abonnementet fornyes månedlig og betales med kort eller faktura på e-post gjennom Stripe.',
          'MinNabo godkjenner bedriften og kortet før det blir synlig, normalt innen 1 virkedag. Endringer i logo, navn, tekst, lenke og kategori godkjennes på samme måte.',
          'Retningslinjer for partnere: logo, tekst og lenke skal gjelde bedriften selv, være saklige og følge vilkårene for forbudt innhold. Logo og tekst skal ikke inneholde priser eller rabatter.',
          'Lenke til nettsiden vises for Lokale helter og Hovedpartnere. Hovedpartnere har i tillegg en egen side i appen med telefon, e-post, adresse og åpningstider.',
          'Bytte av pakke, både opp og ned, må godkjennes av MinNabo. Ved oppgradering gjelder ny pris fra godkjenning, og mellomlegget for resten av perioden belastes med en gang.',
          'Hvis en betaling feiler eller en faktura ikke er betalt, er kortet fortsatt synlig i 7 dager. Deretter skjules det til betalingen er i orden.',
          'Abonnementet kan sies opp når som helst. Det gjelder ut perioden som er betalt, og kortet vises til da.',
        ],
      },
    ],
  },
  {
    title: 'Ansvar',
    blocks: [
      {
        list: [
          'Avtaler om jobber inngås mellom brukerne. MinNabo er ikke ansvarlig for utførelsen, eller for skader, tap eller mangler som oppstår.',
          'Brukerne er selv ansvarlige for å ha nødvendig forsikring.',
          'Vi jobber for at MinNabo alltid skal være tilgjengelig, men kan ikke garantere at tjenesten er uten avbrudd eller feil.',
        ],
      },
    ],
  },
  {
    title: 'Endringer',
    blocks: [
      `Vi kan endre vilkårene, for eksempel når tjenesten utvikles eller regelverket endres. Ved vesentlige endringer varsler vi deg i appen minst ${TERMS.noticeDays} dager før endringene gjelder. Bruker du MinNabo etter det, godtar du de nye vilkårene.`,
      'Dette er første versjon av vilkårene.',
    ],
  },
  {
    title: 'Kontakt',
    blocks: [
      'Har du spørsmål om vilkårene, kontakt oss. Vilkårene er underlagt norsk rett.',
      {
        list: [
          `Selskap: ${owner.name}`,
          `Organisasjonsnummer: ${owner.orgNr}`,
          `Adresse: ${owner.address}`,
          `E-post: ${TERMS.contactEmail}`,
        ],
      },
    ],
  },
];

/** Plain-text version for "Del" (share sheet). */
export function termsAsText(): string {
  const block = (b: TermsBlock): string => {
    if (typeof b === 'string') return b;
    if ('list' in b) return b.list.map((l) => `• ${l}`).join('\n');
    if ('heading' in b) return b.heading;
    return '';
  };
  const head = `MinNabo – Vilkår for bruk\nVersjon ${TERMS.version}\n\nKort fortalt\n${TERMS_SUMMARY.map((l) => `• ${l}`).join('\n')}\n\n`;
  return (
    head +
    TERMS_SECTIONS.map((s, i) => `${i + 1}. ${s.title}\n\n${s.blocks.map(block).filter(Boolean).join('\n\n')}`).join('\n\n')
  );
}
