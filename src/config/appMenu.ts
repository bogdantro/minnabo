import type { IconName } from '@/components/ui/Icon';

export type AppMenuItem = {
  label: string;
  icon: IconName;
  route: string;
};

export type AppMenuSection = {
  title: string;
  items: AppMenuItem[];
};

/**
 * Every page in the app, shown in the Meny popup (not a tab of its own).
 */
export const appMenu: AppMenuSection[] = [
  {
    title: 'Utforsk',
    items: [
      { label: 'Oppdrag', icon: 'clipboard', route: '/' },
      { label: 'Fellesskap', icon: 'users', route: '/fellesskap' },
      { label: 'Innboks', icon: 'message-circle', route: '/innboks' },
      { label: 'Legg ut', icon: 'plus-circle', route: '/legg-ut' },
    ],
  },
  {
    title: 'Mitt',
    items: [
      { label: 'Min profil', icon: 'user', route: '/profil' },
      { label: 'Mine oppdrag og tjenester', icon: 'briefcase', route: '/mine' },
      { label: 'Mottatte tilbud', icon: 'inbox', route: '/tilbud' },
      { label: 'Lagrede oppføringer og søk', icon: 'heart', route: '/lagrede' },
      { label: 'Varsler', icon: 'bell', route: '/varsler' },
    ],
  },
  {
    title: 'Tillit og trygghet',
    items: [
      { label: 'Vurderinger og verifisering', icon: 'shield', route: '/verifisering' },
      { label: 'Sikkerhet, rapportering og blokkering', icon: 'alert-octagon', route: '/sikkerhet' },
    ],
  },
  {
    title: 'Innstillinger',
    items: [
      { label: 'Innstillinger', icon: 'settings', route: '/innstillinger' },
      { label: 'Personvern', icon: 'lock', route: '/personvern' },
      { label: 'Vilkår', icon: 'file-text', route: '/vilkar' },
      { label: 'Varslinger', icon: 'bell', route: '/varslinger' },
      { label: 'For bedrifter', icon: 'home', route: '/bedrift' },
    ],
  },
];
