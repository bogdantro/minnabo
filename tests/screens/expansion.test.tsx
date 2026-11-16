/**
 * The 0101 expansion: fast avtale, PDFs, queue on «Gis bort», arrangementer, avstemning, reaksjoner,
 * utlån, chat search, «Vis på norsk», ferdighetsmerker, fordeler for hjelpere, foresatt, seniormodus.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '@/api/client';
import { extras } from '@mocks/mockClient';
import { noticeboardStore } from '@mocks/data/noticeboardStore';
import { profileRepository } from '@mocks/data/profileRepository';
import { currentVisit, isRepeating, monthEnds, nextVisit } from '@/domain/repeat';
import { agreementPdfHtml } from '@/lib/agreementPdf';
import { attestPdfHtml } from '@/lib/attestPdf';
import { attestInput } from '@/components/profile/AttestCard';
import { looksForeign } from '@/lib/language';
import { searchMessages, snippet } from '@/components/chat/ChatSearchSheet';
import { EventsCalendar, countdown, upcomingEvents } from '@/components/community/EventsCalendar';
import { activeHelperOffers } from '@/components/community/HelperPerks';
import { skillLevel } from '@/components/profile/SkillRings';
import { matchesLendSearch } from '@/screens/LendScreen';
import { tripState } from '@/screens/GuardianScreen';
import { noticeType } from '@/components/community/noticeKinds';
import { EventPanel, PollPanel, QueuePanel } from '@/components/noticeboard/NoticePanels';
import { seniorMode } from '@/lib/seniorMode';
import type { Message, NoticeboardPost, Partner, PublicProfile } from '@/domain/types';
import { renderWithProviders } from '../testUtils';

const DAY = 86_400_000;

beforeEach(() => {
  extras.reset();
  noticeboardStore._reset();
  seniorMode._reset();
});

// ------------------------------------------------------------------
// Fast avtale
// ------------------------------------------------------------------
describe('fast avtale', () => {
  const first = '2026-11-03T09:00:00.000Z';
  const base = { scheduledAt: first, repeatEveryDays: 7 as const };

  test('the next visit is a whole number of weeks after the first time', () => {
    expect(nextVisit(base, Date.parse('2026-11-12T12:00:00Z'))?.toISOString()).toBe('2026-11-17T09:00:00.000Z');
    expect(nextVisit(base, Date.parse('2026-11-01T12:00:00Z'))?.toISOString()).toBe(first);
  });

  test('no next visit after the last day of the season, and none when ended or cancelled', () => {
    expect(nextVisit({ ...base, repeatUntil: '2026-11-15' }, Date.parse('2026-11-12T12:00:00Z'))).toBeNull();
    expect(nextVisit({ ...base, repeatEndedAt: '2026-11-10T00:00:00Z' }, Date.parse('2026-11-12T12:00:00Z'))).toBeNull();
    expect(isRepeating({ ...base, cancelledAt: '2026-11-10T00:00:00Z' })).toBe(false);
  });

  test('a visit can be marked from 12 hours before, never one that is days away', () => {
    expect(currentVisit(base, Date.parse('2026-11-09T22:00:00Z'))?.toISOString()).toBe('2026-11-10T09:00:00.000Z');
    expect(currentVisit(base, Date.parse('2026-11-08T12:00:00Z'))?.toISOString()).toBe(first);
    expect(currentVisit(base, Date.parse('2026-11-02T12:00:00Z'))).toBeNull();
  });

  test('season ends are the last day of this and the next months', () => {
    expect(monthEnds(3, new Date(2026, 10, 12))).toEqual(['2026-11-30', '2026-12-31', '2027-01-31']);
  });

  test('a visit can be marked done once, and the list is newest first', async () => {
    await apiClient.markAgreementVisit('p1', '2026-11-03T09:00:00.000Z');
    await apiClient.markAgreementVisit('p1', '2026-11-10T09:00:00.000Z');
    await apiClient.markAgreementVisit('p1', '2026-11-10T09:00:00.000Z');
    expect(await apiClient.listAgreementVisits('p1')).toEqual(['2026-11-10T09:00:00.000Z', '2026-11-03T09:00:00.000Z']);
  });
});

// ------------------------------------------------------------------
// PDFs
// ------------------------------------------------------------------
describe('PDF', () => {
  test('the avtale PDF escapes what people typed and carries the payment note', () => {
    const html = agreementPdfHtml({
      title: 'Klippe <b>plen</b>',
      clientName: 'Kari',
      helperName: 'Ola',
      price: '500 kr',
      place: 'Sentrum',
      description: 'Ta med "rive" & sekker',
      agreedAt: '3. november 2026',
      madeAt: '12. november 2026',
    });
    expect(html).toContain('Klippe &lt;b&gt;plen&lt;/b&gt;');
    expect(html).not.toContain('<b>plen</b>');
    expect(html).toContain('&quot;rive&quot; &amp; sekker');
    expect(html).toContain('MinNabo håndterer ikke betaling');
    // empty rows are left out
    expect(html).not.toContain('Forbehold');
  });

  test('the attest has the figures, kinds of jobs, what neighbours say, and nothing about where the youth lives', () => {
    const profile = {
      id: 'u-ola',
      displayName: 'Ola Nordmann',
      location: { municipality: 'Lillehammer', place: 'Nordre Ål' },
      completedTasks: 4,
      rating: { average: 4.8, count: 3 },
      memberSince: '2026',
    } as unknown as PublicProfile;
    const reviews = [
      { rating: 5, comment: 'Kjempeflink og blid!', tags: ['Punktlig', 'Ryddig'], createdAt: '2026-10-02T10:00:00Z' },
      { rating: 4, comment: 'Grei <b>jobb</b>', tags: ['Punktlig'], createdAt: '2026-09-02T10:00:00Z' },
      { rating: 5, comment: 'Ikke godkjent ennå', createdAt: '2026-11-02T10:00:00Z', approval: 'PENDING' },
    ];
    const input = attestInput(profile, reviews, [{ categorySlug: 'hage', jobs: 3 }, { categorySlug: 'snomaking', jobs: 1 }], 100, new Date('2026-11-12'));
    expect(input.quotes.map((q) => q.text)).toEqual(['Kjempeflink og blid!', 'Grei <b>jobb</b>']);
    expect(input.tags).toEqual([{ label: 'Punktlig', count: 2 }, { label: 'Ryddig', count: 1 }]);
    const html = attestPdfHtml(input);
    expect(html).toContain('Ola Nordmann');
    expect(html).toContain('Ola har tatt småjobber for naboer i Nordre Ål');
    expect(html).toContain('4,8');
    expect(html).toContain('100 %');
    expect(html).toContain('Hage <em>3 jobber</em>');
    expect(html).toContain('«Kjempeflink og blid!»');
    expect(html).toContain('Grei &lt;b&gt;jobb&lt;/b&gt;');
    expect(html).not.toContain('Ikke godkjent');
    expect(html).not.toMatch(/telefon|adresse/i);
  });
});

// ------------------------------------------------------------------
// «Jeg vil ha den»
// ------------------------------------------------------------------
describe('queue on «Gis bort»', () => {
  test('the first in the queue gets it; «Kom ikke» moves it to the next; «Hentet» closes the oppslag', async () => {
    const id = 'n-seed-1';
    expect(await apiClient.reserveNotice(id, true)).toBe(1);
    extras.queues[id].push({ profileId: 'u-jonas', status: 'QUEUED', createdAt: new Date().toISOString() });
    expect((await apiClient.noticeQueue(id)).mine).toBe('OFFERED');
    // only the one who gives it away settles the queue
    await expect(apiClient.settleReservation(id, false)).rejects.toThrow('Ikke tilgang.');
    noticeboardStore._patch(id, { authorProfileId: profileRepository.currentUserId });
    await apiClient.settleReservation(id, false);
    expect(extras.queues[id].find((r) => r.profileId === 'u-jonas')?.status).toBe('OFFERED');
    await apiClient.settleReservation(id, true);
    expect(noticeboardStore.list().find((p) => p.id === id)?.doneAt).toBeTruthy();
  });

  test('you cannot queue for your own oppslag', async () => {
    const mine = noticeboardStore.create({ kind: 'GIVEAWAY', title: 'Gir bort stol', body: 'En fin stol', place: 'Sentrum', municipality: 'Lillehammer' });
    await expect(apiClient.reserveNotice(mine.id, true)).rejects.toThrow('Dette er ditt eget oppslag.');
  });

  test('the card shows my place and lets me leave the queue', async () => {
    const post = noticeboardStore.list().find((p) => p.id === 'n-seed-1')!;
    await renderWithProviders(<QueuePanel post={post} mine={false} authorFirst="Emma" onReply={() => undefined} />);
    await fireEvent.press(await screen.findByText('Jeg vil ha den'));
    expect(await screen.findByText('Du står først i køen')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ta meg ut av køen'));
    await waitFor(() => expect(screen.getByText('Jeg vil ha den')).toBeTruthy());
  });
});

// ------------------------------------------------------------------
// Arrangementer, avstemning, reaksjoner
// ------------------------------------------------------------------
describe('arrangement', () => {
  const event = (over: Partial<NoticeboardPost> = {}): NoticeboardPost => ({
    id: 'e1',
    kind: 'GENERAL',
    title: 'Loppemarked',
    body: 'Ta med det du vil selge',
    authorProfileId: 'u-emma',
    place: 'Sentrum',
    municipality: 'Lillehammer',
    createdAt: new Date().toISOString(),
    eventType: 'LOPPEMARKED',
    eventAt: new Date(Date.now() + 3 * DAY).toISOString(),
    ...over,
  });

  test('every kind of arrangement, dugnad too, is the type «Arrangement»', () => {
    expect(noticeType(event())).toBe('EVENT');
    expect(noticeType(event({ eventType: undefined, isDugnad: true }))).toBe('EVENT');
    expect(noticeType(event({ eventType: undefined }))).toBe('GENERAL');
  });

  test('«Kommer» then «Kanskje» counts once, and tapping again takes it back', async () => {
    noticeboardStore._patch('n-seed-3', {});
    const post = noticeboardStore.create({ kind: 'GENERAL', title: 'Quiz', body: 'Quiz i grendehuset', place: 'Sentrum', municipality: 'Lillehammer', eventType: 'QUIZ', eventAt: event().eventAt });
    noticeboardStore._patch(post.id, { authorProfileId: 'u-emma' });
    const fresh = noticeboardStore.list().find((p) => p.id === post.id)!;
    await renderWithProviders(<EventPanel post={fresh} mine={false} youth={false} now={Date.now()} />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Kommer' }));
    await waitFor(() => expect(screen.getByText('1 kommer')).toBeTruthy());
    await fireEvent.press(screen.getByRole('radio', { name: 'Kanskje' }));
    await waitFor(() => expect(screen.getByText('0 kommer · 1 kanskje')).toBeTruthy());
    // the group chat is there for someone who answered
    expect(screen.getByText('Gruppechat')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Kanskje, valgt' }));
    await waitFor(() => expect(screen.getByText('Ingen har svart ennå')).toBeTruthy());
  });

  test('a youth never gets the group chat', async () => {
    extras.guardian.youth = true;
    const post = noticeboardStore.create({ kind: 'GENERAL', title: 'Fest', body: 'Fest i gata', place: 'Sentrum', municipality: 'Lillehammer', eventType: 'FEST', eventAt: event().eventAt });
    await apiClient.setEventRsvp(post.id, 'GOING');
    expect(await apiClient.canUseEventChat(post.id)).toBe(false);
    await expect(apiClient.postEventMessage(post.id, 'Hei')).rejects.toThrow('Chatten er stengt.');
  });

  test('the calendar shows coming arrangements soonest first, not old or closed ones', () => {
    const now = Date.now();
    const list = [
      event({ id: 'later', eventAt: new Date(now + 10 * DAY).toISOString() }),
      event({ id: 'soon', eventAt: new Date(now + DAY).toISOString() }),
      event({ id: 'past', eventAt: new Date(now - 3 * DAY).toISOString() }),
      event({ id: 'closed', doneAt: new Date().toISOString() }),
      event({ id: 'plain', eventType: undefined }),
    ];
    expect(upcomingEvents(list, now).map((p) => p.id)).toEqual(['soon', 'later']);
  });
});

describe('«Skjer i nærheten»', () => {
  test('nothing is drawn when there is no arrangement coming', async () => {
    await renderWithProviders(<EventsCalendar posts={noticeboardStore.list()} now={Date.now()} />);
    expect(screen.queryByText('Skjer i nærheten')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  test('a tap opens everything about it, and «Kommer» works right there', async () => {
    const post = noticeboardStore.create({
      kind: 'GENERAL',
      title: 'Quizkveld i grendehuset',
      body: 'Lag på 2–4. Premie til vinnerne!',
      place: 'Nordre Ål',
      municipality: 'Lillehammer',
      eventType: 'QUIZ',
      eventAt: new Date(Date.now() + 3 * DAY).toISOString(),
    });
    noticeboardStore._patch(post.id, { authorProfileId: 'u-emma' });
    await renderWithProviders(<EventsCalendar posts={noticeboardStore.list()} now={Date.now()} />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Quizkveld i grendehuset/ }));
    expect(await screen.findByText('Lag på 2–4. Premie til vinnerne!')).toBeTruthy();
    expect(screen.getByText('Laget av')).toBeTruthy();
    expect(screen.getByText('Åpne oppslaget')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Kommer' }));
    await waitFor(() => expect(screen.getAllByText('1 kommer').length).toBeGreaterThan(0));
  });

  test('«Bli med» on the card puts me on the list without opening it', async () => {
    const post = noticeboardStore.create({
      kind: 'GENERAL', title: 'Dugnad i Kirkegata', body: 'Vi raker løv sammen.', place: 'Sentrum', municipality: 'Lillehammer',
      isDugnad: true, eventType: 'DUGNAD', eventAt: new Date(Date.now() + 2 * DAY).toISOString(),
    });
    noticeboardStore._patch(post.id, { authorProfileId: 'u-emma' });
    await renderWithProviders(<EventsCalendar posts={noticeboardStore.list()} now={Date.now()} />);
    expect(await screen.findByText('Bli den første')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Bli med på Dugnad i Kirkegata'));
    expect(await screen.findByText('Du kommer')).toBeTruthy();
    expect(screen.getByText('1 kommer')).toBeTruthy();
  });

  test('only arrangements still to come count: a cancelled or finished one is not shown', () => {
    const now = Date.now();
    const base = { kind: 'GENERAL' as const, body: 'Tekst her.', place: 'Sentrum', municipality: 'Lillehammer', eventType: 'DUGNAD' as const, isDugnad: true };
    const done = noticeboardStore.create({ ...base, title: 'Avlyst', eventAt: new Date(now + DAY).toISOString() });
    noticeboardStore._patch(done.id, { doneAt: new Date(now).toISOString() });
    noticeboardStore.create({ ...base, title: 'Ferdig', eventAt: new Date(now - 3 * 60 * 60 * 1000).toISOString() });
    expect(upcomingEvents(noticeboardStore.list(), now)).toHaveLength(0);
  });

  test('how soon: I dag, I morgen, then «Om N dager»', () => {
    const now = new Date(2026, 10, 13, 9).getTime();
    expect(countdown(new Date(2026, 10, 13, 19).toISOString(), now)).toBe('I dag');
    expect(countdown(new Date(2026, 10, 14, 8).toISOString(), now)).toBe('I morgen');
    expect(countdown(new Date(2026, 10, 18, 8).toISOString(), now)).toBe('Om 5 dager');
  });
});

describe('avstemning', () => {
  test('one vote each, it can be changed, and totals add up', async () => {
    const post = noticeboardStore.create({ kind: 'GENERAL', title: 'Dag?', body: 'Hvilken dag passer?', place: 'Sentrum', municipality: 'Lillehammer', pollOptions: ['Lørdag', 'Søndag'] });
    await renderWithProviders(<PollPanel post={post} now={Date.now()} />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Lørdag, 0 prosent' }));
    expect(await screen.findByRole('radio', { name: 'Lørdag, 100 prosent, din stemme' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Søndag, 0 prosent' }));
    expect(await screen.findByRole('radio', { name: 'Søndag, 100 prosent, din stemme' })).toBeTruthy();
    expect((await apiClient.noticePoll(post.id))?.total).toBe(1);
  });

  test('a choice that is not there is refused', async () => {
    const post = noticeboardStore.create({ kind: 'GENERAL', title: 'Dag?', body: 'Hvilken dag passer?', place: 'Sentrum', municipality: 'Lillehammer', pollOptions: ['Ja', 'Nei'] });
    await expect(apiClient.voteNoticePoll(post.id, 4)).rejects.toThrow('Ugyldig valg.');
  });

  test('a poll with one choice is not stored as a poll', () => {
    const post = noticeboardStore.create({ kind: 'GENERAL', title: 'Dag?', body: 'Hvilken dag passer?', place: 'Sentrum', municipality: 'Lillehammer', pollOptions: ['Ja'] });
    expect(post.pollOptions).toBeUndefined();
  });
});

describe('reaksjoner', () => {
  test('each emoji once per person, and it can be taken back', async () => {
    await apiClient.setNoticeReaction('n-seed-1', '👍', true);
    await apiClient.setNoticeReaction('n-seed-1', '👍', true);
    await apiClient.setNoticeReaction('n-seed-1', '🎉', true);
    expect(await apiClient.listNoticeReactions('n-seed-1')).toHaveLength(2);
    await apiClient.setNoticeReaction('n-seed-1', '👍', false);
    expect((await apiClient.listNoticeReactions('n-seed-1')).map((r) => r.emoji)).toEqual(['🎉']);
  });
});

// ------------------------------------------------------------------
// Utlån
// ------------------------------------------------------------------
describe('utlån', () => {
  test('search ignores case and keeps æøå', () => {
    expect(matchesLendSearch({ title: 'Høytrykksspyler', note: 'Kärcher' }, 'HØYTRYKK')).toBe(true);
    expect(matchesLendSearch({ title: 'Stige 3 m' }, 'spyler')).toBe(false);
    expect(matchesLendSearch({ title: 'Stige 3 m' }, '  ')).toBe(true);
  });

  test('a thing that is lent out cannot be booked for the same days', async () => {
    extras.lendItems.push({ id: 'li-1', ownerId: 'u-emma', title: 'Stige', category: 'VERKTOY', municipality: 'Lillehammer', active: true, createdAt: new Date().toISOString() });
    await apiClient.requestLend('li-1', '2026-12-01', '2026-12-03');
    extras.lendRequests[0].status = 'ACCEPTED';
    await expect(apiClient.requestLend('li-1', '2026-12-02', '2026-12-05')).rejects.toThrow('Den er lånt ut da.');
    await expect(apiClient.requestLend('li-1', '2026-12-04', '2026-12-05')).resolves.toBeUndefined();
  });

  test('a youth can lend out too (0107)', async () => {
    extras.guardian.youth = true;
    await expect(apiClient.saveLendItem({ title: 'Sykkelpumpe', category: 'FRITID' })).resolves.toMatchObject({ title: 'Sykkelpumpe' });
  });
});

// ------------------------------------------------------------------
// Chat: search and «Vis på norsk»
// ------------------------------------------------------------------
describe('chat', () => {
  const msg = (id: string, text: string, over: Partial<Message> = {}): Message =>
    ({ id, conversationId: 'c1', authorProfileId: 'u-emma', kind: 'TEXT', text, createdAt: `2026-11-0${id.slice(-1)}T10:00:00Z`, ...over }) as Message;

  test('search finds text and translations, newest first, never deleted messages', () => {
    const list = [msg('m1', 'Kan du komme på lørdag?'), msg('m2', 'Hello there', { translationNb: 'Hei der' }), msg('m3', 'Lørdag passer', { deletedAt: '2026-11-03T11:00:00Z' }), msg('m4', 'Ja, lørdag!')];
    expect(searchMessages(list, 'LØRDAG').map((m) => m.id)).toEqual(['m4', 'm1']);
    expect(searchMessages(list, 'hei').map((m) => m.id)).toEqual(['m2']);
    expect(searchMessages(list, 'l')).toEqual([]);
  });

  test('the snippet keeps the hit and cuts long text with …', () => {
    const [a, b, c] = snippet('Jeg har en lang melding om at vi kan møtes på lørdag ved butikken klokka ti', 'lørdag', 10);
    expect(b).toBe('lørdag');
    expect(a.startsWith('…')).toBe(true);
    expect(c.endsWith('…')).toBe(true);
  });

  test('«Vis på norsk» is offered for another language, not for Norwegian or very short text', () => {
    expect(looksForeign('I can come on Saturday after lunch')).toBe(true);
    expect(looksForeign('Cześć, mogę przyjść w sobotę rano')).toBe(true);
    expect(looksForeign('Jeg kan komme på lørdag etter lunsj')).toBe(false);
    expect(looksForeign('Hei, det passer fint i morgen')).toBe(false);
    expect(looksForeign('Ok thanks')).toBe(false);
  });
});

// ------------------------------------------------------------------
// Profile, partners, foresatt, seniormodus
// ------------------------------------------------------------------
describe('profile and more', () => {
  test('skill levels fill up towards the next one', () => {
    expect(skillLevel(0)).toEqual({ level: 0, progress: 0, next: 1 });
    expect(skillLevel(1)).toMatchObject({ level: 1, next: 5 });
    expect(skillLevel(7)).toMatchObject({ level: 2, next: 10 });
    expect(skillLevel(7).progress).toBeCloseTo(0.4);
    expect(skillLevel(30)).toEqual({ level: 4, progress: 1, next: null });
  });

  test('a helper offer past its last day is not shown', () => {
    const p = (id: string, until?: string, offer = '10 %'): Partner => ({ id, name: id, helperOffer: offer, helperOfferUntil: until }) as Partner;
    const today = new Date(2026, 10, 12);
    expect(activeHelperOffers([p('a'), p('b', '2026-11-12'), p('c', '2026-11-11'), p('d', undefined, '')], today).map((x) => x.id)).toEqual(['a', 'b']);
  });

  test('the helper code is only given after a finished job', async () => {
    extras.partnerCodes.pa = 'NABO10';
    const me = profileRepository.getProfile(profileRepository.currentUserId)!;
    const expected = (me.completedTasks ?? 0) > 0 ? 'NABO10' : null;
    expect(await apiClient.partnerHelperCode('pa')).toBe(expected);
  });

  test('a foresatt sees whether a «Trygg tur» is on, done or late', () => {
    const now = Date.parse('2026-11-12T18:00:00Z');
    expect(tripState(undefined, now)).toBe('none');
    expect(tripState({ startedAt: '2026-11-12T17:00:00Z', dueAt: '2026-11-12T19:00:00Z' }, now)).toBe('active');
    expect(tripState({ startedAt: '2026-11-12T15:00:00Z', dueAt: '2026-11-12T17:00:00Z' }, now)).toBe('late');
    expect(tripState({ startedAt: '2026-11-12T15:00:00Z', dueAt: '2026-11-12T17:00:00Z', checkedInAt: '2026-11-12T16:50:00Z' }, now)).toBe('done');
  });

  test('a household joins with the code, shows the other adult, and can be left', async () => {
    await expect(apiClient.householdJoin('feil')).rejects.toThrow('Koden er feil eller utløpt.');
    await apiClient.householdJoin('abc 123');
    expect((await apiClient.myHousehold()).partner?.name).toBe('Emma Larsen');
    await apiClient.householdLeave();
    expect((await apiClient.myHousehold()).inHousehold).toBe(false);
  });

  test('«Enkel visning» is the same everywhere at once', () => {
    const seen: boolean[] = [];
    const stop = seniorMode.subscribe(() => seen.push(seniorMode.get()));
    seniorMode.set(true);
    seniorMode.set(false);
    stop();
    expect(seen).toEqual([true, false]);
  });
});
