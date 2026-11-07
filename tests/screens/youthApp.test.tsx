import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { YouthAppScreen } from '@/screens/youth/YouthAppScreen';
import { apiClient } from '@/api/client';
import { toast } from '@/lib/toast';
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

test('giving an offer validates, sends and shows it under Mine tilbud', async () => {
  await renderWithProviders(<YouthAppScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  await fireEvent.press(screen.getByText('Klippe plen'));
  await fireEvent.press(screen.getByText('Gi tilbud'));
  await fireEvent.changeText(screen.getByLabelText('Pris'), '');
  await fireEvent.press(screen.getByText('Send tilbud'));
  expect(screen.getByText('Skriv inn en pris')).toBeTruthy();
  expect(screen.getByText('Skriv minst 10 tegn')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Pris'), '350');
  await fireEvent.changeText(screen.getByLabelText('Melding'), 'Jeg har klipt plen mange ganger før.');
  await fireEvent.press(screen.getByText('Send tilbud'));
  await waitFor(() => expect(screen.getByText(/Tilbudet er sendt til/)).toBeTruthy(), { timeout: 4000 });
  await fireEvent.press(screen.getByText('Se Mine tilbud'));
  await waitFor(() => expect(screen.getByText('Sendt nå')).toBeTruthy());
  // two steps before anything happens
  const withdraw = jest.spyOn(apiClient, 'respondToProposal');
  await fireEvent.press(screen.getByText('Trekk'));
  await fireEvent.press(await screen.findByText('Ja, trekk tilbudet'));
  expect(withdraw).not.toHaveBeenCalled();
  await fireEvent.press(await screen.findByText('Trekk tilbudet nå'));
  await waitFor(() => expect(withdraw).toHaveBeenCalled());
  await waitFor(() => expect(screen.getAllByText('Trukket').length).toBeGreaterThan(0));
});

test('«Behold tilbudet» leaves the offer alone', async () => {
  await renderWithProviders(<YouthAppScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  await fireEvent.press(screen.getByText('Klippe plen'));
  await fireEvent.press(screen.getByText('Gi tilbud'));
  await fireEvent.changeText(screen.getByLabelText('Pris'), '350');
  await fireEvent.changeText(screen.getByLabelText('Melding'), 'Jeg har klipt plen mange ganger før.');
  // date and time are optional
  await fireEvent.press(screen.getByText('Send tilbud'));
  await fireEvent.press(await screen.findByText('Se Mine tilbud', {}, { timeout: 4000 }));
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

test('a technical error when sending an offer shows a friendly message, never the raw text', async () => {
  const err = jest.spyOn(toast, 'error');
  jest.spyOn(apiClient, 'sendProposal').mockRejectedValue(new Error('TypeError: Network request failed'));
  await renderWithProviders(<YouthAppScreen />);
  await fireEvent.press(await screen.findByText('Klippe plen'));
  await fireEvent.press(screen.getByText('Gi tilbud'));
  await fireEvent.changeText(screen.getByLabelText('Pris'), '350');
  await fireEvent.changeText(screen.getByLabelText('Melding'), 'Jeg har klipt plen mange ganger før.');
  await fireEvent.press(screen.getByText('Send tilbud'));
  await waitFor(() => expect(err).toHaveBeenCalled());
  expect(err).toHaveBeenCalledWith(nb.giTilbud.sendFailed);
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
