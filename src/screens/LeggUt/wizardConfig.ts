import type { CategoryId } from '@/theme/theme';
import type { IconKey } from '@/components/ui/Icon';

/**
 * Category-specific questions on step 3 ("Detaljer"). Each category has its own
 * set; the answers are saved as `task.intake` label/value pairs, so the detail
 * page and the chat show them without knowing the category.
 */
export type IntakeField =
  | { kind: 'choice'; key: string; label: string; icon?: IconKey; options: string[]; multi?: boolean; required?: boolean }
  | { kind: 'number'; key: string; label: string; icon?: IconKey; unit: string; step: number; min: number; max: number; def: number }
  | { kind: 'yesno'; key: string; label: string; icon?: IconKey; def?: 'Ja' | 'Nei' }
  | { kind: 'text'; key: string; label: string; icon?: IconKey; placeholder: string; max?: number };

export type EquipKey =
  | 'utstyr'
  | 'materialer'
  | 'parkering'
  | 'dyr'
  | 'hjemme'
  | 'nokkel'
  | 'strom'
  | 'avfall'
  | 'trapp';

export type CategoryForm = {
  fields: IntakeField[];
  /** default "Hvor lang tid" (hours) */
  hours: number;
  /** default number of helpers */
  helpers: number;
  /** usual price range in kr – a hint on the price step, never a rule */
  price: [number, number];
  /** description placeholder that says what is useful to tell */
  descPh: string;
  /** the "Utstyr og praktisk" toggles that make sense for this category */
  equipment: EquipKey[];
  /** title suggestions on step 2 */
  titles: string[];
};

const ALL_EQ: EquipKey[] = ['utstyr', 'materialer', 'parkering', 'dyr', 'hjemme', 'nokkel', 'strom', 'avfall', 'trapp'];
const HOME_EQ: EquipKey[] = ['utstyr', 'materialer', 'parkering', 'dyr', 'hjemme', 'nokkel', 'trapp'];
const OUT_EQ: EquipKey[] = ['utstyr', 'materialer', 'parkering', 'strom', 'avfall', 'hjemme'];

export const FORMS: Record<CategoryId, CategoryForm> = {
  hage: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva gjelder det?', icon: 'hage', options: ['Plen', 'Hekk', 'Løv', 'Bed og luking', 'Trær og busker', 'Annet'], multi: true, required: true },
      { kind: 'number', key: 'size', label: 'Omtrentlig størrelse', icon: 'sliders', unit: 'm²', step: 25, min: 25, max: 5000, def: 300 },
      { kind: 'yesno', key: 'tools', label: 'Finnes det utstyr (gressklipper, saks)?', icon: 'montering', def: 'Ja' },
      { kind: 'yesno', key: 'haul', label: 'Skal hageavfall kjøres bort?', icon: 'transport', def: 'Nei' },
    ],
    hours: 3, helpers: 1, price: [400, 1500],
    descPh: 'F.eks. «Plenen er ca. 300 m² og ganske høy. Klipperen står i boden.»',
    equipment: OUT_EQ,
    titles: ['Klippe plen og rake løv', 'Klippe hekken', 'Luke bedene', 'Felle små busker'],
  },
  rengjoring: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva skal vaskes?', icon: 'rengjoring', options: ['Leilighet', 'Hus', 'Hytte', 'Kontor', 'Trappeoppgang'], required: true },
      { kind: 'choice', key: 'type', label: 'Type vask', icon: 'list', options: ['Vanlig vask', 'Storrengjøring', 'Flyttevask', 'Etter oppussing'] },
      { kind: 'number', key: 'size', label: 'Omtrentlig størrelse', icon: 'sliders', unit: 'm²', step: 10, min: 10, max: 600, def: 70 },
      { kind: 'number', key: 'baths', label: 'Antall bad', icon: 'rengjoring', unit: 'stk', step: 1, min: 0, max: 6, def: 1 },
      { kind: 'yesno', key: 'supplies', label: 'Har du vaskemidler og utstyr?', icon: 'tag', def: 'Ja' },
    ],
    hours: 4, helpers: 1, price: [600, 3000],
    descPh: 'F.eks. «Flyttevask av 3-roms, ovn og kjøleskap må med. Vinduer innvendig.»',
    equipment: HOME_EQ,
    titles: ['Flyttevask av leilighet', 'Vaske vinduer', 'Vårrengjøring av hytta', 'Ukentlig vask'],
  },
  flytting: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva skal bæres?', icon: 'flytting', options: ['Møbler', 'Esker', 'Hvitevarer', 'Piano', 'Hele flyttelasset'], multi: true, required: true },
      { kind: 'number', key: 'floors', label: 'Etasjer å bære', icon: 'up', unit: 'etg.', step: 1, min: 0, max: 15, def: 2 },
      { kind: 'yesno', key: 'lift', label: 'Er det heis?', icon: 'up', def: 'Nei' },
      { kind: 'yesno', key: 'van', label: 'Trengs det bil/henger?', icon: 'transport', def: 'Nei' },
      { kind: 'text', key: 'heavy', label: 'Tyngste gjenstand', icon: 'flytting', placeholder: 'F.eks. trekkoppskap, ca. 80 kg', max: 60 },
    ],
    hours: 3, helpers: 2, price: [500, 3000],
    descPh: 'F.eks. «Sofa og to kommoder fra 3. etasje til henger. Smal trapp.»',
    equipment: ['utstyr', 'parkering', 'trapp', 'hjemme', 'avfall'],
    titles: ['Bære sofa til 3. etasje', 'Hjelp med flyttelasset', 'Bære kjøleskap', 'Bære piano'],
  },
  transport: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva skal fraktes?', icon: 'transport', options: ['Møbler', 'Avfall', 'Varer', 'Sykler', 'Annet'], required: true },
      { kind: 'number', key: 'km', label: 'Omtrentlig avstand', icon: 'nav', unit: 'km', step: 5, min: 1, max: 500, def: 10 },
      { kind: 'choice', key: 'vehicle', label: 'Hva trengs?', icon: 'transport', options: ['Personbil', 'Bil med henger', 'Varebil', 'Vet ikke'] },
      { kind: 'yesno', key: 'carry', label: 'Trengs det bærehjelp?', icon: 'flytting', def: 'Ja' },
    ],
    hours: 2, helpers: 1, price: [300, 1500],
    descPh: 'F.eks. «Hente en kommode på Finn i Gjøvik og kjøre den hjem til meg.»',
    equipment: ['parkering', 'trapp', 'hjemme'],
    titles: ['Kjøre til gjenvinningsstasjonen', 'Hente en kommode', 'Frakte sykler til hytta'],
  },
  montering: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva skal monteres?', icon: 'montering', options: ['Møbler', 'Hyller', 'Gardiner', 'TV på vegg', 'Lekeapparat', 'Annet'], multi: true, required: true },
      { kind: 'number', key: 'count', label: 'Antall ting', icon: 'list', unit: 'stk', step: 1, min: 1, max: 30, def: 1 },
      { kind: 'choice', key: 'wall', label: 'Vegg (hvis noe skal festes)', icon: 'home', options: ['Gips', 'Tre', 'Betong/mur', 'Vet ikke', 'Ingen'] },
      { kind: 'yesno', key: 'tools', label: 'Har du verktøy?', icon: 'montering', def: 'Nei' },
    ],
    hours: 2, helpers: 1, price: [300, 1500],
    descPh: 'F.eks. «IKEA PAX-skap 2 m høyt, skal festes i gipsvegg.»',
    equipment: HOME_EQ,
    titles: ['Montere garderobeskap', 'Henge opp hyller', 'Montere seng', 'Henge opp TV'],
  },
  snomaking: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva skal måkes?', icon: 'snomaking', options: ['Oppkjørsel', 'Tak', 'Trapp og inngang', 'Parkeringsplass'], multi: true, required: true },
      { kind: 'number', key: 'size', label: 'Omtrentlig størrelse', icon: 'sliders', unit: 'm²', step: 10, min: 10, max: 2000, def: 60 },
      { kind: 'choice', key: 'freq', label: 'Hvor ofte?', icon: 'repeat', options: ['Én gang', 'Etter hvert snøfall', 'Hele sesongen'] },
      { kind: 'yesno', key: 'blower', label: 'Finnes det snøfres?', icon: 'montering', def: 'Nei' },
      { kind: 'yesno', key: 'salt', label: 'Skal det strøs?', icon: 'snomaking', def: 'Nei' },
    ],
    hours: 1, helpers: 1, price: [200, 800],
    descPh: 'F.eks. «Oppkjørsel på ca. 60 m² og trappa. Gjerne før kl. 07.»',
    equipment: OUT_EQ,
    titles: ['Måke oppkjørselen', 'Måke taket', 'Strø trappa', 'Snømåking hele vinteren'],
  },
  maling: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva skal males?', icon: 'maling', options: ['Gjerde', 'Terrasse', 'Vegg inne', 'Husvegg ute', 'Vinduer', 'Annet'], multi: true, required: true },
      { kind: 'number', key: 'size', label: 'Omtrentlig størrelse', icon: 'sliders', unit: 'm²', step: 5, min: 5, max: 1000, def: 30 },
      { kind: 'yesno', key: 'paint', label: 'Har du maling/beis?', icon: 'tag', def: 'Ja' },
      { kind: 'yesno', key: 'prep', label: 'Trengs det skraping/vask først?', icon: 'rengjoring', def: 'Nei' },
      { kind: 'yesno', key: 'ladder', label: 'Trengs det stige over 3 m?', icon: 'up', def: 'Nei' },
    ],
    hours: 5, helpers: 1, price: [800, 5000],
    descPh: 'F.eks. «Beise terrassen, ca. 30 m². Den er vasket og tørr.»',
    equipment: ALL_EQ,
    titles: ['Male gjerdet i hagen', 'Beise terrassen', 'Male en vegg', 'Male vinduskarmer'],
  },
  dyrepass: {
    fields: [
      { kind: 'choice', key: 'animal', label: 'Hvilket dyr?', icon: 'dyrepass', options: ['Hund', 'Katt', 'Kanin', 'Fugl', 'Hest', 'Annet'], multi: true, required: true },
      { kind: 'number', key: 'count', label: 'Antall dyr', icon: 'list', unit: 'stk', step: 1, min: 1, max: 10, def: 1 },
      { kind: 'number', key: 'days', label: 'Antall dager', icon: 'cal', unit: 'dager', step: 1, min: 1, max: 60, def: 2 },
      { kind: 'choice', key: 'help', label: 'Hva trengs?', icon: 'list', options: ['Lufting', 'Mating', 'Overnatting', 'Medisiner', 'Kos og tilsyn'], multi: true },
      { kind: 'text', key: 'notes', label: 'Viktig å vite om dyret', icon: 'info', placeholder: 'F.eks. redd for andre hunder', max: 80 },
    ],
    hours: 1, helpers: 1, price: [150, 600],
    descPh: 'F.eks. «Labrador på 4 år, trenger lufting 2 ganger om dagen mens vi er bortreist.»',
    equipment: ['nokkel', 'hjemme', 'parkering'],
    titles: ['Lufte hunden på dagtid', 'Passe katten i helga', 'Mate kaninen i ferien'],
  },
  data: {
    fields: [
      { kind: 'choice', key: 'device', label: 'Hva gjelder det?', icon: 'data', options: ['Mobil', 'PC/Mac', 'Nettbrett', 'Skriver', 'Wifi/ruter', 'TV/strømming'], multi: true, required: true },
      { kind: 'choice', key: 'task', label: 'Hva trenger du hjelp med?', icon: 'list', options: ['Oppsett', 'Feilsøking', 'Flytte data', 'Opplæring', 'Sikkerhet/virus'], multi: true },
      { kind: 'number', key: 'count', label: 'Antall enheter', icon: 'list', unit: 'stk', step: 1, min: 1, max: 20, def: 1 },
      { kind: 'yesno', key: 'remote', label: 'Kan det gjøres på avstand?', icon: 'globe', def: 'Nei' },
    ],
    hours: 2, helpers: 1, price: [300, 1000],
    descPh: 'F.eks. «Ny iPhone, vil flytte bilder og kontakter fra den gamle Samsungen.»',
    equipment: ['hjemme', 'strom', 'parkering'],
    titles: ['Sette opp ny mobil', 'Hjelp med skriver og wifi', 'Flytte bilder til ny PC'],
  },
  arrangement: {
    fields: [
      { kind: 'choice', key: 'type', label: 'Hva slags arrangement?', icon: 'arrangement', options: ['Bursdag', 'Konfirmasjon', 'Bryllup', 'Dugnad', 'Fest', 'Annet'], required: true },
      { kind: 'number', key: 'guests', label: 'Antall gjester', icon: 'users', unit: 'pers.', step: 10, min: 5, max: 500, def: 30 },
      { kind: 'choice', key: 'help', label: 'Hva trengs?', icon: 'list', options: ['Rigging', 'Servering', 'Oppvask', 'Rydding etterpå', 'Barneaktiviteter'], multi: true },
      { kind: 'yesno', key: 'evening', label: 'Varer det til sent på kvelden?', icon: 'moon', def: 'Nei' },
    ],
    hours: 4, helpers: 2, price: [500, 3000],
    descPh: 'F.eks. «Konfirmasjon for 40 gjester i grendehuset. Trenger hjelp til servering og rydding.»',
    equipment: ['utstyr', 'parkering', 'strom', 'avfall'],
    titles: ['Hjelp til bursdagsselskap', 'Rigge til fest', 'Servering på konfirmasjon'],
  },
  snekring: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva skal gjøres?', icon: 'snekring', options: ['Reparere', 'Bygge nytt', 'Bytte lister', 'Dør/skap justering', 'Terrasse/platting', 'Annet'], multi: true, required: true },
      { kind: 'choice', key: 'where', label: 'Inne eller ute?', icon: 'home', options: ['Inne', 'Ute', 'Begge'] },
      { kind: 'yesno', key: 'material', label: 'Har du materialene?', icon: 'tag', def: 'Nei' },
      { kind: 'yesno', key: 'tools', label: 'Har du verktøy?', icon: 'montering', def: 'Nei' },
    ],
    hours: 4, helpers: 1, price: [500, 3000],
    descPh: 'F.eks. «Bytte tre bord i terrassen og feste et løst rekkverk.»',
    equipment: ALL_EQ,
    titles: ['Reparere rekkverk', 'Bytte gulvlister', 'Bygge en liten platting', 'Justere skapdører'],
  },
  vinduspuss: {
    fields: [
      { kind: 'number', key: 'windows', label: 'Antall vinduer', icon: 'vinduspuss', unit: 'stk', step: 1, min: 1, max: 80, def: 10 },
      { kind: 'choice', key: 'side', label: 'Hvilke sider?', icon: 'vinduspuss', options: ['Innvendig', 'Utvendig', 'Begge'], required: true },
      { kind: 'number', key: 'floors', label: 'Antall etasjer', icon: 'up', unit: 'etg.', step: 1, min: 1, max: 5, def: 1 },
      { kind: 'yesno', key: 'ladder', label: 'Trengs det stige?', icon: 'up', def: 'Nei' },
    ],
    hours: 2, helpers: 1, price: [400, 1500],
    descPh: 'F.eks. «Ca. 12 vinduer i enebolig, utvendig i 2. etasje trengs stige.»',
    equipment: ['utstyr', 'parkering', 'dyr', 'hjemme', 'strom'],
    titles: ['Vaske alle vinduer', 'Vaske vinduer utvendig', 'Pusse vinduer før 17. mai'],
  },
  bilpleie: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva trengs?', icon: 'bilpleie', options: ['Vask utvendig', 'Støvsuging innvendig', 'Polering', 'Dekkskift', 'Annet'], multi: true, required: true },
      { kind: 'choice', key: 'size', label: 'Bilstørrelse', icon: 'bilpleie', options: ['Liten', 'Mellomstor', 'Stor/SUV', 'Varebil'] },
      { kind: 'yesno', key: 'water', label: 'Er det vann og strøm der bilen står?', icon: 'rengjoring', def: 'Ja' },
    ],
    hours: 2, helpers: 1, price: [300, 1200],
    descPh: 'F.eks. «Dekkskift på Golf, hjulene står i garasjen. Jekk finnes.»',
    equipment: ['utstyr', 'strom', 'parkering', 'hjemme'],
    titles: ['Vaske bilen', 'Bytte til vinterdekk', 'Støvsuge og vaske bilen inni'],
  },
  handling: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva gjelder det?', icon: 'handling', options: ['Dagligvarer', 'Apotek', 'Post/pakker', 'Hente noe', 'Annet'], multi: true, required: true },
      { kind: 'choice', key: 'freq', label: 'Hvor ofte?', icon: 'repeat', options: ['Én gang', 'Ukentlig', 'Flere ganger i uka'] },
      { kind: 'yesno', key: 'car', label: 'Trengs det bil?', icon: 'transport', def: 'Nei' },
      { kind: 'yesno', key: 'advance', label: 'Må hjelperen legge ut for varene?', icon: 'tag', def: 'Nei' },
    ],
    hours: 1, helpers: 1, price: [100, 400],
    descPh: 'F.eks. «Handle dagligvarer på Rema én gang i uka. Liste sendes i chatten.»',
    equipment: ['hjemme', 'nokkel', 'trapp', 'parkering'],
    titles: ['Handle dagligvarer', 'Hente medisiner på apoteket', 'Hente en pakke'],
  },
  leksehjelp: {
    fields: [
      { kind: 'choice', key: 'subject', label: 'Fag', icon: 'leksehjelp', options: ['Matte', 'Norsk', 'Engelsk', 'Naturfag', 'Annet'], multi: true, required: true },
      { kind: 'choice', key: 'level', label: 'Trinn', icon: 'list', options: ['Barneskole', 'Ungdomsskole', 'Videregående', 'Voksen'], required: true },
      { kind: 'choice', key: 'place', label: 'Hvor?', icon: 'home', options: ['Hjemme hos oss', 'Bibliotek', 'Digitalt'] },
      { kind: 'number', key: 'sessions', label: 'Antall økter', icon: 'cal', unit: 'økter', step: 1, min: 1, max: 30, def: 1 },
    ],
    hours: 1, helpers: 1, price: [150, 500],
    descPh: 'F.eks. «Matte for 9. klasse, mest brøk og likninger. En time i uka.»',
    equipment: ['hjemme', 'parkering'],
    titles: ['Mattehjelp for 9. klasse', 'Leksehjelp i engelsk', 'Hjelp før eksamen'],
  },
  husvakt: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva trengs?', icon: 'husvakt', options: ['Vanne planter', 'Tømme postkassen', 'Sjekke huset', 'Mate fisk', 'Lufte'], multi: true, required: true },
      { kind: 'number', key: 'days', label: 'Antall dager', icon: 'cal', unit: 'dager', step: 1, min: 1, max: 90, def: 7 },
      { kind: 'choice', key: 'visits', label: 'Hvor ofte?', icon: 'repeat', options: ['Daglig', 'Annenhver dag', 'To ganger i uka'] },
    ],
    hours: 1, helpers: 1, price: [100, 600],
    descPh: 'F.eks. «Vanne plantene og tømme postkassen mens vi er på ferie i to uker.»',
    equipment: ['nokkel', 'dyr', 'parkering'],
    titles: ['Vanne planter i ferien', 'Se til huset mens vi er borte', 'Tømme postkassen'],
  },
  ved: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva skal gjøres?', icon: 'ved', options: ['Kløyve ved', 'Stable ved', 'Bære inn ved', 'Kappe ved'], multi: true, required: true },
      { kind: 'number', key: 'amount', label: 'Omtrentlig mengde', icon: 'sliders', unit: 'sekker', step: 5, min: 5, max: 300, def: 20 },
      { kind: 'yesno', key: 'splitter', label: 'Finnes det vedkløyver?', icon: 'montering', def: 'Nei' },
    ],
    hours: 3, helpers: 1, price: [400, 2000],
    descPh: 'F.eks. «Ca. 3 favner bjørk skal kløyves og stables i vedskjulet.»',
    equipment: OUT_EQ,
    titles: ['Kløyve og stable ved', 'Bære inn ved til vinteren', 'Kappe ved'],
  },
  bortkjoring: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva skal bort?', icon: 'bortkjoring', options: ['Møbler', 'Hageavfall', 'Byggavfall', 'Elektronikk', 'Blandet'], multi: true, required: true },
      { kind: 'choice', key: 'volume', label: 'Omtrentlig mengde', icon: 'sliders', options: ['Et bilfull', 'En hengerlast', 'Flere turer'] },
      { kind: 'yesno', key: 'carry', label: 'Må det bæres ut?', icon: 'flytting', def: 'Ja' },
      { kind: 'yesno', key: 'sort', label: 'Trengs det sortering?', icon: 'list', def: 'Nei' },
    ],
    hours: 2, helpers: 1, price: [400, 2000],
    descPh: 'F.eks. «En gammel sofa og 6 sekker hageavfall til gjenvinningsstasjonen.»',
    equipment: ['parkering', 'trapp', 'hjemme', 'avfall'],
    titles: ['Kjøre søppel til gjenvinning', 'Rydde boden', 'Kvitte seg med gammel sofa'],
  },
  sykkel: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva trengs?', icon: 'sykkel', options: ['Lappe slange', 'Bremser', 'Gir', 'Kjede', 'Vårservice', 'Annet'], multi: true, required: true },
      { kind: 'choice', key: 'type', label: 'Type sykkel', icon: 'sykkel', options: ['Vanlig', 'Elsykkel', 'Barnesykkel', 'Terreng'] },
      { kind: 'number', key: 'count', label: 'Antall sykler', icon: 'list', unit: 'stk', step: 1, min: 1, max: 10, def: 1 },
    ],
    hours: 1, helpers: 1, price: [150, 700],
    descPh: 'F.eks. «To barnesykler trenger vårservice: bremser, gir og luft.»',
    equipment: ['utstyr', 'hjemme', 'parkering'],
    titles: ['Vårservice på sykkelen', 'Lappe sykkelslange', 'Justere bremsene'],
  },
  matlaging: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva trengs?', icon: 'matlaging', options: ['Middag', 'Bakst', 'Matpakker', 'Selskapsmat', 'Annet'], multi: true, required: true },
      { kind: 'number', key: 'people', label: 'Antall personer', icon: 'users', unit: 'pers.', step: 1, min: 1, max: 100, def: 4 },
      { kind: 'text', key: 'allergy', label: 'Allergier/hensyn', icon: 'info', placeholder: 'F.eks. glutenfritt, ingen nøtter', max: 80 },
      { kind: 'yesno', key: 'ingredients', label: 'Kjøper du inn råvarene?', icon: 'handling', def: 'Ja' },
    ],
    hours: 3, helpers: 1, price: [300, 2000],
    descPh: 'F.eks. «Bake to kaker og 40 rundstykker til konfirmasjon lørdag.»',
    equipment: ['materialer', 'hjemme', 'dyr', 'parkering'],
    titles: ['Bake til konfirmasjon', 'Lage middager for uka', 'Smøre matpakker til dugnad'],
  },
  selskap: {
    fields: [
      { kind: 'choice', key: 'what', label: 'Hva gjelder det?', icon: 'selskap', options: ['Prat og kaffe', 'Gåtur', 'Følge til lege', 'Følge på tur', 'Spill og aktivitet'], multi: true, required: true },
      { kind: 'choice', key: 'freq', label: 'Hvor ofte?', icon: 'repeat', options: ['Én gang', 'Ukentlig', 'Flere ganger i uka'] },
      { kind: 'yesno', key: 'mobility', label: 'Trengs det hjelp til å gå?', icon: 'users', def: 'Nei' },
    ],
    hours: 2, helpers: 1, price: [150, 600],
    descPh: 'F.eks. «Mor på 84 år blir glad for besøk og en gåtur én gang i uka.»',
    equipment: ['hjemme', 'parkering', 'dyr', 'trapp'],
    titles: ['Besøksvenn for mamma', 'Følge til legetime', 'Gåtur på ettermiddagen'],
  },
  barnevakt: {
    fields: [
      { kind: 'number', key: 'kids', label: 'Antall barn', icon: 'users', unit: 'barn', step: 1, min: 1, max: 8, def: 1 },
      { kind: 'choice', key: 'ages', label: 'Alder', icon: 'barnevakt', options: ['0–2 år', '3–5 år', '6–9 år', '10+ år'], multi: true, required: true },
      { kind: 'choice', key: 'when', label: 'Når på døgnet?', icon: 'clock', options: ['Dagtid', 'Ettermiddag', 'Kveld', 'Natt'] },
      { kind: 'yesno', key: 'bedtime', label: 'Skal barna legges?', icon: 'moon', def: 'Nei' },
    ],
    hours: 4, helpers: 1, price: [300, 1200],
    descPh: 'F.eks. «To barn på 4 og 7 år, fredag kveld 18–23. De skal legges ca. kl. 20.»',
    equipment: ['hjemme', 'dyr', 'parkering'],
    titles: ['Barnevakt fredagskveld', 'Hente i barnehagen', 'Passe barna i vinterferien'],
  },
  annet: {
    fields: [
      { kind: 'choice', key: 'where', label: 'Hva slags oppdrag?', icon: 'annet', options: ['Innendørs', 'Utendørs', 'Begge'], required: true },
      { kind: 'yesno', key: 'tools', label: 'Trengs det eget utstyr?', icon: 'montering', def: 'Nei' },
      { kind: 'text', key: 'skills', label: 'Spesielle ferdigheter?', icon: 'award', placeholder: 'F.eks. sterk rygg, førerkort', max: 60 },
    ],
    hours: 2, helpers: 1, price: [200, 1500],
    descPh: 'F.eks. «Hjelp til å bære inn 20 sekker jord og fordele dem i bedene.»',
    equipment: ALL_EQ,
    titles: ['Hjelp med handling', 'Vanne planter i ferien', 'Bære og rydde'],
  },
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

export const EQUIPMENT: { id: EquipKey; label: string; sub: string; icon: IconKey }[] = [
  { id: 'utstyr', label: 'Utstyr finnes', sub: 'Stige, verktøy og det som trengs', icon: 'montering' },
  { id: 'materialer', label: 'Materialer kjøpes av meg', sub: 'Hjelperen trenger ikke kjøpe inn', icon: 'tag' },
  { id: 'parkering', label: 'Parkering tilgjengelig', sub: 'Plass til bil ved huset', icon: 'transport' },
  { id: 'dyr', label: 'Dyr i huset', sub: 'Nyttig å vite ved allergi', icon: 'dyrepass' },
  { id: 'hjemme', label: 'Jeg er hjemme under jobben', sub: 'Du kan spørre underveis', icon: 'home' },
  { id: 'nokkel', label: 'Nøkkel kan hentes', sub: 'Avtal henting i chatten', icon: 'key' },
  { id: 'strom', label: 'Strøm tilgjengelig', sub: 'Stikkontakt i nærheten', icon: 'zap' },
  { id: 'avfall', label: 'Avfall må tas med', sub: 'Hjelperen kjører bort det som blir til overs', icon: 'trash' },
  { id: 'trapp', label: 'Trapper uten heis', sub: 'Viktig ved bæring', icon: 'up' },
];

export const QUICK_AMOUNTS = [500, 1000, 1500, 2000, 3000];

/** Helpers that can be asked for (antall hjelpere). */
export const MAX_HELPERS = 6;
