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
  await fireEvent.press(screen.getByText('Trekk'));
  await waitFor(() => expect(screen.getByText('Trukket')).toBeTruthy());
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
