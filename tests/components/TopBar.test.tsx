import { screen, fireEvent } from '@testing-library/react-native';
import { HomeTopBar } from '@/components/TopBar';
import { renderWithProviders } from '../testUtils';

test('profile shortcut has the bokmål a11y label and fires', async () => {
  const fn = jest.fn();
  await renderWithProviders(
    <HomeTopBar
      avatar={{ initials: 'MB' }}
      onProfilePress={fn}
      onNotificationsPress={() => {}}
      unreadNotifications
    />,
  );
  await fireEvent.press(screen.getByLabelText('Åpne profil'));
  expect(fn).toHaveBeenCalled();
});

test('shows the notification dot when there are unread notifications', async () => {
  await renderWithProviders(
    <HomeTopBar
      testID="bar"
      avatar={{ initials: 'MB' }}
      onProfilePress={() => {}}
      onNotificationsPress={() => {}}
      unreadNotifications
    />,
  );
  expect(screen.getByTestId('bar-noti-dot')).toBeTruthy();
});
