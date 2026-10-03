import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { EditProfileScreen } from '@/screens/EditProfileScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { CompletionScreen } from '@/screens/CompletionScreen';
import { ReviewScreen } from '@/screens/ReviewScreen';
import { profileRepository } from '@mocks/data/profileRepository';
import { renderWithProviders } from '../testUtils';

test('own profile shows presentation, verifications and reviews', async () => {
  await renderWithProviders(<ProfileScreen />);
  await waitFor(() => expect(screen.getByText('Marius B.')).toBeTruthy());
  expect(screen.getByText('Rediger profil')).toBeTruthy();
  expect(screen.getByText('Telefon verifisert')).toBeTruthy();
  expect(screen.getByText(/Ryddig og punktlig/)).toBeTruthy();
});

test('edit profile hydrates with the current values', async () => {
  await renderWithProviders(<EditProfileScreen />);
  await waitFor(() => expect(screen.getByDisplayValue('Marius B.')).toBeTruthy());
});

test('edit profile blocks saving a blank name', async () => {
  const meId = profileRepository.currentUserId;
  const before = profileRepository.getProfile(meId)?.displayName;
  await renderWithProviders(<EditProfileScreen />);
  await waitFor(() => expect(screen.getByDisplayValue('Marius B.')).toBeTruthy());

  await fireEvent.changeText(screen.getByDisplayValue('Marius B.'), '   ');
  await fireEvent.press(screen.getByText('Lagre'));

  await waitFor(() => expect(screen.getByText('Skriv inn navnet ditt.')).toBeTruthy());
  expect(profileRepository.getProfile(meId)?.displayName).toBe(before);
});

test('pausing the profile shows the paused banner and hides own listings', async () => {
  const meId = profileRepository.currentUserId;
  const { repositories } = require('@mocks/data/repositories');
  const before = repositories.listings.list().filter((l: { owner: { id: string } }) => l.owner.id === meId).length;
  expect(before).toBeGreaterThan(0);

  await renderWithProviders(<ProfileScreen />);
  await waitFor(() => expect(screen.getByText('Marius B.')).toBeTruthy());

  await fireEvent.press(screen.getByText('Sett profilen på pause'));

  await waitFor(() => expect(screen.getByText('Profilen din er på pause')).toBeTruthy());
  expect(
    repositories.listings.list().filter((l: { owner: { id: string } }) => l.owner.id === meId),
  ).toHaveLength(0);
});

test('endorsing a skill on another profile increments the count', async () => {
  await renderWithProviders(<ProfileScreen profileId="u-emma" />);
  await waitFor(() => expect(screen.getByText('Emma Larsen')).toBeTruthy());

  // Hagearbeid is seeded with 3 endorsements, none from the current user.
  await fireEvent.press(screen.getByText('Hagearbeid · 3'));
  await waitFor(() => expect(screen.getByText('Hagearbeid · 4')).toBeTruthy());
});

test('a helper profile shows their portfolio gallery', async () => {
  await renderWithProviders(<ProfileScreen profileId="u-andreas" />);
  await waitFor(() => expect(screen.getByText('Portefølje')).toBeTruthy());
});

test('following a helper from their profile adds them to the follow list', async () => {
  const { followStore } = require('@mocks/data/followStore');
  await renderWithProviders(<ProfileScreen profileId="u-andreas" />);
  await waitFor(() => expect(screen.getByText('Andreas')).toBeTruthy());

  expect(followStore.isFollowing('u-andreas')).toBe(false);
  await fireEvent.press(screen.getByText('Følg'));
  await waitFor(() => expect(followStore.isFollowing('u-andreas')).toBe(true));
});

test('reliability score is computed from completions and no-shows', () => {
  const before = profileRepository.reliabilityFor('u-sara');
  profileRepository.reportNoShow('u-sara');
  const after = profileRepository.reliabilityFor('u-sara');
  expect(after.noShows).toBe(before.noShows + 1);
});

test('notifications list can be marked all read', async () => {
  await renderWithProviders(<NotificationsScreen />);
  await waitFor(() => expect(screen.getByText('Nytt tilbud fra Emma Larsen')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Merk alle som lest'));
  await waitFor(() =>
    expect(profileRepository.unreadNotificationCount()).toBe(0),
  );
});

test('the counterpart has confirmed; confirming completes the job and offers the review', async () => {
  // seed: Martin has already confirmed p-martin-flytting
  await renderWithProviders(<CompletionScreen proposalId="p-martin-flytting" />);
  await waitFor(() => expect(screen.getByText('Jeg bekrefter at jobben er utført')).toBeTruthy());
  expect(screen.getByText('Venter på deg')).toBeTruthy();
  expect(screen.getByText(/Martin har markert jobben som ferdig/)).toBeTruthy();
  expect(screen.queryByText('Gi vurdering')).toBeNull();

  await fireEvent.press(screen.getByText('Jeg bekrefter at jobben er utført'));
  await waitFor(() => expect(screen.getByText('Jobben er fullført!')).toBeTruthy());
  expect(screen.getByText('Gi vurdering')).toBeTruthy();
});

test('"Noe er ikke i orden?" offers chat and report', async () => {
  await renderWithProviders(<CompletionScreen proposalId="p-martin-flytting" />);
  await waitFor(() => expect(screen.getByText('Noe er ikke i orden?')).toBeTruthy());
  await fireEvent.press(screen.getByText('Noe er ikke i orden?'));
  expect(screen.getByText('Ta det opp i chatten')).toBeTruthy();
  expect(screen.getByText('Rapporter et problem')).toBeTruthy();
  expect(screen.getByText(/kan ikke holde igjen penger/)).toBeTruthy();
});

test('submitting a review records it against the counterpart with tags', async () => {
  await renderWithProviders(<ReviewScreen proposalId="p-emma-klippe" />);
  await waitFor(() => expect(screen.getByText('Hvordan gikk det?')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Punktlig'));
  await fireEvent.press(screen.getByText('Send vurdering'));
  await waitFor(() =>
    expect(profileRepository.hasReviewed('p-emma-klippe', profileRepository.currentUserId)).toBe(true),
  );
  const mine = profileRepository
    .reviewsWrittenBy(profileRepository.currentUserId)
    .find((r) => r.agreementProposalId === 'p-emma-klippe');
  expect(mine?.tags).toContain('Punktlig');
});
