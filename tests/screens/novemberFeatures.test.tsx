import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { NoticeboardScreen } from '@/screens/NoticeboardScreen';
import { ListingsMap } from '@/components/ListingsMap';
import { LinkPreviewCard } from '@/components/chat/MessageExtras';
import { PhotoNudgeCard } from '@/components/PhotoNudgeCard';
import type { Listing } from '@/domain/types';
import { noticeboardStore } from '@mocks/data/noticeboardStore';
import { profileRepository } from '@mocks/data/profileRepository';
import { renderWithProviders } from '../testUtils';

beforeEach(() => noticeboardStore._reset());

// ------------------------------------------------------------
// Oppslagstavla
// ------------------------------------------------------------
test('«Søk i oppslagene» finds posts by their text, and says so when nothing matches', async () => {
  await renderWithProviders(<NoticeboardScreen />);
  await screen.findByText('Gis bort: barnesykkel 16"');
  await fireEvent.changeText(screen.getByLabelText('Søk i oppslagstavla'), 'nøkler');
  await waitFor(() => expect(screen.queryByText('Gis bort: barnesykkel 16"')).toBeNull());
  expect(screen.getByText('Funnet: nøkkelknippe ved Søndre park')).toBeTruthy();
  expect(screen.getByText('1 oppslag')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Søk i oppslagstavla'), 'trampoline');
  expect(await screen.findByText('Ingen oppslag passer «trampoline»')).toBeTruthy();
});

test('an answer to a svar goes under that svar, and an answer to the answer stays in the same thread', async () => {
  const first = noticeboardStore.addComment('n-seed-1', 'Er den fortsatt ledig?', 'u-jonas');
  noticeboardStore.addComment('n-seed-1', 'Ja!', 'u-emma', first.id);
  await renderWithProviders(<NoticeboardScreen />);
  await fireEvent.press((await screen.findAllByLabelText(/^Svar på Gis bort: barnesykkel/))[0]);
  await screen.findByText('Er den fortsatt ledig?');

  await fireEvent.press(screen.getAllByLabelText(/^Svar til /)[1]); // under «Ja!»
  expect(await screen.findByText(/^Svarer /)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Ditt svar'), 'Supert, jeg henter i kveld');
  await fireEvent.press(screen.getByTestId('comment-send'));
  // one level: the answer belongs to the first svar's thread
  await waitFor(() => expect(noticeboardStore.comments('n-seed-1').find((c) => c.body === 'Supert, jeg henter i kveld')?.parentId).toBe(first.id));
  // and it shows indented under it, not as a new svar at the bottom
  expect((await screen.findAllByText('Supert, jeg henter i kveld')).length).toBeGreaterThan(0);
});

test('the owner is asked whether an old oppslag is still current, and «Ja, behold» keeps it', async () => {
  const mine = noticeboardStore.create({ kind: 'GIVEAWAY', title: 'Gis bort: sofa', body: 'Grå sofa, hentes.', place: 'Lillehammer', municipality: 'Lillehammer' });
  noticeboardStore._patch(mine.id, { authorProfileId: profileRepository.currentUserId, stillAskedAt: new Date().toISOString() });
  await renderWithProviders(<NoticeboardScreen />);
  expect(await screen.findByText('Er dette fortsatt aktuelt?')).toBeTruthy();
  await fireEvent.press(screen.getByText('Ja, behold'));
  await waitFor(() => expect(screen.queryByText('Er dette fortsatt aktuelt?')).toBeNull());
  expect(noticeboardStore.list().find((p) => p.id === mine.id)?.stillAskedAt).toBeUndefined();
});

test('nobody else is asked, and an oppslag that closed itself says so', async () => {
  noticeboardStore._patch('n-seed-1', { stillAskedAt: new Date().toISOString() });
  noticeboardStore._patch('n-seed-3', { doneAt: new Date().toISOString(), autoClosed: true });
  await renderWithProviders(<NoticeboardScreen />);
  await screen.findByText('Gis bort: barnesykkel 16"');
  expect(screen.queryByText('Er dette fortsatt aktuelt?')).toBeNull();
  expect(screen.getByText('Avsluttet automatisk')).toBeTruthy();
});

test('an oppslag with five photos can be swiped through, with «1/5» and a dot per photo', async () => {
  const urls = ['a', 'b', 'c', 'd', 'e'].map((x) => `https://example.test/${x}.jpg`);
  noticeboardStore._patch('n-seed-1', { imageUrl: urls[0], imageUrls: urls });
  await renderWithProviders(<NoticeboardScreen />);
  expect(await screen.findByLabelText('Bilde 1 av 5: Gis bort: barnesykkel 16"')).toBeTruthy();
  expect(screen.getByLabelText('Bilde 5 av 5: Gis bort: barnesykkel 16"')).toBeTruthy();
  expect(screen.getByText('1/5')).toBeTruthy();
});

// ------------------------------------------------------------
// Map: «Søk i dette området» and «Min posisjon»
// ------------------------------------------------------------
const listing = (id: string, municipality: string, place: string): Listing =>
  ({
    id,
    type: 'TASK_REQUEST',
    title: `Oppdrag ${id}`,
    status: 'PUBLISHED',
    priceMode: 'OFFERS',
    createdAt: '2026-11-01T10:00:00Z',
    owner: { id: 'u-other' },
    location: { municipality, place },
    images: [],
    category: { slug: 'hage' },
  }) as unknown as Listing;

test('«Søk i dette området» shows up once the map has moved, and limits the cards to what is in view', async () => {
  const list = [listing('a', 'Lillehammer', 'Lillehammer'), listing('b', 'Gjøvik', 'Gjøvik'), listing('c', 'Hamar', 'Hamar')];
  await renderWithProviders(<ListingsMap listings={list} onClose={() => undefined} />);
  const map = screen.getByTestId('listings-map');
  await fireEvent(map, 'layout', { nativeEvent: { layout: { width: 390, height: 844 } } });
  expect(screen.queryByTestId('map-search-area')).toBeNull();
  // the first-time tip sits where the button goes; it waits until the tip is closed
  const tip = screen.queryByText('Skjønner');
  if (tip) await fireEvent.press(tip);
  // zoom far in: only the middle of the picture is left in view
  await fireEvent.press(screen.getByLabelText('Zoom inn'));
  await fireEvent.press(screen.getByLabelText('Zoom inn'));
  await fireEvent.press(screen.getByLabelText('Zoom inn'));
  await fireEvent.press(await screen.findByTestId('map-search-area'));
  await waitFor(() => expect(screen.queryByText('3 oppføringer på kartet')).toBeNull());
  expect(screen.getByText(/i dette området$/)).toBeTruthy();
  // «Vis alle» brings everything back
  await fireEvent.press(screen.getByText('Vis alle'));
  expect(await screen.findByText('3 oppføringer på kartet')).toBeTruthy();
});

test('«Min posisjon» puts my own dot on the map', async () => {
  const Location = require('expo-location');
  jest.spyOn(Location, 'getForegroundPermissionsAsync').mockResolvedValue({ granted: true });
  jest.spyOn(Location, 'getCurrentPositionAsync').mockResolvedValue({ coords: { latitude: 61.115, longitude: 10.466 } });
  const list = [listing('a', 'Lillehammer', 'Lillehammer')];
  await renderWithProviders(<ListingsMap listings={list} onClose={() => undefined} />);
  await fireEvent(screen.getByTestId('listings-map'), 'layout', { nativeEvent: { layout: { width: 390, height: 844 } } });
  expect(screen.queryByTestId('map-me')).toBeNull();
  await fireEvent.press(screen.getByTestId('map-my-position'));
  expect(await screen.findByTestId('map-me')).toBeTruthy();
  jest.restoreAllMocks();
});

// ------------------------------------------------------------
// Link previews and the profile picture nudge
// ------------------------------------------------------------
test('a link in a message gets a card with the site name; a page without a title still gets a small one', async () => {
  const { unmount } = await renderWithProviders(<LinkPreviewCard textValue="Været: https://www.yr.no/nb/sted" mine={false} />);
  const card = await screen.findByTestId('link-preview');
  expect(within(card).getByText('yr.no')).toBeTruthy();
  expect(within(card).getByText('Været for Lillehammer – yr')).toBeTruthy();
  await unmount();
  await renderWithProviders(<LinkPreviewCard textValue="Se www.webiser.no/om" mine={false} />);
  const small = await screen.findByTestId('link-preview');
  expect(within(small).getAllByText('webiser.no').length).toBeGreaterThan(0);
  expect(within(small).getByText('Trykk for å åpne lenken')).toBeTruthy();
});

test('the profile picture card shows without a picture, and «Senere» hides it', async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.removeItem('minnabo.photoNudge.until');
  profileRepository.updateProfile({ avatarPath: null } as never);
  await renderWithProviders(<PhotoNudgeCard />);
  expect(await screen.findByText('Vis naboene hvem du er')).toBeTruthy();
  await fireEvent.press(screen.getByText('Senere'));
  await waitFor(() => expect(screen.queryByTestId('photo-nudge')).toBeNull());
  expect(Number(await AsyncStorage.getItem('minnabo.photoNudge.until'))).toBeGreaterThan(Date.now());
  profileRepository._reset();
});
