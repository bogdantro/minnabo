import { fireEvent, screen } from '@testing-library/react-native';
import { PublishedScreen } from '@/screens/LeggUt/PublishedScreen';
import { renderWithProviders } from '../testUtils';

const { router } = jest.requireMock('expo-router');

beforeEach(() => jest.clearAllMocks());

/**
 * Bug 2026-11-07: after publishing, «Se oppføringen» replaced only the last screen, so the wizard stayed in
 * the history and «Tilbake» on the oppdrag went straight back into the form steps.
 */
test('«Se oppføringen» takes the wizard off the history before opening the oppdrag', async () => {
  await renderWithProviders(<PublishedScreen listingId="l-klippe-plen" />);
  await fireEvent.press(await screen.findByText('Se oppføringen'));
  expect(router.dismissAll).toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith('/oppdrag/l-klippe-plen');
  expect(router.replace).not.toHaveBeenCalled();
  // the history is cleared first, then the oppdrag is opened
  expect(router.dismissAll.mock.invocationCallOrder[0]).toBeLessThan(router.push.mock.invocationCallOrder[0]);
});

test('«Til forsiden» also leaves the wizard behind instead of putting a new front page on top of it', async () => {
  await renderWithProviders(<PublishedScreen listingId="l-klippe-plen" />);
  await fireEvent.press(await screen.findByText('Til forsiden'));
  expect(router.dismissAll).toHaveBeenCalled();
  expect(router.navigate).toHaveBeenCalledWith('/');
  expect(router.replace).not.toHaveBeenCalled();
});
