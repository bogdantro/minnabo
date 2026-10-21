import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { safePush } from '@/lib/nav';
import { PushBridge, REVIEW_CATEGORY, reviewRouteFor } from '@/components/PushBridge';
import { ReviewScreen } from '@/screens/ReviewScreen';
import { profileRepository } from '@mocks/data/profileRepository';
import { renderWithProviders } from '../testUtils';

jest.mock('@/lib/nav', () => ({ safePush: jest.fn() }));

// the module object the app itself requires (an `import * as` copy wouldn't be seen by it)
const N = jest.requireMock('expo-notifications') as Record<string, jest.Mock>;
let respond: ((r: unknown) => void) | undefined;

beforeEach(() => {
  N.setNotificationCategoryAsync = jest.fn().mockResolvedValue(null);
  N.getLastNotificationResponseAsync = jest.fn().mockResolvedValue(null);
  N.addNotificationResponseReceivedListener = jest.fn((l: (r: unknown) => void) => {
    respond = l;
    return { remove: jest.fn() };
  });
  (safePush as jest.Mock).mockClear();
});

const tap = (action: string, route = '/vurder/p-emma-klippe') =>
  respond?.({ actionIdentifier: action, notification: { request: { content: { data: { route } } } } });

test('the review reminder gets star buttons: five stars, four stars and «Skriv vurdering»', async () => {
  await renderWithProviders(<PushBridge />);
  await waitFor(() => expect(N.setNotificationCategoryAsync).toHaveBeenCalled());
  const [id, actions] = N.setNotificationCategoryAsync.mock.calls[0];
  expect(id).toBe(REVIEW_CATEGORY);
  expect(actions.map((a: { buttonTitle: string }) => a.buttonTitle)).toEqual(['★★★★★', '★★★★', 'Skriv vurdering']);
});

test('a star button opens the review with those stars already chosen; a plain tap just opens it', async () => {
  await renderWithProviders(<PushBridge />);
  await waitFor(() => expect(respond).toBeDefined());
  tap('stars-5');
  expect(safePush).toHaveBeenLastCalledWith('/vurder/p-emma-klippe?stjerner=5');
  tap('stars-4');
  expect(safePush).toHaveBeenLastCalledWith('/vurder/p-emma-klippe?stjerner=4');
  tap('expo.modules.notifications.actions.DEFAULT'); // a tap on the notification itself
  expect(safePush).toHaveBeenLastCalledWith('/vurder/p-emma-klippe');
});

test('star buttons only ever add stars to a review link', () => {
  expect(reviewRouteFor('/vurder/p1', 'stars-5')).toBe('/vurder/p1?stjerner=5');
  expect(reviewRouteFor('/avtale/p1', 'stars-5')).toBe('/avtale/p1');
  expect(reviewRouteFor('/vurder/p1', 'stars-9')).toBe('/vurder/p1');
});

test('opened from a star button, the review already has the stars – one tap on «Send vurdering» sends it', async () => {
  await renderWithProviders(<ReviewScreen proposalId="p-emma-klippe" initialRating={5} />);
  expect(await screen.findByText('Fantastisk!')).toBeTruthy();
  await fireEvent.press(screen.getByText('Send vurdering'));
  await waitFor(() => expect(profileRepository.hasReviewed('p-emma-klippe', profileRepository.currentUserId)).toBe(true));
  const mine = profileRepository.reviewsWrittenBy(profileRepository.currentUserId).find((r) => r.agreementProposalId === 'p-emma-klippe');
  expect(mine?.rating).toBe(5);
});
