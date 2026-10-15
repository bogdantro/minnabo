import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { MinNaboScreen } from '@/screens/MinNaboScreen';
import { InnboksScreen } from '@/screens/InnboksScreen';
import { minnaboStore } from '@mocks/data/minnaboStore';
import { profileRepository } from '@mocks/data/profileRepository';
import { renderWithProviders } from '../testUtils';

const me = () => profileRepository.currentUserId;
const thread = () => minnaboStore.thread(me());

beforeEach(() => {
  minnaboStore._reset();
  jest.clearAllMocks();
});

test('Innboks has no MinNabo row until MinNabo has written', async () => {
  await renderWithProviders(<InnboksScreen />);
  await screen.findByText('Innboks');
  expect(screen.queryByText('Offisiell konto')).toBeNull();
});

test('a message from MinNabo is pinned in Innboks, unread, and opens the thread', async () => {
  minnaboStore.adminSends({ body: 'Hei! Vi har sett på rapporten din.' });
  await renderWithProviders(<InnboksScreen />);
  const row = await screen.findByLabelText('MinNabo, offisiell konto. Hei! Vi har sett på rapporten din.. 1 ulest');
  await fireEvent.press(row);
  expect(router.push).toHaveBeenCalledWith('/minnabo');
});

test('opening the thread reads it, and I can answer', async () => {
  minnaboStore.adminSends({ body: 'Hei! Vi har sett på rapporten din.' });
  await renderWithProviders(<MinNaboScreen />);
  expect(await screen.findByText('Hei! Vi har sett på rapporten din.')).toBeTruthy();
  await waitFor(() => expect(thread()[0].readAt).toBeTruthy());

  await fireEvent.changeText(screen.getByLabelText('Melding til MinNabo'), '  Tusen takk!  ');
  await fireEvent.press(screen.getByLabelText('Send'));
  await waitFor(() => expect(thread()).toHaveLength(2));
  expect(thread()[1]).toMatchObject({ fromAdmin: false, body: 'Tusen takk!' });
  expect(await screen.findByText('Tusen takk!')).toBeTruthy();
});

test('news shows its title', async () => {
  minnaboStore.adminSends({ kind: 'NEWS', title: 'Nå er vi i Gausdal', body: 'MinNabo åpner i Gausdal i dag.' });
  await renderWithProviders(<MinNaboScreen />);
  expect(await screen.findByText('Nå er vi i Gausdal')).toBeTruthy();
  expect(screen.getByText('Nytt fra MinNabo')).toBeTruthy();
});

test('a poll hides the result until I vote, then shows it; I can change my answer', async () => {
  minnaboStore.adminSends({ kind: 'POLL', body: 'Hva savner du mest?', options: ['Flere kategorier', 'Kart'], otherVotes: [1, 1, 2] });
  await renderWithProviders(<MinNaboScreen />);
  expect(await screen.findByText('Hva savner du mest?')).toBeTruthy();
  expect(screen.getByText('Trykk på et svar for å stemme')).toBeTruthy();
  expect(screen.queryByText(/%/)).toBeNull();

  await fireEvent.press(screen.getByLabelText('Kart'));
  // 2 for Flere kategorier, 2 for Kart (one other + me)
  expect(await screen.findByLabelText('Kart, 50 %, ditt svar')).toBeTruthy();
  expect(screen.getByLabelText('Flere kategorier, 50 %')).toBeTruthy();
  expect(screen.getByText('Takk! Du kan endre svaret ditt. · 4 svar')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Flere kategorier, 50 %'));
  expect(await screen.findByLabelText('Flere kategorier, 75 %, ditt svar')).toBeTruthy();
  expect(thread()[0].myVote).toBe(1);
});
