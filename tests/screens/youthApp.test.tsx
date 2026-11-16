import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { YouthAppScreen } from '@/screens/youth/YouthAppScreen';
import { TaskDetailScreen } from '@/screens/TaskDetailScreen';
import { repositories } from '@mocks/data/repositories';
import { apiClient } from '@/api/client';
import nb from '@/i18n/nb';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  jest
    .spyOn(apiClient, 'getMyAccount')
    .mockResolvedValue({ vipps: true, youth: true, age: 16, birthYear: 2010, fullName: 'Emil Nygård', phoneMasked: '+47 ••• •• 518' });
});
afterEach(() => jest.restoreAllMocks());

test('youth app has four tabs and no Legg ut', async () => {
  await renderWithProviders(<YouthAppScreen />);
  for (const t of ['Oppdrag', 'Mine tilbud', 'Innboks', 'Profil']) {
    expect(screen.getAllByText(t).length).toBeGreaterThan(0);
  }
  expect(screen.queryByText('Legg ut')).toBeNull();
  expect(screen.getAllByText('Ungdomskonto').length).toBeGreaterThan(0);
});

test('tapping an oppdrag opens its own page, not a popup', async () => {
  const { router } = require('expo-router');
  const push = jest.spyOn(router, 'push');
  await renderWithProviders(<YouthAppScreen />);
  await fireEvent.press(await screen.findByText('Klippe plen'));
  expect(push).toHaveBeenCalledWith('/oppdrag/l-klippe-plen');
  push.mockRestore();
});

test('on the oppdrag page a youth gets «Gi tilbud» and the note, never «Send melding»', async () => {
  const listing = repositories.listings.get('l-klippe-plen')!;
  await renderWithProviders(<TaskDetailScreen listing={listing} onBack={() => {}} />);
  expect(await screen.findByText(nb.youth.msgAfterOffer)).toBeTruthy();
  expect(screen.getAllByText('Gi tilbud').length).toBeGreaterThan(0);
  expect(screen.queryByText('Send melding')).toBeNull();
});

/** A tilbud this youth has already sent, the way «Gi tilbud» on the oppdrag page leaves it. */
async function sentOffer() {
  const conv = await apiClient.startConversationForListing('l-klippe-plen');
  await apiClient.sendProposal({ conversationId: conv.id, listingId: 'l-klippe-plen', priceAmountMinor: 35000, message: 'Jeg har klipt plen mange ganger før.', scheduledText: 'Fleksibelt', scheduledAt: null });
}

test('a sent tilbud shows under Mine tilbud and is withdrawn in two steps', async () => {
  await sentOffer();
  await renderWithProviders(<YouthAppScreen />);
  await fireEvent.press(screen.getAllByText('Mine tilbud').at(-1)!);
  expect(await screen.findByText('Klippe plen')).toBeTruthy();
  const withdraw = jest.spyOn(apiClient, 'respondToProposal');
  await fireEvent.press(await screen.findByText('Trekk'));
  await fireEvent.press(await screen.findByText('Ja, trekk tilbudet'));
  expect(withdraw).not.toHaveBeenCalled();
  await fireEvent.press(await screen.findByText('Trekk tilbudet nå'));
  await waitFor(() => expect(withdraw).toHaveBeenCalled());
});

test('«Behold tilbudet» leaves the offer alone', async () => {
  await sentOffer();
  await renderWithProviders(<YouthAppScreen />);
  await fireEvent.press(screen.getAllByText('Mine tilbud').at(-1)!);
  await fireEvent.press(await screen.findByText('Trekk'));
  const withdraw = jest.spyOn(apiClient, 'respondToProposal');
  await fireEvent.press(await screen.findByText('Behold tilbudet'));
  expect(withdraw).not.toHaveBeenCalled();
});

test('the youth tab bar has a blue «Tilby hjelp» that opens the offer wizard', async () => {
  const { router } = require('expo-router');
  const push = jest.spyOn(router, 'push');
  await renderWithProviders(<YouthAppScreen />);
  // the last one is the tab bar: the card on the page comes first
  const buttons = await screen.findAllByRole('button', { name: 'Tilby hjelp' });
  await fireEvent.press(buttons[buttons.length - 1]);
  expect(push).toHaveBeenCalledWith('/legg-ut/tilbyr');
  push.mockRestore();
});

test('Oppslagstavle and Lagrede søk are open, only the real locks stay', async () => {
  await renderWithProviders(<YouthAppScreen />);
  await fireEvent.press(screen.getAllByText('Profil')[0]);
  expect(screen.queryByText('Vurdere andre')).toBeNull();
  expect(screen.getByText('Oppslagstavle')).toBeTruthy();
  expect(screen.getByText('Lagrede søk')).toBeTruthy();
  await fireEvent.press(screen.getByText('Oppslagstavle'));
  expect(screen.queryByText('Oppslagstavle er ikke tilgjengelig')).toBeNull();
});

test('locked features open the "ikke tilgjengelig" sheet', async () => {
  await renderWithProviders(<YouthAppScreen />);
  await fireEvent.press(screen.getAllByText('Profil')[0]);
  await fireEvent.press(screen.getByText('Legg ut oppdrag'));
  expect(screen.getByText('Legg ut oppdrag er ikke tilgjengelig')).toBeTruthy();
});

/** The signed-in profile as it is for a youth account: no kommune, since Oppsett is skipped. */
function withoutKommune() {
  const real = apiClient.getProfile.bind(apiClient);
  jest.spyOn(apiClient, 'getProfile').mockImplementation(async (id: string) => {
    const p = await real(id);
    return { ...p, location: { ...p.location, municipality: '', place: '' } };
  });
}

test('a youth account without a kommune is asked for one straight away, not shown oppdrag from everywhere', async () => {
  withoutKommune();
  const list = jest.spyOn(apiClient, 'listListings');
  await renderWithProviders(<YouthAppScreen />);
  expect(await screen.findByText('Hvor vil du se oppdrag?')).toBeTruthy();
  // no unfiltered fetch of every oppdrag in the country while the kommune is missing
  expect(list.mock.calls.every(([params]) => (params?.filter?.municipalities?.length ?? 0) > 0)).toBe(true);
});

// ------------------------------------------------------------
// «Tilbyr hjelp» for youth accounts (asked 2026-11-03, migration 0084)
// ------------------------------------------------------------
test('a youth can start «Tilby hjelp» from the oppdrag list and find what they offer under Profil', async () => {
  const { router } = jest.requireMock('expo-router');
  await renderWithProviders(<YouthAppScreen />);
  await fireEvent.press((await screen.findAllByText('Tilby hjelp'))[0]);
  expect(router.push).toHaveBeenCalledWith('/legg-ut/tilbyr');
  await fireEvent.press(screen.getAllByText('Profil')[0]);
  await fireEvent.press(screen.getByText('Det jeg tilbyr'));
  expect(router.push).toHaveBeenCalledWith('/mine');
});

test('a chat a nabo started on the youth’s own offer shows in Innboks', async () => {
  const real = apiClient.listConversations.bind(apiClient);
  jest.spyOn(apiClient, 'listConversations').mockImplementation(async (opts) => {
    const list = await real(opts);
    const base = list[0];
    return [
      ...list,
      {
        ...base,
        id: 'conv-offer-1',
        listing: { ...base.listing, id: 'l-offer-1', title: 'Jeg lufter hunder', type: 'SERVICE_OFFER' },
        counterpart: { ...base.counterpart, displayName: 'Kari H.' },
        lastMessagePreview: 'Kan du lufte Bamse på lørdag?',
        lastMessageMine: false,
        unread: true,
      },
    ];
  });
  await renderWithProviders(<YouthAppScreen />);
  await fireEvent.press(screen.getAllByText('Innboks')[0]);
  await waitFor(() => expect(screen.getByText('Jeg lufter hunder')).toBeTruthy());
  expect(screen.getByText('Kan du lufte Bamse på lørdag?')).toBeTruthy();
  expect(screen.getByText('Spør deg om hjelp')).toBeTruthy();
});

test('a youth account can add a profile picture from Profil, and it is saved at once', async () => {
  const uploads = require('@/lib/uploads');
  jest.spyOn(uploads, 'pickAndUpload').mockResolvedValue({ path: 'u-mb/meg.jpg', publicUrl: 'https://example.invalid/meg.jpg' });
  const update = jest.spyOn(apiClient, 'updateProfile');
  await renderWithProviders(<YouthAppScreen />);
  await fireEvent.press(screen.getAllByText('Profil')[0]);
  await fireEvent.press(await screen.findByLabelText('Endre profilbilde'));
  await fireEvent.press(await screen.findByText('Velg fra album'));
  await waitFor(() => expect(update).toHaveBeenCalledWith({ avatarPath: 'u-mb/meg.jpg' }));
});
