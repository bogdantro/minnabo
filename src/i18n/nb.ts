/**
 * All user-facing text in norsk bokmål. No language switcher (spec §8).
 * Keep every string the user can see in this file.
 */

const nb = {
  app: {
    name: 'MinNabo',
    tagline: 'Småjobber nær deg. Enkelt, trygt og lokalt.',
  },

  tabs: {
    oppdrag: 'Oppdrag',
    fellesskap: 'Fellesskap',
    leggUt: 'Legg ut',
    innboks: 'Innboks',
    meny: 'Meny',
  },

  home: {
    question: 'Hva trenger du hjelp med?',
    searchPlaceholder: 'Søk etter småjobber',
    nearYou: 'Jobber nær deg',
    typeAll: 'Alle',
    typeNeed: 'Oppdrag å ta',
    typeOffer: 'Folk som tilbyr hjelp',
    nearYouNeed: 'Oppdrag nær deg',
    nearYouOffer: 'Tilbyr hjelp nær deg',
  },

  categories: {
    alle: 'Alle',
    hage: 'Hage',
    renhold: 'Renhold',
    transport: 'Transport',
    montering: 'Montering',
  },

  badge: {
    needsHelp: 'Trenger hjelp',
    offersHelp: 'Tilbyr hjelp',
    openTask: 'Åpent oppdrag',
    offerAvailable: 'Tilgjengelig for småjobber',
  },

  a11y: {
    openProfile: 'Åpne profil',
    notifications: 'Varsler',
    back: 'Tilbake',
    more: 'Mer',
    save: 'Lagre oppføring',
    unsave: 'Fjern fra lagrede',
  },

  state: {
    loading: 'Laster …',
    emptyListings: 'Ingen oppføringer her ennå.',
    emptySearch: 'Fant ingen treff. Prøv et annet søk.',
    error: 'Noe gikk galt. Prøv igjen.',
    offline: 'Du er uten nettforbindelse.',
    retry: 'Prøv igjen',
    noAccess: 'Du har ikke tilgang til dette.',
  },

  common: {
    km: 'km',
    away: 'unna',
    upTo: 'opptil',
    fixedPrice: 'Fastpris',
    budget: 'Budsjett',
    fromPrice: 'Fra-pris',
    priceByAgreement: 'Pris avtales',
    wantsOffers: 'Ønsker tilbud',
    approxArea: 'Omtrent',
    close: 'Lukk',
    cancel: 'Avbryt',
    confirm: 'Bekreft',
    send: 'Send',
  },

  listingDetail: {
    taskTitle: 'Oppdragsdetaljer',
    offerTitle: 'Tilgjengelig for småjobber',
    description: 'Beskrivelse',
    practicalInfo: 'Praktisk informasjon',
    aboutOffer: 'Om tilbudet',
    experienceAndServices: 'Erfaring og tjenester',
    equipment: 'Utstyr',
    meeting: 'Oppmøte',
    taskOwner: 'Oppdragsgiver',
    seeProfile: 'Se profil',
    seeFullProfile: 'Se hele profilen',
    memberSince: 'Medlem siden',
    giveOffer: 'Gi tilbud',
    sendMessage: 'Send melding',
    contact: 'Ta kontakt',
    requestOffer: 'Be om tilbud',
    priceNoteTask: 'Pris og betaling avtales mellom dere.',
    priceNoteOffer: 'Pris og betaling avtales direkte mellom dere.',
    ratingsSuffix: 'vurderinger',
    completedJobs: 'fullførte oppdrag',
    yearsExperience: 'års erfaring',
  },

  verification: {
    phone: 'Telefon verifisert',
    email: 'E-post verifisert',
    business: 'Bedrift verifisert',
  },

  inbox: {
    title: 'Innboks',
    searchPlaceholder: 'Søk i meldinger',
    filterAll: 'Alle',
    filterUnread: 'Uleste',
    sectionTitle: 'Meldinger',
    empty: 'Ingen samtaler ennå.',
    emptyUnread: 'Ingen uleste meldinger.',
    tagNewOffer: 'Nytt tilbud',
    tagOfferAccepted: 'Tilbud godtatt',
  },

  chat: {
    activeNow: 'Aktiv nå',
    inputPlaceholder: 'Skriv en melding …',
    sendOffer: 'Send tilbud',
    attach: 'Legg ved',
    send: 'Send',
    reportMenu: 'Rapportér eller blokkér',
    offerLabel: 'TILBUD',
    acceptOffer: 'Godta tilbud',
    declineOffer: 'Avslå',
    offerAccepted: 'Tilbud godtatt',
    offerDeclined: 'Tilbud avslått',
    offerWithdrawn: 'Tilbud trukket',
    paymentNote:
      'Betaling avtales og gjennomføres direkte mellom partene. MinNabo håndterer ikke betaling.',
    systemOfferSent: 'sendte et tilbud',
  },
} as const;

export default nb;
export type Nb = typeof nb;
