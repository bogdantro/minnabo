import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { NeighbourhoodHighlights } from '@/components/NeighbourhoodHighlights';
import { PersonvernScreen } from '@/screens/PersonvernScreen';
import { profileRepository } from '@mocks/data/profileRepository';
import { renderWithProviders } from '../testUtils';

afterEach(() => profileRepository.updateProfile({ highlightOptIn: false }));

test('nobody is shown until they opt in – then no card at all', async () => {
  await renderWithProviders(<NeighbourhoodHighlights kommune="Lillehammer" />);
  await waitFor(() => expect(screen.queryByTestId('nabolag-highlights')).toBeNull());
});

test('turning it on under Personvern puts you on Nabolag with this month’s jobs', async () => {
  const first = await renderWithProviders(<PersonvernScreen />);
  await fireEvent(await screen.findByLabelText('Vis meg blant de mest hjelpsomme'), 'valueChange', true);
  await waitFor(() => expect(profileRepository.getProfile(profileRepository.currentUserId)?.highlightOptIn).toBe(true));
  first.unmount();

  await renderWithProviders(<NeighbourhoodHighlights kommune="Lillehammer" />);
  expect(await screen.findByText('Mest hjelpsomme denne måneden')).toBeTruthy();
  expect(await screen.findByText('Marius B.')).toBeTruthy();
  expect(screen.getByText('6 jobber')).toBeTruthy();
  // already on the list: no "slå det på" line
  expect(screen.queryByText(/Vil du være med/)).toBeNull();
});

test('another kommune shows nobody from Lillehammer', async () => {
  profileRepository.updateProfile({ highlightOptIn: true });
  await renderWithProviders(<NeighbourhoodHighlights kommune="Hamar" />);
  await waitFor(() => expect(screen.queryByTestId('nabolag-highlights')).toBeNull());
});
