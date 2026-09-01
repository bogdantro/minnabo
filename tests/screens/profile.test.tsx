import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { EditProfileScreen } from '@/screens/EditProfileScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { CompletionScreen } from '@/screens/CompletionScreen';
import { ReviewScreen } from '@/screens/ReviewScreen';
import { profileRepository } from '@/data/profileRepository';
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
  const { repositories } = require('@/data/repositories');
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

test('following a helper from their profile adds them to the follow list', async () => {
  const { followStore } = require('@/data/followStore');
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
  fireEvent.press(screen.getByText('Merk alle som lest'));
  await waitFor(() =>
    expect(profileRepository.unreadNotificationCount()).toBe(0),
  );
});

test('completion needs both parties before the review CTA appears', async () => {
  await renderWithProviders(<CompletionScreen proposalId="p-test-1" />);
  await waitFor(() => expect(screen.getByText('Bekreft fullført')).toBeTruthy());

  fireEvent.press(screen.getByText('Bekreft fullført'));
  await waitFor(() => expect(screen.getByText(/Venter på at den andre/)).toBeTruthy());
  expect(screen.queryByText('Gi en vurdering')).toBeNull();

  // the other party confirms
  profileRepository.confirmCompletion('p-test-1', 'u-emma');
  await renderWithProviders(<CompletionScreen proposalId="p-test-1" />);
  await waitFor(() => expect(screen.getAllByText('Gi en vurdering').length).toBeGreaterThan(0));
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
