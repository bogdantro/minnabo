/**
 * Attachments on a message from MinNabo (0111): buttons to a place in the app, and cards for a business,
 * a nabolag or a lag. The website (Admin › Chats) only sends a key; this list decides where it goes,
 * so a key the app doesn't know (a newer website) is left out instead of opening a broken page.
 *
 * Keep the keys in step with the website's list (minnaboweb apps/adminportal/chat_links.py).
 */
import type { IconName } from '@/components/ui';
import type { MinNaboAttachment } from '@/api/ApiClient';

type Place = {
  path: string;
  /** youth go somewhere else (their home is /ung) */
  youthPath?: string;
  label: string;
  icon: IconName;
  /** youth can't use it (product rule 5), so they never see the button */
  adultsOnly?: boolean;
};

export const MINNABO_PLACES: Record<string, Place> = {
  oppdrag: { path: '/', youthPath: '/ung', label: 'Se oppdrag', icon: 'list' },
  fellesskap: { path: '/fellesskap', label: 'Se Fellesskap', icon: 'users' },
  innboks: { path: '/innboks', label: 'Åpne Innboks', icon: 'msg' },
  profil: { path: '/profil', label: 'Se profilen din', icon: 'user' },
  kommune: { path: '/profil/rediger', label: 'Velg kommune', icon: 'pin' },
  nabolag: { path: '/nabolag', label: 'Bli med i et nabolag', icon: 'home' },
  oppslagstavle: { path: '/oppslagstavle', label: 'Se Oppslagstavla', icon: 'pinned' },
  legg_ut: { path: '/legg-ut', label: 'Legg ut et oppdrag', icon: 'plus', adultsOnly: true },
  tilbyr: { path: '/legg-ut/tilbyr', label: 'Tilby hjelp', icon: 'hand' },
  utlan: { path: '/utlan', label: 'Se Utlån', icon: 'montering' },
  foreninger: { path: '/foreninger', label: 'Lag og foreninger', icon: 'award' },
  prosjekter: { path: '/prosjekter', label: 'Nabolagsprosjekter', icon: 'hand' },
  ukas_bilde: { path: '/ukas-bilde', label: 'Ukas bilde', icon: 'camera' },
  naboskap: { path: '/naboskap', label: 'Språkvenn og vennetjeneste', icon: 'smile', adultsOnly: true },
  sesongsjekk: { path: '/sesongsjekk', label: 'Sesongsjekk', icon: 'home', adultsOnly: true },
  varslinger: { path: '/varslinger', label: 'Velg varsler', icon: 'bell' },
  sok: { path: '/sok', label: 'Søk', icon: 'search' },
  sikkerhet: { path: '/sikkerhet', label: 'Trygghet', icon: 'shield' },
  hjelp: { path: '/hjelp', label: 'Hjelp og svar', icon: 'info' },
};

export type MinNaboLink =
  | { kind: 'button'; key: string; label: string; icon: IconName; path: string }
  | { kind: 'card'; key: string; type: 'partner' | 'nabolag' | 'lag'; name: string; sub?: string; logo?: string; cta: string; path: string };

const CARD_CTA = { partner: 'Se bedriften', nabolag: 'Se nabolaget', lag: 'Se laget' } as const;

/** What one message shows, in the order MinNabo put them; unknown keys and youth-locked places drop out. */
export function minnaboLinks(attachments: MinNaboAttachment[] | undefined, youth: boolean): MinNaboLink[] {
  const out: MinNaboLink[] = [];
  (attachments ?? []).forEach((a, i) => {
    if (a.type === 'route') {
      const place = MINNABO_PLACES[a.key];
      if (!place || (youth && place.adultsOnly)) return;
      out.push({ kind: 'button', key: `${i}-${a.key}`, label: a.label || place.label, icon: place.icon, path: (youth && place.youthPath) || place.path });
      return;
    }
    if (!a.name) return;
    const path =
      a.type === 'partner'
        ? `/partner/${a.id}`
        : a.type === 'lag'
          ? `/foreninger?vis=${a.id}`
          : `/nabolag?place=${encodeURIComponent(a.place || a.name)}&kommune=${encodeURIComponent(a.sub ?? '')}`;
    out.push({ kind: 'card', key: `${i}-${a.id}`, type: a.type, name: a.name, sub: a.sub || undefined, logo: a.logo || undefined, cta: a.label || CARD_CTA[a.type], path });
  });
  return out;
}
