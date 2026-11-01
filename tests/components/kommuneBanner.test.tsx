import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { profileRepository } from '@mocks/data/profileRepository';
import { Screen } from '@/components/ui';
import { renderWithProviders } from '../testUtils';

const expoRouter = jest.requireMock('expo-router');
const realPathname = expoRouter.usePathname;
afterEach(() => {
  expoRouter.usePathname = realPathname;
});

const Page = () => (
  <Screen header={<View />}>
    <Text>Innhold</Text>
  </Screen>
);
const me = () => profileRepository.getProfile(profileRepository.currentUserId)!;

test('a profile without a kommune gets a banner on every screen, and choosing one saves it', async () => {
  profileRepository.updateProfile({ municipality: '', place: '' });
  await renderWithProviders(<Page />);
  expect(await screen.findByTestId('kommune-banner')).toBeTruthy();
  expect(screen.getByText('Velg kommunen din')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('kommune-banner'));
  await fireEvent.press(await screen.findByRole('button', { name: 'Øyer' }));
  await waitFor(() => expect(me().location.municipality).toBe('Øyer'));
  expect(me().location.place).toBe('Øyer');
  await waitFor(() => expect(screen.queryByTestId('kommune-banner')).toBeNull());
});

test('with a kommune there is no banner', async () => {
  await renderWithProviders(<Page />);
  await screen.findByText('Innhold');
  await new Promise((r) => setTimeout(r, 300));
  expect(screen.queryByTestId('kommune-banner')).toBeNull();
});

test('not during Oppsett – it asks for the kommune itself', async () => {
  profileRepository.updateProfile({ municipality: '', place: '' });
  expoRouter.usePathname = () => '/oppsett';
  await renderWithProviders(<Page />);
  await screen.findByText('Innhold');
  await new Promise((r) => setTimeout(r, 300));
  expect(screen.queryByTestId('kommune-banner')).toBeNull();
});
