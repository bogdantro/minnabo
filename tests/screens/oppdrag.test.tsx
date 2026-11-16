import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { OppdragScreen } from '@/screens/OppdragScreen';
import { setFlagOverride } from '@/config/featureFlags';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => setFlagOverride('forMeOnHome', false));

test('shows the greeting, header, location row, search and category chips', async () => {
  await renderWithProviders(<OppdragScreen />);
  expect(screen.getByText('Finn hjelp eller en småjobb nær deg')).toBeTruthy();
  expect(screen.getByLabelText('Åpne profil')).toBeTruthy();
  expect(screen.getByText('Søk etter plen, flytting, datahjelp …')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Alle' })).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Lillehammer kommune')).toBeTruthy());
});

test('lists open oppdrag (no service offers) as listing cards', async () => {
  await renderWithProviders(<OppdragScreen />);
  expect(screen.getByText('Folk som trenger hjelp')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  // the «Trenger hjelp» tab shows oppdrag only – offers live on their own tab (0076)
  expect(screen.queryByText('Jeg kan klippe plenen din')).toBeNull();
  const hearts = screen.getAllByLabelText('Lagre');
  expect(hearts.length).toBeGreaterThan(0);
  expect(hearts.length).toBeLessThanOrEqual(6);
});

test('category chips filter the list in place', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Transport/levering' }));
  await waitFor(() => expect(screen.queryByText('Klippe plen')).toBeNull());
  expect(screen.getByText('Hjelp med flytting')).toBeTruthy();
  expect(router.push).not.toHaveBeenCalled();
});

test('"Se alle oppdrag" goes to the full list', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  await fireEvent.press(screen.getByText('Se alle oppdrag'));
  expect(router.push).toHaveBeenCalledWith('/oppdrag-liste');
});

test('the search bar opens Søk, and the «Oppdrag for meg» card is hidden for now (2026-11-14)', async () => {
  await renderWithProviders(<OppdragScreen />);
  await fireEvent.press(screen.getByLabelText('Søk etter oppdrag'));
  expect(router.push).toHaveBeenCalledWith('/sok');
  expect(screen.queryByText('Oppdrag for meg')).toBeNull();
});

test('with its flag on, the «Oppdrag for meg» card is back and opens Oppdrag for meg', async () => {
  setFlagOverride('forMeOnHome', true);
  await renderWithProviders(<OppdragScreen />);
  await fireEvent.press(screen.getByText('Oppdrag for meg'));
  expect(router.push).toHaveBeenCalledWith('/oppdrag-for-meg');
});

test('the payment note is shown', async () => {
  await renderWithProviders(<OppdragScreen />);
  // one card, read as one sentence (2026-11-14)
  expect(screen.getByLabelText('Pris og betaling avtales direkte mellom dere. MinNabo håndterer ikke betaling.')).toBeTruthy();
});

describe('Hasteoppdrag', () => {
  const { repositories } = require('@mocks/data/repositories');
  const { profileRepository } = require('@mocks/data/profileRepository');
  afterEach(() => repositories.listings._reset());

  test('a hasteoppdrag is shown first with a «Haster» pill, and drops back once the deadline has passed', async () => {
    const feed = repositories.listings
      .list({ type: 'TASK_REQUEST' }, 'NEWEST')
      .filter((l: { owner: { id: string } }) => l.owner.id !== profileRepository.currentUserId);
    const oldest = feed[feed.length - 1];
    repositories.listings.replace({ ...oldest, urgentUntil: new Date(Date.now() + 3600000).toISOString() });

    await renderWithProviders(<OppdragScreen />);
    // 0110: the card's tags («Ingen tilbud ennå» …) come after the price in its label
    const cards = await screen.findAllByLabelText(/(kr|Ønsker tilbud|Frivillig)(, .*)?$/);
    expect(cards[0].props.accessibilityLabel).toMatch(new RegExp(`^${oldest.title}, Haster, `));
    expect(screen.getAllByText('Haster')).toHaveLength(1);
  });

  test('an expired haste is an ordinary oppdrag again', async () => {
    const feed = repositories.listings
      .list({ type: 'TASK_REQUEST' }, 'NEWEST')
      .filter((l: { owner: { id: string } }) => l.owner.id !== profileRepository.currentUserId);
    const oldest = feed[feed.length - 1];
    repositories.listings.replace({ ...oldest, urgentUntil: new Date(Date.now() - 60000).toISOString() });

    await renderWithProviders(<OppdragScreen />);
    const cards = await screen.findAllByLabelText(/(kr|Ønsker tilbud|Frivillig)(, .*)?$/);
    expect(cards[0].props.accessibilityLabel).not.toMatch(new RegExp(`^${oldest.title},`));
    expect(screen.queryByText('Haster')).toBeNull();
  });
});

test('«Tilbyr hjelp» shows naboer who offer help, with their own pill', async () => {
  await renderWithProviders(<OppdragScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  await fireEvent.press(screen.getAllByText('Tilbyr hjelp')[0]);
  expect(await screen.findByText('Naboer som tilbyr hjelp')).toBeTruthy();
  expect(await screen.findByText('Jeg kan klippe plenen din')).toBeTruthy();
  expect(screen.queryByText('Klippe plen')).toBeNull();
});
