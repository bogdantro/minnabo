import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { NotificationPrefsScreen } from '@/screens/NotificationPrefsScreen';
import { settingsStore } from '@mocks/data/settingsStore';
import { profileRepository } from '@mocks/data/profileRepository';
import { renderWithProviders } from '../testUtils';

test('Innstillinger shows account data and saves the push channel switch', async () => {
  await renderWithProviders(<SettingsScreen />);
  expect(await screen.findByText('marius.b@epost.no')).toBeTruthy();
  expect(screen.getByText('Lillehammer kommune')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Push-varsler'));
  await waitFor(() => expect(settingsStore.get().notificationPrefs.channels.push).toBe(false));
});

test('Innstillinger feriemodus pauses the profile and shows the notice', async () => {
  await renderWithProviders(<SettingsScreen />);
  await screen.findByText(/Medlem siden 2026/); // switch is enabled once the profile has loaded
  await fireEvent.press(screen.getByLabelText('Feriemodus'));
  await waitFor(() => expect(profileRepository.getProfile(profileRepository.currentUserId)?.paused).toBe(true));
  expect(await screen.findByText(/^Aktiv – /)).toBeTruthy();
});

test('Innstillinger asks before logging out', async () => {
  await renderWithProviders(<SettingsScreen />);
  await fireEvent.press(screen.getByText('Logg ut'));
  expect(await screen.findByText('Logge ut?')).toBeTruthy();
});

test('Varslinger saves each push/e-post switch and the master pause', async () => {
  await renderWithProviders(<NotificationPrefsScreen />);
  // nye oppdrag and oppslag i nabolaget are on by default
  expect(await screen.findByText('10 push og 4 e-post er på')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Nye meldinger, e-post'));
  await waitFor(() => expect(settingsStore.get().notificationPrefs.email.msg).toBe(true));
  expect(await screen.findByText('10 push og 5 e-post er på')).toBeTruthy();

  await fireEvent.press(screen.getByRole('switch', { name: 'Alle varsler' }));
  await waitFor(() => expect(settingsStore.get().notificationPrefs.master).toBe(false));
  expect(screen.getByText(/Alle varsler er satt på pause/)).toBeTruthy();
});

test('Varslinger quiet hours: pick a new start time', async () => {
  await renderWithProviders(<NotificationPrefsScreen />);
  // stille timer is off by default – switched on, the hours are ready to change
  await fireEvent.press(await screen.findByRole('switch', { name: 'Stille timer' }));
  await waitFor(() => expect(settingsStore.get().notificationPrefs.quiet.on).toBe(true));
  await screen.findByText('22:00');
  await fireEvent.press(screen.getByLabelText('Endre starttid'));
  await fireEvent.press(screen.getByRole('radio', { name: '23:00' }));
  await waitFor(() => expect(settingsStore.get().notificationPrefs.quiet.from).toBe('23:00'));
});

test('Varslinger sends a local test notification', async () => {
  const Notifications = require('expo-notifications');
  await renderWithProviders(<NotificationPrefsScreen />);
  await fireEvent.press(await screen.findByText('Send et testvarsel'));
  await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled());
});
