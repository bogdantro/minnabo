/**
 * «Sesongsjekk for huset» (Fellesskap, 0108): what is wise to do in each season, and which kind of oppdrag
 * fits. «Få hjelp» opens Legg ut with the category chosen and the task as the title.
 */
import type { CategoryId } from '@/theme/theme';

export type Season = 'VAR' | 'SOMMER' | 'HOST' | 'VINTER';
export type SeasonTask = { id: string; title: string; why: string; category: CategoryId };

export const SEASON_TASKS: Record<Season, SeasonTask[]> = {
  VAR: [
    { id: 'var-renner', title: 'Rense takrenner', why: 'Løv og grus fra vinteren tetter rennene.', category: 'vinduspuss' },
    { id: 'var-vindu', title: 'Vaske vinduer', why: 'Vintersalt og støv gjør vinduene matte.', category: 'vinduspuss' },
    { id: 'var-hage', title: 'Rake plenen og klippe busker', why: 'Plenen får lys og luft når den vokser.', category: 'hage' },
    { id: 'var-sykkel', title: 'Gjøre sykkelen klar', why: 'Kjede, bremser og dekk etter vinteren.', category: 'sykkel' },
    { id: 'var-bort', title: 'Kjøre bort hageavfall', why: 'Gjenbruksstasjonen har vårtider.', category: 'bortkjoring' },
  ],
  SOMMER: [
    { id: 'som-plen', title: 'Klippe plenen', why: 'Hver uke i vekstsesongen.', category: 'hage' },
    { id: 'som-maling', title: 'Male eller beise huset', why: 'Tørt og varmt vær er best.', category: 'maling' },
    { id: 'som-husvakt', title: 'Hus- og plantevakt i ferien', why: 'Vanning, post og et tent lys.', category: 'husvakt' },
    { id: 'som-terrasse', title: 'Vaske og olje terrassen', why: 'Treverket tåler vinteren bedre.', category: 'maling' },
  ],
  HOST: [
    { id: 'host-lov', title: 'Rake løv', why: 'Vått løv kveler plenen.', category: 'hage' },
    { id: 'host-ved', title: 'Bære inn ved', why: 'Tørr ved før frosten kommer.', category: 'ved' },
    { id: 'host-renner', title: 'Rense takrenner igjen', why: 'Løvet faller i oktober.', category: 'vinduspuss' },
    { id: 'host-hagemobler', title: 'Sette bort hagemøbler', why: 'Snø og is ødelegger dem.', category: 'flytting' },
    { id: 'host-dekk', title: 'Skifte til vinterdekk', why: 'Før første snø, ikke etter.', category: 'bilpleie' },
  ],
  VINTER: [
    { id: 'vin-sno', title: 'Måke snø', why: 'Gjør det før snøen blir tung og våt.', category: 'snomaking' },
    { id: 'vin-tak', title: 'Måke snø av taket', why: 'Tung snø kan skade taket.', category: 'snomaking' },
    { id: 'vin-strø', title: 'Strø trapp og innkjørsel', why: 'Mindre fare for fall.', category: 'snomaking' },
    { id: 'vin-handling', title: 'Handlehjelp når det er glatt', why: 'Spør heller enn å gå på isen.', category: 'handling' },
  ],
};

/** The season of a month: mars–mai vår, juni–august sommer, september–november høst, desember–februar vinter. */
export function seasonOf(d: Date): Season {
  const m = d.getMonth();
  return m >= 2 && m <= 4 ? 'VAR' : m >= 5 && m <= 7 ? 'SOMMER' : m >= 8 && m <= 10 ? 'HOST' : 'VINTER';
}

export const SEASONS: Season[] = ['VAR', 'SOMMER', 'HOST', 'VINTER'];
