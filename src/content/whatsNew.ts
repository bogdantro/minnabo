/**
 * «Nytt i MinNabo», shown once after an update. One entry per app version: add it when you release
 * something people should know about. A version with no entry shows nothing.
 */
export type WhatsNewItem = { icon: string; title: string; body: string };

export const WHATS_NEW: Record<string, WhatsNewItem[]> = {
  '1.2.0': [
    { icon: 'search', title: 'Søk i alt', body: 'Søket finner nå både oppdrag og naboer som tilbyr hjelp, og du kan se treffene på kart.' },
    { icon: 'msg', title: 'Spørsmål fra naboer', body: 'Still spørsmål rett på oppdraget, så slipper alle å spørre om det samme.' },
    { icon: 'reply', title: 'Svar på en melding', body: 'Dra en melding til siden for å svare på akkurat den. Hold inne for å kopiere eller slette.' },
    { icon: 'users', title: 'Flere hjelpere', body: 'Trenger du to til flyttingen? Oppdraget ligger ute til du har begge.' },
    { icon: 'cal', title: 'Dugnad og verktøy', body: 'Meld deg på dugnader, og book verktøy du vil låne på oppslagstavla.' },
  ],
};
