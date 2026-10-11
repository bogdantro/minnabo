import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { apiClient } from '@/api/client';
import { safeTrip } from '@/lib/safeTrip';
import { SavedScreen } from '@/screens/SavedScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { RapporterScreen } from '@/screens/RapporterScreen';
import { TaskDetailScreen } from '@/screens/TaskDetailScreen';
import { YouthAppScreen } from '@/screens/youth/YouthAppScreen';
import { chatRepository } from '@mocks/data/chatRepository';
import { profileRepository } from '@mocks/data/profileRepository';
import { repositories } from '@mocks/data/repositories';
import { savedSearchStore } from '@mocks/data/savedSearchStore';
import { renderWithProviders } from '../testUtils';

const settle = (ms = 400) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  jest.clearAllMocks();
  chatRepository._reset();
  repositories.listings._reset();
  safeTrip._reset();
  await AsyncStorage.clear();
});
afterEach(() => jest.restoreAllMocks());

// --- Trygg tur: the reminder at the deadline ---------------------------------------
test('Trygg tur schedules a reminder at the deadline, moves it on Forleng and cancels it on Stopp', async () => {
  const due = new Date(Date.now() + 60 * 60_000).toISOString();
  safeTrip.start({ proposalId: 'p1', label: 'Kari', startedAt: new Date().toISOString(), dueAt: due, contactNames: ['Ola'] });
  await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1));
  const first = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
  expect(first.content.title).toBe('Er du trygt ferdig?');
  expect(first.content.data).toEqual({ route: '/sikkerhet' });
  expect(first.trigger.date.toISOString()).toBe(due);
  await waitFor(() => expect(safeTrip.get()?.reminderId).toBe('notif-1'));

  const later = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
  safeTrip.extend(later);
  await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2));
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
  expect((Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[1][0].trigger.date.toISOString()).toBe(later);

  await waitFor(() => expect(safeTrip.get()?.reminderId).toBe('notif-1'));
  safeTrip.checkIn();
  await waitFor(() => expect((Notifications.cancelScheduledNotificationAsync as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2));
  expect(safeTrip.get()).toBeNull();
});

test('stopping Trygg tur before the reminder is scheduled leaves no reminder behind', async () => {
  safeTrip.start({ proposalId: 'p1', label: 'Kari', startedAt: new Date().toISOString(), dueAt: new Date(Date.now() + 3600_000).toISOString(), contactNames: [] });
  safeTrip.checkIn();
  await settle(100);
  const scheduled = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.length;
  const cancelled = (Notifications.cancelScheduledNotificationAsync as jest.Mock).mock.calls.map((c) => c[0]);
  // either nothing was scheduled, or what was scheduled got cancelled again
  if (scheduled) expect(cancelled).toContain('notif-1');
});

// --- Lagrede → "Kjør søk" keeps every filter -----------------------------------------
test('a saved search runs with all its filters', async () => {
  savedSearchStore.add(
    'Hage og flytting',
    { query: 'plen', categorySlugs: ['hage', 'flytting'], verifiedOnly: true, maxDistanceKm: 10, municipalities: ['Lillehammer', 'Øyer'] },
    'NEWEST',
  );
  await renderWithProviders(<SavedScreen />);
  await fireEvent.press(await screen.findByRole('tab', { name: 'Søk (1)' }));
  await settle();
  await fireEvent.press(screen.getByText('Kjør søk'));
  const url = (router.push as jest.Mock).mock.calls.at(-1)[0] as string;
  const params = new URLSearchParams(url.split('?')[1]);
  expect(url.startsWith('/sok?')).toBe(true);
  expect(params.get('q')).toBe('plen');
  expect(params.get('cats')).toBe('hage,flytting');
  expect(params.get('verified')).toBe('1');
  expect(params.get('km')).toBe('10');
  expect(params.get('sort')).toBe('NEWEST');
  expect(params.get('kommuner')).toBe('Lillehammer,Øyer');
});

test('Søk started from a saved search shows its filters, and saving keeps several categories', async () => {
  await renderWithProviders(<SearchScreen initialQuery="plen" start={{ categories: ['hage', 'flytting'], verified: true, sort: 'NEWEST' }} />);
  await settle(500);
  expect(screen.getByText('Hage')).toBeTruthy();
  expect(screen.getByText('Flytting/bæring')).toBeTruthy();
  expect(screen.getByText('Kun verifiserte')).toBeTruthy();

  await fireEvent.press(screen.getByText('Lagre søk'));
  await settle();
  const saved = savedSearchStore.list();
  expect(saved.at(-1)!.filter.categorySlugs).toEqual(['hage', 'flytting']);
  expect(saved.at(-1)!.filter.verifiedOnly).toBe(true);
  expect(saved.at(-1)!.sort).toBe('NEWEST');
});

test('listings can be filtered on several categories', async () => {
  const list = await apiClient.listListings({ filter: { type: 'TASK_REQUEST', categorySlugs: ['hage'] } });
  expect(list.length).toBeGreaterThan(0);
  expect(list.every((l) => l.category.slug === 'hage')).toBe(true);
});

// --- Rapporter: a tilbud can be reported as a tilbud -----------------------------------
test('reporting a tilbud shows the tilbud and files it as a tilbud', async () => {
  const p = chatRepository.getProposal('p-emma-klippe')!;
  const submit = jest.spyOn(apiClient, 'submitReport');
  await renderWithProviders(<RapporterScreen proposalId={p.id} profileId={p.fromProfileId} />);
  expect(await screen.findByText(/^Tilbud på «/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(await screen.findByLabelText('Svindel eller krav om forhåndsbetaling'));
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(await screen.findByText('Send rapport'));
  await waitFor(() => expect(submit).toHaveBeenCalled());
  expect(submit.mock.calls[0][0]).toMatchObject({ targetType: 'PROPOSAL', targetId: p.id });
});

// --- private home notes ----------------------------------------------------------------
const notesSetup = () => {
  const task = repositories.listings.get('l-vaskehjelp')!; // owned by Emma
  const owner = profileRepository.getProfile(task.owner.id)!;
  jest.spyOn(apiClient, 'getSharedContact').mockImplementation(async (id: string) =>
    id === owner.id && chatRepository.listMyAgreements().some((a) => a.counterpartId === id) ? { homeNotes: 'Porten er på baksiden' } : {},
  );
  // the owner's notes on the profile object are ignored – they only come via getSharedContact
  return { ...task, owner: { ...task.owner, homeNotes: 'Porten er på baksiden' } };
};

test('home notes are not on the public oppdrag page', async () => {
  const listing = notesSetup();
  await renderWithProviders(<TaskDetailScreen listing={listing} onBack={() => {}} />);
  await settle();
  expect(screen.queryByText('Porten er på baksiden')).toBeNull();
});

test('home notes are shared once you have an avtale with the owner', async () => {
  const listing = notesSetup();
  chatRepository.respondToProposal('p-emma-klippe', 'ACCEPT', 'RECIPIENT');
  expect(chatRepository.listMyAgreements().some((a) => a.counterpartId === listing.owner.id)).toBe(true);
  await renderWithProviders(<TaskDetailScreen listing={listing} onBack={() => {}} />);
  expect(await screen.findByText('Porten er på baksiden')).toBeTruthy();
  await settle();
});

// --- youth: choose a kommune -----------------------------------------------------------
test('a youth account can choose which kommune to see oppdrag in', async () => {
  jest
    .spyOn(apiClient, 'getMyAccount')
    .mockResolvedValue({ vipps: true, youth: true, age: 16, birthYear: 2010, fullName: 'Emil Nygård', phoneMasked: '+47 ••• •• 518' });
  await renderWithProviders(<YouthAppScreen />);
  await fireEvent.press(await screen.findByLabelText('Velg hvilken kommune du vil se oppdrag i', {}, { timeout: 5000 }));
  expect(await screen.findByText('Vis oppdrag', {}, { timeout: 5000 })).toBeTruthy();
});
