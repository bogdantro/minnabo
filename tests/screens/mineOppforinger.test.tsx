import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { MyListingsScreen } from '@/screens/MyListingsScreen';
import { repositories } from '@mocks/data/repositories';
import { renderWithProviders } from '../testUtils';

const status = () => repositories.listings.get('l-male-gjerdet')?.status;
const isPublic = () => repositories.listings.list().some((l) => l.id === 'l-male-gjerdet');

test('lists my active oppdrag with offer count and status chips', async () => {
  await renderWithProviders(<MyListingsScreen />);
  expect(await screen.findByText('Male gjerdet')).toBeTruthy();
  expect(screen.getByText('Mine oppdrag')).toBeTruthy();
  expect(screen.getByLabelText('Aktive, 1')).toBeTruthy();
  expect(screen.getByText('Trenger hjelp')).toBeTruthy();
  expect(screen.getByText(/Pris og betaling avtales direkte/)).toBeTruthy();
  // no service-offer UI (rule 1)
  expect(screen.queryByText('Tilbyr hjelp')).toBeNull();
});

test('pause hides the oppdrag from search, Aktiver igjen brings it back', async () => {
  await renderWithProviders(<MyListingsScreen />);
  await screen.findByText('Male gjerdet');

  await fireEvent.press(screen.getByLabelText('Flere valg for Male gjerdet'));
  await fireEvent.press(await screen.findByLabelText('Pause'));
  await waitFor(() => expect(status()).toBe('PAUSED'));
  expect(isPublic()).toBe(false);

  await fireEvent.press(screen.getByLabelText('Pauset, 1'));
  expect(await screen.findByText('Male gjerdet')).toBeTruthy();
  await fireEvent.press(screen.getByText('Aktiver igjen'));
  await waitFor(() => expect(status()).not.toBe('PAUSED'));
  expect(isPublic()).toBe(true);
});

test('delete asks first and is a soft delete', async () => {
  await renderWithProviders(<MyListingsScreen />);
  await screen.findByText('Male gjerdet');

  await fireEvent.press(screen.getByLabelText('Flere valg for Male gjerdet'));
  await fireEvent.press(await screen.findByLabelText('Slett'));
  expect(await screen.findByText('Slette «Male gjerdet»?')).toBeTruthy();
  await fireEvent.press(screen.getByText('Slett oppføringen'));

  await waitFor(() => expect(status()).toBe('REMOVED'));
  await waitFor(() => expect(screen.getByText('Ingen aktive oppdrag')).toBeTruthy());
});
