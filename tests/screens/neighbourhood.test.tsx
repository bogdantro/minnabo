import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { NeighbourhoodScreen } from '@/screens/NeighbourhoodScreen';
import { neighbourhoodStore } from '@mocks/data/neighbourhoodStore';
import { profileRepository } from '@mocks/data/profileRepository';
import { renderWithProviders } from '../testUtils';

const me = () => profileRepository.currentUserId;

test('Nabolag shows the group for my area with a real member count', async () => {
  await renderWithProviders(<NeighbourhoodScreen />);
  expect(await screen.findByText('Lillehammer nabolag')).toBeTruthy();
  const before = neighbourhoodStore.info('Lillehammer', 'Lillehammer', me()).memberCount;
  await waitFor(() => expect(screen.getByLabelText(`${before} medlemmer`)).toBeTruthy());
  expect(screen.getByText('Bli med')).toBeTruthy();
  expect(screen.getByText('Enkle regler')).toBeTruthy();
});

test('Bli med adds me (+1), Forlat removes me (−1)', async () => {
  const before = neighbourhoodStore.info('Lillehammer', 'Lillehammer', me()).memberCount;
  await renderWithProviders(<NeighbourhoodScreen />);
  await fireEvent.press(await screen.findByText('Bli med'));
  await waitFor(() => expect(neighbourhoodStore.info('Lillehammer', 'Lillehammer', me()).isMember).toBe(true));
  expect(await screen.findByLabelText(`${before + 1} medlemmer`)).toBeTruthy();
  expect(screen.getByText('Medlem')).toBeTruthy();

  await fireEvent.press(screen.getByText('Forlat'));
  await waitFor(() => expect(neighbourhoodStore.info('Lillehammer', 'Lillehammer', me()).isMember).toBe(false));
  expect(await screen.findByLabelText(`${before} medlemmer`)).toBeTruthy();
});

test('Oppslag tab lists notices from my kommune', async () => {
  await renderWithProviders(<NeighbourhoodScreen />);
  await fireEvent.press(await screen.findByRole('tab', { name: 'Oppslag' }));
  expect(await screen.findByText('Åpne oppslagstavla')).toBeTruthy();
});
