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
  expect(screen.getByText('Verifisert med Vipps')).toBeTruthy();
  expect(screen.getByText('Privat – bare for deg')).toBeTruthy();

  // verification chip opens "Dette ble sjekket"
  await fireEvent.press(screen.getByLabelText('Telefonnummer – bekreftet. Se hva som ble sjekket'));
  expect(await screen.findByText('Dette ble sjekket')).toBeTruthy();

  await fireEvent.press(screen.getByRole('tab', { name: 'Vurderinger (2)' }));
  expect(await screen.findByText(/Ryddig og punktlig/)).toBeTruthy();
  expect(screen.getByText('Det naboer trekker fram')).toBeTruthy();
  await fireEvent.press(screen.getByText('5 stjerner'));
  expect(screen.getByText(/Viser 1 av 2/)).toBeTruthy();
});

test('"Slik ser andre deg" hides private details and editing', async () => {
  await renderWithProviders(<ProfileScreen />);
  await waitFor(() => expect(screen.getByText('Marius B.')).toBeTruthy());
  await fireEvent.press(screen.getByRole('tab', { name: 'Slik ser andre deg' }));
  expect(screen.getByText('Forhåndsvisning. Private detaljer og innstillinger er skjult.')).toBeTruthy();
  expect(screen.queryByText('Rediger profil')).toBeNull();
  expect(screen.queryByText('Privat – bare for deg')).toBeNull();
  expect(screen.queryByLabelText('Feriemodus')).toBeNull();
  expect(screen.getByText('Ta kontakt')).toBeTruthy();
});

test('edit profile hydrates with the current values; save is enabled only when dirty', async () => {
  await renderWithProviders(<EditProfileScreen />);
  await waitFor(() => expect(screen.getByLabelText('Visningsnavn').props.value).toBe('Marius B.'));
  expect(screen.getByText('Fra Vipps')).toBeTruthy();
  expect(screen.getByText('Alt er lagret')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Lagre endringer' })).toBeDisabled();

  await fireEvent.changeText(screen.getByLabelText('Presentasjon'), 'Hjelper gjerne med hagen.');
  expect(screen.getByText('Ulagrede endringer')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Søre Ål' }));
  expect(screen.getByText('Søre Ål, Lillehammer')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Lagre endringer' }));
  await waitFor(() => expect(screen.getByText('Alt er lagret')).toBeTruthy());
  const me = profileRepository.getProfile(profileRepository.currentUserId);
  expect(me?.presentation).toBe('Hjelper gjerne med hagen.');
  expect(me?.location.place).toBe('Søre Ål');
});

test('edit profile blocks saving a blank display name', async () => {
  const meId = profileRepository.currentUserId;
  const before = profileRepository.getProfile(meId)?.displayName;
  await renderWithProviders(<EditProfileScreen />);
  await waitFor(() => expect(screen.getByLabelText('Visningsnavn').props.value).toBe('Marius B.'));

  await fireEvent.changeText(screen.getByLabelText('Visningsnavn'), '   ');
  expect(screen.getByText('Skriv inn et visningsnavn')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Lagre endringer' })).toBeDisabled();
  expect(profileRepository.getProfile(meId)?.displayName).toBe(before);

  await fireEvent.press(screen.getByText('Forkast'));
  expect(screen.getByLabelText('Visningsnavn').props.value).toBe('Marius B.');
});

test('pausing the profile shows the paused banner and hides own listings', async () => {
  const meId = profileRepository.currentUserId;
  const { repositories } = require('@mocks/data/repositories');
  const before = repositories.listings.list().filter((l: { owner: { id: string } }) => l.owner.id === meId).length;
  expect(before).toBeGreaterThan(0);

  await renderWithProviders(<ProfileScreen />);
  await waitFor(() => expect(screen.getByText('Marius B.')).toBeTruthy());

  await fireEvent.press(screen.getByLabelText('Feriemodus'));

  await waitFor(() => expect(screen.getByText('Feriemodus er på – oppføringene dine er skjult')).toBeTruthy());
  expect(
    repositories.listings.list().filter((l: { owner: { id: string } }) => l.owner.id === meId),
  ).toHaveLength(0);
});

test('endorsing a skill on another profile increments the count', async () => {
  await renderWithProviders(<ProfileScreen profileId="u-emma" />);
  await waitFor(() => expect(screen.getByText('Emma Larsen')).toBeTruthy());

  // Hagearbeid is seeded with 3 endorsements, none from the current user.
  expect(screen.getByText('3 naboer anbefaler')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Anbefal Hagearbeid'));
  await waitFor(() => expect(screen.getByText('4 naboer anbefaler')).toBeTruthy());
});

test('a helper profile shows their portfolio gallery', async () => {
  await renderWithProviders(<ProfileScreen profileId="u-andreas" />);
  await waitFor(() => expect(screen.getByText('Portefølje')).toBeTruthy());
  await fireEvent.press(screen.getByRole('tab', { name: 'Portefølje' }));
  await fireEvent.press(screen.getByLabelText('Åpne bilde 2'));
  expect(await screen.findByText('Bilde 2 av 2')).toBeTruthy();
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

test('submitting a review needs stars, records tags and "Anbefaler", then shows the preview', async () => {
  await renderWithProviders(<ReviewScreen proposalId="p-emma-klippe" />);
  await waitFor(() => expect(screen.getByText('Hvordan var det å få hjelp av Emma?')).toBeTruthy());
  expect(screen.getByText('Velg antall stjerner for å sende')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('5 stjerner – Fantastisk!'));
  expect(screen.getByText('Fantastisk!')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Punktlig'));
  await fireEvent.press(screen.getByRole('tab', { name: 'Ja' }));
  await fireEvent.press(screen.getByText('Send vurdering'));

  await waitFor(() =>
    expect(profileRepository.hasReviewed('p-emma-klippe', profileRepository.currentUserId)).toBe(true),
  );
  const mine = profileRepository
    .reviewsWrittenBy(profileRepository.currentUserId)
    .find((r) => r.agreementProposalId === 'p-emma-klippe');
  expect(mine?.rating).toBe(5);
  expect(mine?.tags).toEqual(expect.arrayContaining(['Punktlig', 'Anbefales']));
  expect(await screen.findByText('Takk for vurderingen!')).toBeTruthy();
  expect(screen.getByText('Anbefaler')).toBeTruthy();
});
