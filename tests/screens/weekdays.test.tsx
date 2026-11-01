import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { EditProfileScreen } from '@/screens/EditProfileScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { profileRepository } from '@mocks/data/profileRepository';
import { renderWithProviders } from '../testUtils';

afterEach(() => profileRepository.updateProfile({ availableWeekdays: [] }));

test('saving without touching the days leaves them out of the update', async () => {
  const spy = jest.spyOn(profileRepository, 'updateProfile');
  await renderWithProviders(<EditProfileScreen />);
  await waitFor(() => expect(screen.getByLabelText('Visningsnavn').props.value).toBe('Marius B.'));
  await fireEvent.changeText(screen.getByLabelText('Presentasjon'), 'Hjelper gjerne.');
  await fireEvent.press(screen.getByRole('button', { name: 'Lagre endringer' }));
  await waitFor(() => expect(spy).toHaveBeenCalled());
  expect(spy.mock.calls[0][0]).not.toHaveProperty('availableWeekdays');
  spy.mockRestore();
});

test('tick lørdag and søndag in Rediger profil → the profile says «Ledig helg»', async () => {
  const edit = await renderWithProviders(<EditProfileScreen />);
  await fireEvent.press(await screen.findByRole('checkbox', { name: 'lørdag' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'søndag' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Lagre endringer' }));
  await waitFor(() => expect(profileRepository.getProfile(profileRepository.currentUserId)?.availableWeekdays).toEqual([0, 6]));
  edit.unmount();

  await renderWithProviders(<ProfileScreen />);
  expect(await screen.findByText('Ledig helg')).toBeTruthy();
});
