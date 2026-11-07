/**
 * Stands in for src/api/client.ts under `npm run test-login`: the in-memory demo data from the Jest
 * tests, plus examples of the newest features, so there is something to look at on every screen.
 * Everything you do lasts until you reload the page.
 */
import type { MyAccount } from '../../src/api/ApiClient';
import { chatRepository } from '../../tests/mocks/data/chatRepository';
import { noticeboardStore } from '../../tests/mocks/data/noticeboardStore';
import { repositories } from '../../tests/mocks/data/repositories';
import { MockApiClient, extras } from '../../tests/mocks/mockClient';
import { testPerson, TEST_USER_ID } from './store';

const HOUR = 60 * 60 * 1000;
const hours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();
const day = (d: number) => new Date(Date.now() + d * 24 * HOUR).toISOString().slice(0, 10);

class TestClient extends MockApiClient {
  async getMyAccount(): Promise<MyAccount> {
    const youth = testPerson.get() === 'youth';
    return {
      vipps: true,
      youth,
      age: youth ? 16 : 34,
      birthYear: youth ? 2010 : 1992,
      fullName: 'Marius Berg',
      phoneMasked: '+47 ••• •• 234',
      emailMasked: 'm•••@gmail.com',
    };
  }
}

extras.questions = [
  { id: 'q1', listingId: 'l-tilbyr-gressklipping', authorId: 'u-emma', body: 'Hvor stor er plenen omtrent?', answer: 'Rundt 300 m². Klipperen står i garasjen.', answeredAt: hours(-3), createdAt: hours(-5) },
  { id: 'q2', listingId: 'l-tilbyr-gressklipping', authorId: 'u-martin', body: 'Må gresset samles opp?', createdAt: hours(-1) },
];
const moving = repositories.listings.get('l-flytting');
if (moving) moving.helpersNeeded = 2;
extras.slots['l-flytting'] = { needed: 2, taken: 1 };
extras.recap = { year: new Date().getFullYear(), helped: 14, gotHelp: 3, neighbours: 11, thanks: 6, topCategory: 'hage', stars: 4.9 };
extras.agreedSum = {
  year: new Date().getFullYear(),
  totalMinor: 985000,
  jobs: 9,
  people: [
    { name: 'Kari Holm', minor: 720000, jobs: 5 },
    { name: 'Per Olsen', minor: 180000, jobs: 3 },
    { name: 'Emma Larsen', minor: 85000, jobs: 1 },
  ],
};
extras.thanks = [{ id: 't1', proposalId: 'p', fromProfileId: 'u-emma', toProfileId: TEST_USER_ID, card: 'SAVED', message: 'Tusen takk for hjelpen!', createdAt: hours(-30) }];

// a chat that shows the warnings, a link, a reply and a deleted message
const link = chatRepository.sendMessage('c-emma', 'Se finn.no/123 for bilder, eller ring 912 34 567.');
link.authorProfileId = 'u-emma';
const scam = chatRepository.sendMessage('c-emma', 'Bare send forskudd på 300 kr til kontonummer 1234.56.78903 først.');
scam.authorProfileId = 'u-emma';
const reply = chatRepository.sendMessage('c-emma', 'Hmm, det høres rart ut.');
reply.replyToId = scam.id;
chatRepository.sendMessage('c-emma', '').deletedAt = hours(0);

const dugnad = noticeboardStore.create({ kind: 'GENERAL', title: 'Dugnad i Kirkegata', body: 'Vi raker løv og rydder fellesarealet. Kaffe og vafler til alle.', place: 'Sentrum', municipality: 'Lillehammer' } as never);
Object.assign(dugnad, { isDugnad: true, eventAt: hours(50), authorProfileId: 'u-emma' });
extras.signups[dugnad.id] = ['u-emma', 'u-martin', 'u-andreas'];
const tool = noticeboardStore.create({ kind: 'TOOL_LEND', title: 'Låner ut høytrykksspyler', body: 'Kärcher, fungerer fint. Hentes på Stampesletta.', place: 'Stampesletta', municipality: 'Lillehammer' } as never);
Object.assign(tool, { authorProfileId: TEST_USER_ID });
extras.bookings = [{ id: 'b1', noticeId: tool.id, borrowerId: 'u-emma', from: day(5), to: day(7), note: 'Skal male gjerdet', status: 'PENDING' }];

// the board as a real group: photos, hearts and answers
const bike = noticeboardStore.list().find((p) => p.title.startsWith('Gis bort: barnesykkel'));
if (bike) Object.assign(noticeboardStore.get(bike.id) ?? {}, { imageUrl: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=900', likes: 7 });
if (bike) noticeboardStore.addComment(bike.id, 'Er den fortsatt ledig? Passer perfekt til datteren min.', 'u-martin');
Object.assign(dugnad, { likes: 12 });

export const apiClient = new TestClient();
export type { ApiClient } from '../../src/api/ApiClient';
