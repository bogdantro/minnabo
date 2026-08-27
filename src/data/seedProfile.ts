import type { AppNotification, Review } from '@/domain/types';
import { profiles } from './seed';

export const notificationsSeed: AppNotification[] = [
  {
    id: 'n1',
    kind: 'NEW_OFFER',
    title: 'Nytt tilbud fra Emma Larsen',
    body: 'Emma har sendt et tilbud på «Klippe plen».',
    createdAt: '2026-08-27T12:46:00Z',
    read: false,
    route: '/chat/c-emma',
  },
  {
    id: 'n2',
    kind: 'OFFER_ACCEPTED',
    title: 'Tilbud godtatt',
    body: 'Martin Solberg godtok tilbudet på «Hjelp med flytting».',
    createdAt: '2026-08-26T18:31:00Z',
    read: false,
    route: '/chat/c-martin',
  },
  {
    id: 'n3',
    kind: 'NEW_MESSAGE',
    title: 'Ny melding fra Sara Ahmed',
    body: '«Har du verktøy selv?»',
    createdAt: '2026-08-25T10:15:00Z',
    read: true,
    route: '/chat/c-sara',
  },
  {
    id: 'n4',
    kind: 'REVIEW_RECEIVED',
    title: 'Du fikk en vurdering',
    body: 'Jonas Berg ga deg 5 stjerner.',
    createdAt: '2026-08-20T09:00:00Z',
    read: true,
    route: '/profil',
  },
];

export const reviewsSeed: Review[] = [
  {
    id: 'r1',
    agreementProposalId: 'p-old-1',
    listingId: 'l-klippe-plen',
    fromProfileId: profiles.jonas.id,
    toProfileId: profiles.mb.id,
    rating: 5,
    comment: 'Ryddig og punktlig. Anbefales!',
    createdAt: '2026-08-20T09:00:00Z',
  },
  {
    id: 'r2',
    agreementProposalId: 'p-old-2',
    listingId: 'l-flytting',
    fromProfileId: profiles.emma.id,
    toProfileId: profiles.mb.id,
    rating: 4,
    comment: 'God hjelp med monteringen.',
    createdAt: '2026-07-11T14:00:00Z',
  },
  {
    id: 'r3',
    agreementProposalId: 'p-old-3',
    listingId: 'l-tilbyr-gressklipping',
    fromProfileId: profiles.mb.id,
    toProfileId: profiles.andreas.id,
    rating: 5,
    comment: 'Kjempefin plen etterpå.',
    createdAt: '2026-06-30T16:00:00Z',
  },
];
