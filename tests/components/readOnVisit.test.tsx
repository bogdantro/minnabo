import { waitFor } from '@testing-library/react-native';
import { profileRepository } from '@mocks/data/profileRepository';
import { NotificationsReadOnVisit } from '@/components/NotificationsReadOnVisit';
import { renderWithProviders } from '../testUtils';

// the component reads usePathname from the mocked module at render time
const expoRouter = jest.requireMock('expo-router');
const realPathname = expoRouter.usePathname;
const at = (path: string) => {
  expoRouter.usePathname = () => path;
};
afterEach(() => {
  expoRouter.usePathname = realPathname;
});

const unread = (id: string) => profileRepository.listNotifications().find((n) => n.id === id)?.read === false;

// Bug: opening a chat from Innboks (or from a push) left its notification unread on Varsler –
// only a tap on the notification itself marked it read.
test('opening the screen a notification points to marks that notification read', async () => {
  expect(unread('n1')).toBe(true); // '/chat/c-emma'
  expect(unread('n2')).toBe(true); // '/chat/c-martin'
  at('/chat/c-emma');
  await renderWithProviders(<NotificationsReadOnVisit />);
  await waitFor(() => expect(unread('n1')).toBe(false));
  // other notifications are left alone
  expect(unread('n2')).toBe(true);
});

test('a route with a query string still counts as the same screen', async () => {
  const n = profileRepository.listNotifications().find((x) => x.id === 'n2')!;
  n.route = '/chat/c-martin?tab=tilbud';
  at('/chat/c-martin');
  await renderWithProviders(<NotificationsReadOnVisit />);
  await waitFor(() => expect(unread('n2')).toBe(false));
});
