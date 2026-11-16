/**
 * Stands in for src/api/client.ts under `npm run test-login`: the in-memory demo data from the Jest
 * tests, plus examples of the newest features, so there is something to look at on every screen.
 * Everything you do lasts until you reload the page.
 */
import type { MyAccount } from '../../src/api/ApiClient';
import { chatRepository } from '../../tests/mocks/data/chatRepository';
import { noticeboardStore } from '../../tests/mocks/data/noticeboardStore';
import { profileRepository } from '../../tests/mocks/data/profileRepository';
import { repositories } from '../../tests/mocks/data/repositories';
import { MockApiClient, extras } from '../../tests/mocks/mockClient';
import { partners } from '../../tests/mocks/data/seedCommunity';
import { community } from '../../tests/mocks/mockCommunity';
import { inbox } from '../../tests/mocks/mockInbox';
import { chatDrafts } from '../../src/lib/chatDrafts';
import { neighbourhoodStore } from '../../tests/mocks/data/neighbourhoodStore';
import { testPerson, TEST_USER_ID } from './store';

const HOUR = 60 * 60 * 1000;
const hours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();
const day = (d: number) => new Date(Date.now() + d * 24 * HOUR).toISOString().slice(0, 10);

/** Microlink reads a page's title and picture and allows browsers to ask (CORS). Test login only. */
const PREVIEW_SERVICE = 'https://api.microlink.io/?url=';
const PREVIEW_TIMEOUT_MS = 6000;

class TestClient extends MockApiClient {
  /** Real cards for any link in the test login; the app itself uses the link-preview edge function. */
  async linkPreview(url: string) {
    const demo = await super.linkPreview(url);
    if (demo) return demo;
    try {
      const res = await fetch(PREVIEW_SERVICE + encodeURIComponent(url), { signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS) });
      const body = (await res.json()) as { status?: string; data?: { title?: string; description?: string; publisher?: string; url?: string; image?: { url?: string } } };
      const d = body.status === 'success' ? body.data : undefined;
      if (!d?.title) return null;
      const final = d.url || url;
      return {
        url: final,
        host: new URL(final).hostname.replace(/^www\./, ''),
        title: d.title.slice(0, 160),
        description: d.description ? d.description.slice(0, 240) : null,
        site: d.publisher ?? null,
        image: d.image?.url?.startsWith('https://') ? d.image.url : null,
      };
    } catch {
      return null;
    }
  }

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

// the board as a real group: photos, hearts and answers
const bike = noticeboardStore.list().find((p) => p.title.startsWith('Gis bort: barnesykkel'));
if (bike) Object.assign(noticeboardStore.get(bike.id) ?? {}, { imageUrl: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=900', likes: 7 });
if (bike) noticeboardStore.addComment(bike.id, 'Er den fortsatt ledig? Passer perfekt til datteren min.', 'u-martin');
Object.assign(dugnad, { likes: 12 });

// 2026-11-09 batch: several photos, a reply to a reply, «Er dette fortsatt aktuelt?», link cards, review photos
if (bike) {
  Object.assign(noticeboardStore.get(bike.id) ?? {}, {
    imageUrls: [
      'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=900',
      'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=900',
      'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=900',
      'https://images.unsplash.com/photo-1511994298241-608e28f14fde?w=900',
      'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=900',
    ],
  });
  const asked = noticeboardStore.comments(bike.id)[0];
  if (asked) noticeboardStore.addComment(bike.id, 'Ja, den er ledig! Du kan hente i kveld.', 'u-emma', asked.id);
}
const sofa = noticeboardStore.create({ kind: 'GIVEAWAY', title: 'Gis bort: grå sofa', body: 'Tre-seter, litt slitt men god. Må hentes.', place: 'Nordre Ål', municipality: 'Lillehammer' } as never);
Object.assign(sofa, { authorProfileId: TEST_USER_ID, createdAt: hours(-15 * 24), stillAskedAt: hours(-2) });
const yr = chatRepository.sendMessage('c-emma', 'Det er meldt fint vær: https://www.yr.no/nb/værvarsel/daglig-tabell/1-2297810/Norge/Innlandet/Lillehammer/Lillehammer');
yr.authorProfileId = 'u-emma';
const myReviews = profileRepository.listReviewsForProfile(TEST_USER_ID);
if (myReviews[0]) Object.assign(myReviews[0], { imageUrls: ['https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600', 'https://images.unsplash.com/photo-1599685315640-4a9ba2613f46?w=600'] });

// 2026-11-11 batch (0101): fast avtale, arrangementer, avstemning, kø, utlån, ferdigheter, fordeler, husstand, foresatt
extras.settings = { ...extras.settings, aiEnabled: true };
const flytt = chatRepository.getAgreement('p-martin-flytting');
if (flytt) Object.assign(flytt, { scheduledAt: hours(-6 * 24 + 2), repeatEveryDays: 14, repeatUntil: day(60) });
const lopp = noticeboardStore.create({
  kind: 'GENERAL',
  title: 'Loppemarked i Storgata',
  body: 'Rydd boden og ta med det du vil selge! Bord står klare fra kl. 11. Kaffe og kake til alle.',
  place: 'Sentrum',
  municipality: 'Lillehammer',
  eventType: 'LOPPEMARKED',
  eventAt: hours(4 * 24 + 3),
});
Object.assign(lopp, { authorProfileId: 'u-emma', imageUrl: 'https://images.unsplash.com/photo-1532635241-17e820acc59f?w=900', imageUrls: ['https://images.unsplash.com/photo-1532635241-17e820acc59f?w=900'] });
extras.rsvp[lopp.id] = { 'u-martin': 'GOING', 'u-andreas': 'GOING', 'u-jonas': 'MAYBE', [TEST_USER_ID]: 'GOING' };
extras.eventMessages = [
  { id: 'em-1', noticeId: lopp.id, authorProfileId: 'u-emma', body: 'Hei alle! Jeg har med to bord ekstra hvis noen trenger.', createdAt: hours(-20) },
  { id: 'em-2', noticeId: lopp.id, authorProfileId: 'u-martin', body: 'Supert, jeg tar ett. Kommer litt før 11.', createdAt: hours(-19) },
];
const quiz = noticeboardStore.create({ kind: 'GENERAL', title: 'Quizkveld i grendehuset', body: 'Lag på 2–4. Premie til vinnerne!', place: 'Nordre Ål', municipality: 'Lillehammer', eventType: 'QUIZ', eventAt: hours(9 * 24 + 8) });
Object.assign(quiz, { authorProfileId: 'u-andreas' });
const poll = noticeboardStore.create({
  kind: 'GENERAL',
  title: 'Når passer vårdugnaden best?',
  body: 'Styret i velforeningen vil gjerne vite hvilken helg flest kan.',
  place: 'Sentrum',
  municipality: 'Lillehammer',
  pollOptions: ['Lørdag 25. april', 'Søndag 26. april', 'Helgen etter'],
});
Object.assign(poll, { authorProfileId: 'u-martin', createdAt: hours(-30) });
extras.votes[poll.id] = { 'u-emma': 0, 'u-andreas': 0, 'u-jonas': 1 };
if (bike) {
  extras.queues[bike.id] = [{ profileId: 'u-andreas', status: 'OFFERED', createdAt: hours(-4) }];
  extras.reactions[bike.id] = [
    { profileId: 'u-martin', emoji: '👍' },
    { profileId: 'u-andreas', emoji: '👍' },
    { profileId: 'u-jonas', emoji: '🎉' },
  ];
}
extras.queues[sofa.id] = [
  { profileId: 'u-martin', status: 'OFFERED', createdAt: hours(-10) },
  { profileId: 'u-jonas', status: 'QUEUED', createdAt: hours(-8) },
];
extras.lendItems = [
  { id: 'li-1', ownerId: 'u-emma', title: 'Stige 3 meter', category: 'VERKTOY', note: 'Aluminium. Hentes på Stampesletta.', imageUrl: 'https://images.unsplash.com/photo-1597484661643-2f5fef640dd1?w=600', municipality: 'Lillehammer', active: true, createdAt: hours(-50) },
  { id: 'li-2', ownerId: 'u-martin', title: 'Tilhenger', category: 'TRANSPORT', note: 'Vanlig 750 kg-henger.', municipality: 'Lillehammer', active: true, createdAt: hours(-80) },
  { id: 'li-3', ownerId: 'u-andreas', title: 'Høytrykksspyler', category: 'HAGE', municipality: 'Lillehammer', active: true, createdAt: hours(-90) },
  { id: 'li-4', ownerId: 'u-emma', title: 'Telt for fire', category: 'FRITID', municipality: 'Lillehammer', active: true, createdAt: hours(-100) },
  { id: 'li-5', ownerId: TEST_USER_ID, title: 'Vaffeljern', category: 'KJOKKEN', note: 'Hjerteformet. Ta det med tilbake rent.', municipality: 'Lillehammer', active: true, createdAt: hours(-40) },
];
extras.lendRequests = [
  { id: 'lr-1', itemId: 'li-5', itemTitle: 'Vaffeljern', ownerId: TEST_USER_ID, borrowerId: 'u-jonas', fromDate: day(3), toDate: day(4), note: 'Til bursdagen til datteren min!', status: 'PENDING', createdAt: hours(-3) },
  // my own loan of Emma's ladder: accepted, with where to pick it up (0104)
  { id: 'lr-2', itemId: 'li-1', itemTitle: 'Stige 3 meter', ownerId: 'u-emma', borrowerId: TEST_USER_ID, fromDate: day(2), toDate: day(3), note: 'Skal rense takrennene.', status: 'ACCEPTED', reply: 'Hentes i garasjen etter kl. 17. Den står til venstre for døra.', createdAt: hours(-20) },
  // the trailer is out today
  { id: 'lr-3', itemId: 'li-2', itemTitle: 'Tilhenger', ownerId: 'u-martin', borrowerId: 'u-andreas', fromDate: day(0), toDate: day(1), status: 'ACCEPTED', createdAt: hours(-30) },
  // asked on the board: a «Lån ut» oppslag is a thing on Utlån too (0107)
  { id: 'lr-4', itemId: `li-${tool.id}`, itemTitle: tool.title, ownerId: TEST_USER_ID, borrowerId: 'u-emma', fromDate: day(5), toDate: day(7), note: 'Skal male gjerdet', status: 'PENDING', createdAt: hours(-1) },
];
extras.categoryJobs[TEST_USER_ID] = [
  { categorySlug: 'hage', jobs: 7 },
  { categorySlug: 'snomaking', jobs: 3 },
  { categorySlug: 'flytting', jobs: 1 },
];
extras.categoryJobs['u-andreas'] = [
  { categorySlug: 'montering', jobs: 12 },
  { categorySlug: 'maling', jobs: 5 },
];
const fjellbygg = partners.find((p) => p.id === 'p-main-2');
if (fjellbygg) Object.assign(fjellbygg, { helperOffer: '15 % på verktøy og maling for naboer som hjelper', helperOfferUntil: day(45) });
const bank = partners.find((p) => p.id === 'p-main-1');
if (bank) Object.assign(bank, { helperOffer: 'Gratis kaffe i kundesenteret' });
extras.partnerCodes = { 'p-main-2': 'NABO15', 'p-main-1': 'KAFFE' };
// the adult test person follows one youth, so «Ungdom jeg følger» shows in Meny
if (testPerson.get() !== 'youth') extras.guardian = { ...extras.guardian, youths: [{ id: 'link-1', name: 'Ola N.', age: 16 }] };
extras.guardianYouths = [
  {
    id: 'u-ola',
    name: 'Ola Nordmann',
    age: 16,
    agreements: [{ title: 'Måke snø i oppkjørselen', with: 'Kari Holm', scheduledAt: hours(26), place: 'Nordre Ål' }],
    trip: { startedAt: hours(-1), dueAt: hours(1) },
  },
];
// «Vis på norsk»: a message in English from Emma
const english = chatRepository.sendMessage('c-emma', 'Hi! I can bring my own lawn mower if that helps. Is Saturday morning okay?');
english.authorProfileId = 'u-emma';

// --- Fellesskap (0108) ---
// the test person is in Sentrum, and is a vert there, so «Nye naboer», husregler and «Fest» can be tried
neighbourhoodStore.joinById('nb-1', TEST_USER_ID);
community.hosts['nb-1'] = [TEST_USER_ID, 'u-emma'];
community.rules['nb-1'] = 'Hold det vennlig og lokalt. Ingen reklame. Del aldri full adresse i et oppslag.';
community.intros['nb-1'] = {
  'u-jonas': { intro: 'Jonas, flyttet hit i oktober med kona og to katter.', showAsNew: true, joinedAt: hours(-5 * 24) },
  'u-andreas': { intro: 'Andreas – snekker, hjelper gjerne med små reparasjoner.', showAsNew: true, joinedAt: hours(-12 * 24) },
};
community.myOrgs = ['org-lil-il'];
const pet = noticeboardStore.create({ kind: 'GENERAL', topic: 'PET', title: 'Grå katt savnet ved Søre Ål', body: 'Pus har vært borte siden i går kveld. Grå med hvit pote, veldig snill.', place: 'Søre Ål', municipality: 'Lillehammer' });
Object.assign(pet, { authorProfileId: 'u-emma', createdAt: hours(-2) });
const outage = noticeboardStore.create({ kind: 'GENERAL', topic: 'OUTAGE', title: 'Strømmen er borte på Nordre Ål', body: 'Gikk for en halvtime siden. Noen andre?', place: 'Nordre Ål', municipality: 'Lillehammer' });
Object.assign(outage, { authorProfileId: 'u-martin', createdAt: hours(-1) });
community.metoo[outage.id] = ['u-jonas', 'u-andreas'];
const rec = noticeboardStore.create({ kind: 'GENERAL', topic: 'RECOMMEND', title: 'Beste frisør i sentrum?', body: 'Ny i byen og trenger en god frisør. Tips?', place: 'Sentrum', municipality: 'Lillehammer' });
Object.assign(rec, { authorProfileId: 'u-jonas', createdAt: hours(-26) });
const c1 = noticeboardStore.addComment(rec.id, 'Salong Hår i Storgata – alltid fornøyd!', 'u-emma');
noticeboardStore.addComment(rec.id, 'Prøv Klipp & Co ved Lilletorget.', 'u-andreas');
community.commentLikes[c1.id] = ['u-martin', 'u-andreas', 'u-jonas'];
const ride = noticeboardStore.create({ kind: 'GENERAL', topic: 'RIDE', title: 'Kjører til Hamar lørdag kl. 10', body: 'Plass til to. Tilbake rundt kl. 15.', place: 'Sentrum', municipality: 'Lillehammer' });
Object.assign(ride, { authorProfileId: 'u-andreas', createdAt: hours(-5) });
community.items[lopp.id] = [
  { id: 'ei-1', label: 'Bord og stoler', needed: 3, createdBy: 'u-emma', takers: [], takersIds: ['u-martin'] },
  { id: 'ei-2', label: 'Kaffe og kake', needed: null, createdBy: 'u-emma', takers: [], takersIds: ['u-andreas'] },
  { id: 'ei-3', label: 'Skjøteledning', needed: null, createdBy: 'u-emma', takers: [], takersIds: [] },
];
const neighbourOffer = partners.find((p) => p.id === 'p-main-2');
if (neighbourOffer) Object.assign(neighbourOffer, { offer: '10 % på maling og beis for alle naboer i november.' });

// --- Innboks (0109) ---
inbox.flags['c-fjellbygg'] = { pinnedAt: hours(-1) };
inbox.status['u-martin'] = { awayUntil: day(4), hideOnline: false, readReceipts: true };
inbox.scheduled.push({ id: 'sm-1', conversationId: 'c-emma', text: 'God morgen! Jeg er klar kl. 17 som avtalt.', sendAt: hours(16) });
chatDrafts.set('c-sara', 'Ja, jeg har drill og vater');

export const apiClient = new TestClient();
export type { ApiClient } from '../../src/api/ApiClient';
