/** Oppslagstavla (0108): the newer kinds of oppslag, «Hos meg også», liked answers first, pinned oppslag first. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '@/api/client';
import { community } from '@mocks/mockCommunity';
import { noticeboardStore } from '@mocks/data/noticeboardStore';
import { NoticeboardScreen } from '@/screens/NoticeboardScreen';
import { renderWithProviders } from '../testUtils';

jest.mock('@/lib/nav', () => ({ safePush: jest.fn() }));

const base = { body: 'Mer om dette her', place: 'Sentrum', municipality: 'Lillehammer' };

beforeEach(() => {
  community._reset();
  noticeboardStore._reset();
});
afterEach(() => jest.restoreAllMocks());

test('a newer kind is a GENERAL oppslag with its topic, and overskuddsmat closes itself after a day', async () => {
  const post = await apiClient.createNoticeboardPost({ ...base, kind: 'GIVEAWAY', title: 'Boller fra bursdagen', topic: 'FOOD' });
  expect(post.kind).toBe('GENERAL');
  expect(post.topic).toBe('FOOD');
  const hours = (Date.parse(post.expiresAt!) - Date.now()) / 3_600_000;
  expect(hours).toBeGreaterThan(23);
  expect(hours).toBeLessThan(25);
});

test('choosing «Savnet dyr» when writing posts it with that topic and its own label', async () => {
  await renderWithProviders(<NoticeboardScreen />);
  await fireEvent.press(await screen.findByLabelText('Skriv et oppslag'));
  await fireEvent.press(await screen.findByLabelText('Savnet dyr'));
  expect(screen.getByText('Alle i nabolaget får beskjed med en gang.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Tittel'), 'Grå katt savnet');
  await fireEvent.changeText(screen.getByLabelText('Tekst'), 'Han heter Pus og er veldig snill.');
  await fireEvent.press(screen.getByText('Publiser oppslag'));
  await waitFor(() => expect(noticeboardStore.list()[0]).toMatchObject({ title: 'Grå katt savnet', topic: 'PET', kind: 'GENERAL' }));
});

test('a youth is never offered samkjøring', async () => {
  jest.spyOn(apiClient, 'getMyAccount').mockResolvedValue({ vipps: true, youth: true, age: 16, birthYear: 2010, fullName: 'Emil', phoneMasked: '' });
  await renderWithProviders(<NoticeboardScreen />);
  await fireEvent.press(await screen.findByLabelText('Skriv et oppslag'));
  expect(await screen.findByLabelText('Savnet dyr')).toBeTruthy();
  expect(screen.queryByLabelText('Samkjøring')).toBeNull();
});

test('«Hos meg også» on a strømbrudd is counted once per person', async () => {
  const post = await apiClient.createNoticeboardPost({ ...base, kind: 'GENERAL', title: 'Strømmen er borte', topic: 'OUTAGE' });
  await renderWithProviders(<NoticeboardScreen />);
  await fireEvent.press(await screen.findByLabelText('Hos meg også. 0 naboer har sagt fra'));
  await waitFor(() => expect(community.metoo[post.id]).toEqual(['u-mb']));
  expect(await screen.findByText('1 nabo har det samme')).toBeTruthy();
});

test('on «Anbefalinger» the most liked answer comes first', async () => {
  const post = await apiClient.createNoticeboardPost({ ...base, kind: 'GENERAL', title: 'Beste frisør?', topic: 'RECOMMEND' });
  const first = noticeboardStore.addComment(post.id, 'Salong A er fin', 'u-jonas');
  const second = noticeboardStore.addComment(post.id, 'Salong B er best', 'u-emma');
  community.commentLikes[second.id] = ['u-jonas', 'u-andreas'];
  const likes = await apiClient.noticeCommentLikes(post.id);
  expect(likes[second.id].count).toBe(2);
  expect(likes[first.id].count).toBe(0);
  expect(await apiClient.toggleCommentLike(first.id)).toBe(1);
  expect(await apiClient.toggleCommentLike(first.id)).toBe(0);
});

test('only a vert can pin, and a pinned oppslag comes first', async () => {
  const older = await apiClient.createNoticeboardPost({ ...base, kind: 'GENERAL', title: 'Husk dugnaden' });
  noticeboardStore._patch(older.id, { createdAt: '2026-01-01T10:00:00Z', neighbourhoodId: 'nb-sentrum' });
  await expect(apiClient.pinNotice(older.id, true)).rejects.toThrow('Bare verter kan feste oppslag.');
  community.hosts['nb-sentrum'] = ['u-mb'];
  await apiClient.pinNotice(older.id, true);
  await renderWithProviders(<NoticeboardScreen />);
  expect(await screen.findByText('Festet')).toBeTruthy();
  const titles = screen.getAllByTestId(/^notice-n/).map((n) => n.props.testID);
  expect(titles[0]).toBe(`notice-${older.id}`);
});
