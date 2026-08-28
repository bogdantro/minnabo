import type { Conversation, Message, Proposal } from '@/domain/types';
import { nok } from '@/domain/price';
import { profiles, listings } from './seed';

const CURRENT_USER_ID = profiles.mb.id;
export { CURRENT_USER_ID };

const klippePlen = listings.find((l) => l.id === 'l-klippe-plen')!;
const flytting = listings.find((l) => l.id === 'l-flytting')!;
const garderobe = listings.find((l) => l.id === 'l-montere-garderobe')!;

export const proposals: Proposal[] = [
  {
    id: 'p-emma-klippe',
    listingId: klippePlen.id,
    conversationId: 'c-emma',
    fromProfileId: profiles.emma.id,
    toProfileId: CURRENT_USER_ID,
    price: nok(600),
    message: 'Jeg kan gjøre jobben for 600 kr.',
    scheduledText: 'I morgen kl. 17:00',
    status: 'SENT',
    createdAt: '2026-08-27T12:46:00Z',
  },
  {
    id: 'p-martin-flytting',
    listingId: flytting.id,
    conversationId: 'c-martin',
    fromProfileId: profiles.martin.id,
    toProfileId: CURRENT_USER_ID,
    price: nok(1500),
    message: 'Vi to stiller lørdag kl. 10.',
    scheduledText: 'Lørdag kl. 10:00',
    status: 'ACCEPTED',
    createdAt: '2026-08-26T15:00:00Z',
  },
  {
    id: 'p-fjellbygg-mur',
    listingId: 'l-mur',
    conversationId: 'c-fjellbygg',
    fromProfileId: profiles.fjellbygg.id,
    toProfileId: CURRENT_USER_ID,
    price: nok(4200),
    message: 'Tilbud på mindre murarbeid, inkl. materialer.',
    scheduledText: 'Neste uke',
    status: 'SENT',
    createdAt: '2026-08-24T09:00:00Z',
  },

  // Three competing proposals on my own listing "Male gjerdet"
  {
    id: 'p-gjerde-andreas',
    listingId: 'l-male-gjerdet',
    conversationId: 'c-gjerde-andreas',
    fromProfileId: profiles.andreas.id,
    toProfileId: CURRENT_USER_ID,
    price: nok(2200),
    message: 'Jeg kan male gjerdet på lørdag. Har egen maling om ønskelig.',
    scheduledText: 'Lørdag kl. 09:00',
    caveats: 'Forutsetter tørt vær',
    status: 'SENT',
    createdAt: '2026-08-21T10:00:00Z',
  },
  {
    id: 'p-gjerde-emma',
    listingId: 'l-male-gjerdet',
    conversationId: 'c-gjerde-emma',
    fromProfileId: profiles.emma.id,
    toProfileId: CURRENT_USER_ID,
    price: nok(2600),
    message: 'Grundig jobb, to strøk. Kan starte søndag morgen.',
    scheduledText: 'Søndag kl. 08:00',
    status: 'SENT',
    createdAt: '2026-08-21T14:30:00Z',
  },
  {
    id: 'p-gjerde-martin',
    listingId: 'l-male-gjerdet',
    conversationId: 'c-gjerde-martin',
    fromProfileId: profiles.martin.id,
    toProfileId: CURRENT_USER_ID,
    price: nok(1900),
    message: 'Rask og rimelig. Ett strøk hvis det holder.',
    scheduledText: 'Fredag ettermiddag',
    status: 'SENT',
    createdAt: '2026-08-22T09:15:00Z',
  },
];

export const conversations: Conversation[] = [
  {
    id: 'c-emma',
    listing: { id: klippePlen.id, title: klippePlen.title, type: klippePlen.type, place: 'Lillehammer', imageUrl: klippePlen.images[0]?.url },
    counterpart: { ...profiles.emma, online: true },
    lastMessagePreview: 'Hei! Jeg kan komme i morgen kl. 17.',
    lastMessageAt: '2026-08-27T12:42:00Z',
    unread: true,
    statusTag: 'NEW_OFFER',
  },
  {
    id: 'c-martin',
    listing: { id: flytting.id, title: flytting.title, type: flytting.type, place: 'Lillehammer', imageUrl: flytting.images[0]?.url },
    counterpart: profiles.martin,
    lastMessagePreview: 'Da er vi enige om 1 500 kr.',
    lastMessageAt: '2026-08-26T18:30:00Z',
    unread: false,
    statusTag: 'OFFER_ACCEPTED',
  },
  {
    id: 'c-sara',
    listing: { id: garderobe.id, title: 'Montere garderobe', type: garderobe.type, place: 'Lillehammer', imageUrl: garderobe.images[0]?.url },
    counterpart: profiles.andreas,
    lastMessagePreview: 'Har du verktøy selv?',
    lastMessageAt: '2026-08-25T10:15:00Z',
    unread: false,
    statusTag: null,
  },
  {
    id: 'c-fjellbygg',
    listing: { id: 'l-mur', title: 'Mindre murarbeid', type: 'TASK_REQUEST', place: 'Lillehammer' },
    counterpart: profiles.fjellbygg,
    lastMessagePreview: 'Vi har sendt deg et tilbud.',
    lastMessageAt: '2026-08-24T09:01:00Z',
    unread: true,
    statusTag: 'NEW_OFFER',
  },
];

export const messagesByConversation: Record<string, Message[]> = {
  'c-emma': [
    m('m1', 'c-emma', profiles.emma.id, 'Hei! Jeg kan klippe plenen i morgen kl. 17.', '2026-08-27T12:42:00Z'),
    m('m2', 'c-emma', CURRENT_USER_ID, 'Hei! Det passer bra. Har du med egen gressklipper?', '2026-08-27T12:44:00Z', 'READ'),
    m('m3', 'c-emma', profiles.emma.id, 'Ja, det har jeg. Jeg kan gjøre jobben for 600 kr.', '2026-08-27T12:45:00Z'),
    { id: 'm4', conversationId: 'c-emma', authorProfileId: profiles.emma.id, text: '', kind: 'PROPOSAL', proposalId: 'p-emma-klippe', createdAt: '2026-08-27T12:46:00Z', delivery: 'DELIVERED' },
  ],
  'c-martin': [
    m('mm1', 'c-martin', CURRENT_USER_ID, 'Hei! Kan dere hjelpe med flytting på lørdag?', '2026-08-26T14:35:00Z', 'READ'),
    m('mm2', 'c-martin', profiles.martin.id, 'Ja, vi to kan stille kl. 10.', '2026-08-26T14:50:00Z'),
    { id: 'mm3', conversationId: 'c-martin', authorProfileId: profiles.martin.id, text: '', kind: 'PROPOSAL', proposalId: 'p-martin-flytting', createdAt: '2026-08-26T15:00:00Z', delivery: 'READ' },
    m('mm4', 'c-martin', CURRENT_USER_ID, 'Da er vi enige om 1 500 kr.', '2026-08-26T18:30:00Z', 'READ'),
    { id: 'mm5', conversationId: 'c-martin', authorProfileId: 'system', text: 'Tilbud godtatt', kind: 'SYSTEM', createdAt: '2026-08-26T18:31:00Z', delivery: 'READ' },
  ],
  'c-sara': [
    m('ms1', 'c-sara', profiles.andreas.id, 'Hei! Jeg kan montere garderoben.', '2026-08-25T09:50:00Z'),
    m('ms2', 'c-sara', profiles.andreas.id, 'Har du verktøy selv?', '2026-08-25T10:15:00Z'),
  ],
  'c-fjellbygg': [
    m('mf1', 'c-fjellbygg', CURRENT_USER_ID, 'Hei! Trenger hjelp med litt murarbeid ved inngangen.', '2026-08-24T08:30:00Z', 'READ'),
    m('mf2', 'c-fjellbygg', profiles.fjellbygg.id, 'Hei! Vi har sendt deg et tilbud.', '2026-08-24T09:00:00Z'),
    { id: 'mf3', conversationId: 'c-fjellbygg', authorProfileId: profiles.fjellbygg.id, text: '', kind: 'PROPOSAL', proposalId: 'p-fjellbygg-mur', createdAt: '2026-08-24T09:01:00Z', delivery: 'DELIVERED' },
  ],
};

function m(
  id: string,
  conversationId: string,
  authorProfileId: string,
  text: string,
  createdAt: string,
  delivery: Message['delivery'] = 'DELIVERED',
): Message {
  return { id, conversationId, authorProfileId, text, kind: 'TEXT', createdAt, delivery };
}
