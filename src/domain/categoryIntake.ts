export type IntakeField =
  | { key: string; label: string; type: 'text'; placeholder?: string }
  | { key: string; label: string; type: 'choice'; options: string[] };

/** Extra questions shown in the task wizard for certain categories. */
export const CATEGORY_INTAKE: Record<string, IntakeField[]> = {
  flytting: [
    { key: 'floors', label: 'Etasje', type: 'text', placeholder: 'F.eks. 3. etasje' },
    { key: 'elevator', label: 'Heis', type: 'choice', options: ['Ja', 'Nei'] },
    { key: 'boxes', label: 'Omtrent hvor mange esker/møbler?', type: 'text', placeholder: 'F.eks. 20 esker + sofa' },
  ],
  renhold: [
    { key: 'rooms', label: 'Antall rom', type: 'text', placeholder: 'F.eks. 3 rom + kjøkken og bad' },
    { key: 'pets', label: 'Kjæledyr i boligen', type: 'choice', options: ['Ingen', 'Hund', 'Katt', 'Annet'] },
    { key: 'supplies', label: 'Vaskemidler', type: 'choice', options: ['Jeg har alt', 'Ta med selv'] },
  ],
  montering: [
    { key: 'what', label: 'Hva skal monteres?', type: 'text', placeholder: 'F.eks. IKEA PAX-skap' },
    { key: 'tools', label: 'Verktøy', type: 'choice', options: ['Jeg har verktøy', 'Ta med selv'] },
  ],
  snomaking: [
    { key: 'area', label: 'Hva skal måkes?', type: 'text', placeholder: 'F.eks. innkjørsel + trapp + tak' },
    { key: 'access', label: 'Snø å kaste den?', type: 'choice', options: ['Ja, god plass', 'Trangt'] },
  ],
  hage: [
    { key: 'size', label: 'Omtrentlig størrelse', type: 'text', placeholder: 'F.eks. 250 m² plen' },
    { key: 'equipment', label: 'Utstyr', type: 'choice', options: ['Jeg har utstyr', 'Ta med selv'] },
  ],
};
