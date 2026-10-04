import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { DeleteAccountScreen } from '@/screens/DeleteAccountScreen';
import { profileRepository } from '@mocks/data/profileRepository';
import { renderWithProviders } from '../testUtils';

test('Slett konto: what is deleted → active agreements → type SLETT → done', async () => {
  await renderWithProviders(<DeleteAccountScreen />);
  expect(screen.getByText('Dette blir slettet')).toBeTruthy();
  expect(screen.getByText('Andre ser «Slettet bruker» i sine samtaler')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Jeg har en annen konto' }));
  await waitFor(() => expect(screen.getByText('Fortsett')).toBeTruthy());
  await fireEvent.press(screen.getByText('Fortsett'));

  // the demo user has active agreements → step 2 warns first
  if (await screen.findByText(/aktive? avtaler?$/).catch(() => null)) {
    await fireEvent.press(screen.getByText('Fortsett likevel'));
  }

  expect(await screen.findByText('Bekreft sletting')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Skriv SLETT for å bekrefte'), 'slett');
  expect(screen.getByText('Det stemmer ikke. Skriv SLETT med store bokstaver.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Slett kontoen for godt'));
  expect(profileRepository.deletedReasons).toHaveLength(0);

  await fireEvent.changeText(screen.getByLabelText('Skriv SLETT for å bekrefte'), 'SLETT');
  expect(screen.getByText('Klar. Dette kan ikke angres.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Slett kontoen for godt'));

  expect(await screen.findByText('Kontoen din er slettet')).toBeTruthy();
  expect(profileRepository.deletedReasons).toEqual(['Jeg har en annen konto']);
  expect(profileRepository.getProfile(profileRepository.currentUserId)?.displayName).toBe('Slettet bruker');
});
