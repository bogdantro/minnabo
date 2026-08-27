import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ProfileScreen } from '@/screens/ProfileScreen';
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

test('submitting a review records it against the counterpart', async () => {
  await renderWithProviders(<ReviewScreen proposalId="p-emma-klippe" />);
  await waitFor(() => expect(screen.getByText('Hvordan gikk det?')).toBeTruthy());
  fireEvent.press(screen.getByText('Send vurdering'));
  await waitFor(() =>
    expect(profileRepository.hasReviewed('p-emma-klippe', profileRepository.currentUserId)).toBe(true),
  );
});
