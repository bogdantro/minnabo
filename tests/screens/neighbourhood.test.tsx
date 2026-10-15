import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { NeighbourhoodScreen } from '@/screens/NeighbourhoodScreen';
import { NoticeboardScreen } from '@/screens/NoticeboardScreen';
import { FellesskapScreen } from '@/screens/FellesskapScreen';
import { neighbourhoodStore } from '@mocks/data/neighbourhoodStore';
import { noticeboardStore } from '@mocks/data/noticeboardStore';
import { profileRepository } from '@mocks/data/profileRepository';
import { toast } from '@/lib/toast';
import nb from '@/i18n/nb';
import { NOTICE_KINDS } from '@/components/community/noticeKinds';
import { renderWithProviders } from '../testUtils';

// the screens read the module with require(), so spy on that object
// eslint-disable-next-line @typescript-eslint/no-require-imports
const expoRouter = require('expo-router');
const me = () => profileRepository.currentUserId;
const mine = () => neighbourhoodStore.list(undefined, me()).map((n) => n.place);
const idOf = (place: string) => neighbourhoodStore.info('Lillehammer', place, me()).id!;

beforeEach(() => neighbourhoodStore._reset());
afterEach(() => jest.restoreAllMocks());

// --- the list: you pick your nabolag on Fellesskap → Nabolag, not at sign-up ---------------
test('Nabolag lists the nabolag in my kommune, and I start in none', async () => {
  await renderWithProviders(<NeighbourhoodScreen />);
  expect(await screen.findByText('Velg nabolag')).toBeTruthy();
  expect(await screen.findByText('Vingnes')).toBeTruthy();
  expect(screen.getByText('Nordre Ål')).toBeTruthy();
  expect(screen.getByText('0 av 3 valgt')).toBeTruthy();
  expect(mine()).toEqual([]);
});

test('Bli med joins, Forlat leaves, and a fourth nabolag is refused', async () => {
  const err = jest.spyOn(toast, 'error');
  await renderWithProviders(<NeighbourhoodScreen />);
  for (const place of ['Vingnes', 'Sentrum', 'Nordre Ål']) {
    await fireEvent.press(await screen.findByLabelText(`Bli med i ${place}`));
    await waitFor(() => expect(mine()).toContain(place));
  }
  expect(await screen.findByText('3 av 3 valgt')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Bli med i Søre Ål'));
  expect(err).toHaveBeenCalledWith('Du er med i 3 nabolag. Forlat ett for å bli med i et nytt.');
  expect(mine()).not.toContain('Søre Ål');

  await fireEvent.press(await screen.findByLabelText('Forlat Sentrum'));
  await waitFor(() => expect(mine()).not.toContain('Sentrum'));
  expect(await screen.findByText('2 av 3 valgt')).toBeTruthy();
});

test('the server also stops a fourth nabolag', () => {
  for (const place of ['Vingnes', 'Sentrum', 'Nordre Ål']) neighbourhoodStore.joinById(idOf(place), me());
  expect(() => neighbourhoodStore.joinById(idOf('Søre Ål'), me())).toThrow(/høyst 3 nabolag/);
});

// --- one nabolag ---------------------------------------------------------------------------
test('the page of one nabolag shows its members and lets me join and leave', async () => {
  jest.spyOn(expoRouter, 'useLocalSearchParams').mockReturnValue({ place: 'Vingnes' });
  const before = neighbourhoodStore.info('Lillehammer', 'Vingnes', me()).memberCount;
  await renderWithProviders(<NeighbourhoodScreen />);
  expect(await screen.findByText('Vingnes nabolag')).toBeTruthy();
  await waitFor(() => expect(screen.getByLabelText(`${before} medlemmer`)).toBeTruthy());
  expect(screen.getByText('Enkle regler')).toBeTruthy();

  await fireEvent.press(screen.getByText('Bli med'));
  await waitFor(() => expect(mine()).toEqual(['Vingnes']));
  expect(await screen.findByLabelText(`${before + 1} medlemmer`)).toBeTruthy();
  await fireEvent.press(screen.getByText('Forlat'));
  await waitFor(() => expect(mine()).toEqual([]));
});

test('an area that is not a nabolag says so instead of making one', async () => {
  jest.spyOn(expoRouter, 'useLocalSearchParams').mockReturnValue({ place: 'Min egen gate' });
  await renderWithProviders(<NeighbourhoodScreen />);
  expect(await screen.findByText('Fant ikke nabolaget.')).toBeTruthy();
  expect(neighbourhoodStore.info('Lillehammer', 'Min egen gate', me()).id).toBeNull();
});

// --- Fellesskap ----------------------------------------------------------------------------
test('Fellesskap says «Velg nabolag» until I have one, then names mine', async () => {
  const first = await renderWithProviders(<FellesskapScreen />);
  expect(await screen.findByText('Velg nabolag')).toBeTruthy();
  first.unmount();
});

test('Fellesskap names the nabolag I am in', async () => {
  neighbourhoodStore.joinById(idOf('Vingnes'), me());
  neighbourhoodStore.joinById(idOf('Sentrum'), me());
  await renderWithProviders(<FellesskapScreen />);
  expect(await screen.findByText('Sentrum, Vingnes')).toBeTruthy();
  expect(screen.getByText('2 av 3 nabolag · trykk for å endre')).toBeTruthy();
});

// --- oppslag for one nabolag ---------------------------------------------------------------
test('a new oppslag goes to the whole kommune unless I pick one of my nabolag', async () => {
  neighbourhoodStore.joinById(idOf('Vingnes'), me());
  const create = jest.spyOn(noticeboardStore, 'create');
  await renderWithProviders(<NoticeboardScreen />);
  await fireEvent.press((await screen.findAllByLabelText('Nytt oppslag'))[0]);
  expect(await screen.findByText('Hvem kan se oppslaget?')).toBeTruthy();
  expect(screen.getByLabelText('Hele Lillehammer')).toBeTruthy();
  // nabolag I am not in are not offered
  expect(screen.queryByLabelText('Bare Sentrum')).toBeNull();

  await fireEvent.press(screen.getByLabelText('Bare Vingnes'));
  expect(await screen.findByText('Vises bare for medlemmer av Vingnes nabolag')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: nb.noticeboard.kinds[NOTICE_KINDS[0]] }));
  await fireEvent.changeText(screen.getByLabelText('Tittel'), 'Gatefest på lørdag');
  await fireEvent.changeText(screen.getByLabelText('Tekst'), 'Velkommen til gatefest, ta med stol.');
  await fireEvent.press(screen.getByText('Publiser oppslag'));

  await waitFor(() => expect(create).toHaveBeenCalled());
  expect(create.mock.calls[0][0]).toMatchObject({ neighbourhoodId: idOf('Vingnes'), place: 'Vingnes', municipality: 'Lillehammer' });
  expect(await screen.findByText(/Bare Vingnes/)).toBeTruthy();
});
