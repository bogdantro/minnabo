/**
 * «Nytt i MinNabo», shown once after an update. One entry per app version: add it when you release
 * something people should know about. A version with no entry shows nothing.
 */
export type WhatsNewItem = { icon: string; title: string; body: string };

export const WHATS_NEW: Record<string, WhatsNewItem[]> = {
  '1.2.0': [
    { icon: 'search', title: 'Søk i alt', body: 'Søket finner nå både oppdrag og naboer som tilbyr hjelp, og du kan se treffene på kart.' },
    { icon: 'pinned', title: 'Ny oppslagstavle', body: 'Lik og svar på oppslag, og få varsel når naboene legger ut noe nytt.' },
    { icon: 'reply', title: 'Svar på en melding', body: 'Dra en melding til siden for å svare på akkurat den. Hold inne for å kopiere eller slette.' },
    { icon: 'users', title: 'Flere hjelpere', body: 'Trenger du to til flyttingen? Oppdraget ligger ute til du har begge.' },
    { icon: 'cal', title: 'Dugnad og verktøy', body: 'Meld deg på dugnader, og book verktøy du vil låne på oppslagstavla.' },
  ],
  // everything since 1.2.0 (7. november): shown once after the 1.3.0 update
  '1.3.0': [
    { icon: 'sliders', title: 'Oppdrag slik du vil ha dem', body: 'Sorter på nærmest, nyeste eller haster først, skjul kategorier, og søk med stemmen.' },
    { icon: 'users', title: 'Mer i Fellesskap', body: 'Lag og foreninger, nabolagsprosjekter, språkvenn, sesongsjekk og farevarsler. Søk i alt på ett sted.' },
    { icon: 'pinned', title: 'Ny oppslagstavle', body: 'Reager, svar på svar, stem og bli med på arrangementer. Ukas bilde, Utlån og det som skjer i nærheten finner du her.' },
    { icon: 'msg', title: 'Smartere innboks', body: 'Mapper, sammenlign tilbud, rediger en melding i 15 minutter, og send video og PDF.' },
    { icon: 'home', title: 'Nabolag i hele Innlandet', body: 'Nå finnes det nabolag i alle kommuner – Moelv, Brumunddal, Raufoss og mange flere. Ungdom kan også bli med.' },
    { icon: 'repeat', title: 'Faste avtaler', body: 'Samme hjelp hver uke eller annenhver uke, med påminnelse før hver gang og én vurdering for hele sesongen.' },
  ],
};
