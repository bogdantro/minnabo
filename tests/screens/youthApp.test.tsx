import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { YouthAppScreen } from '@/screens/youth/YouthAppScreen';
import { apiClient } from '@/api/client';
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
