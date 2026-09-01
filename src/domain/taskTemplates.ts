import type { IconName } from '@/components/ui/Icon';

export type TaskTemplate = {
  id: string;
  label: string;
  icon: IconName;
  categorySlug: string;
  title: string;
  description: string;
  duration?: string;
  equipExtra?: string;
};

/** Pre-filled starting points for the most common neighbour tasks. */
export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'snomaking',
    label: 'Snømåking',
    icon: 'cloud-snow',
    categorySlug: 'snomaking',
    title: 'Snømåking av innkjørsel og trapp',
    description:
      'Trenger hjelp til å måke innkjørselen og trappa etter snøfall. Innkjørselen er ca. 10 meter.',
    duration: 'Under 1 time',
  },
  {
    id: 'flyttehjelp',
    label: 'Flyttehjelp',
    icon: 'package',
    categorySlug: 'flytting',
    title: 'Flyttehjelp med bæring',
    description:
      'Trenger et par ekstra hender til å bære møbler og esker ut til bil og inn i ny bolig. Ingen tunge hvitevarer.',
    duration: 'Omtrent 2–4 timer',
  },
  {
    id: 'montering',
    label: 'Møbelmontering',
    icon: 'tool',
    categorySlug: 'montering',
    title: 'Montering av flatpakkede møbler',
    description: 'Har et par flatpakkede møbler som skal monteres – et skap og en kommode.',
    duration: 'Omtrent 1–2 timer',
    equipExtra: 'Ta gjerne med drill hvis du har.',
  },
  {
    id: 'hagestell',
    label: 'Hagestell',
    icon: 'feather',
    categorySlug: 'hage',
    title: 'Plenklipping og litt luking',
    description: 'Plen på ca. 200 m² som trenger klipping, pluss litt luking i bedene.',
    duration: 'Omtrent 1–2 timer',
  },
  {
    id: 'rengjoring',
    label: 'Rengjøring',
    icon: 'droplet',
    categorySlug: 'renhold',
    title: 'Vanlig rengjøring av leilighet',
    description:
      'Vanlig rengjøring av leilighet: støvsuging, vask av gulv, bad og kjøkken. Ca. 60 m².',
    duration: 'Omtrent 2–4 timer',
  },
];
