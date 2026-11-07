import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { SearchScreen } from '@/screens/SearchScreen';
import { renderWithProviders } from '../testUtils';

const PH = 'Søk etter plen, flytting, datahjelp …';

test('shows an empty state for a query with no matches', async () => {
  await renderWithProviders(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText(PH), 'xyzzy');
  await waitFor(() => expect(screen.getByText('Ingen treff på «xyzzy»')).toBeTruthy());
  expect(screen.getByText('Legg ut et oppdrag')).toBeTruthy();
});

test('a search finds both oppdrag and «Tilbyr hjelp» (asked 2026-11-06)', async () => {
  await renderWithProviders(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText(PH), 'plen');
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  expect(screen.getByText('Jeg kan klippe plenen din')).toBeTruthy();
});

test('the kind switch narrows a search to one kind of post', async () => {
  await renderWithProviders(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText(PH), 'plen');
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  await fireEvent.press(screen.getByRole('tab', { name: 'Tilbyr hjelp' }));
  await waitFor(() => expect(screen.queryByText('Klippe plen')).toBeNull());
  expect(screen.getByText('Jeg kan klippe plenen din')).toBeTruthy();
});

test('«Kart» fills the screen with a real map, and a tap on a circle lists that area', async () => {
  await renderWithProviders(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText(PH), 'plen');
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  await fireEvent.press(screen.getByText('Vis på kart'));
  const map = await screen.findByTestId('listings-map');
  await fireEvent(map, 'layout', { nativeEvent: { layout: { width: 390, height: 800 } } });
  expect(screen.getByText('Sirklene viser omtrentlig område, aldri en adresse.')).toBeTruthy();
  expect(screen.getByText('© Kartverket')).toBeTruthy();
  await fireEvent.press(screen.getAllByRole('button', { name: /oppføring/ })[0]);
  expect(await screen.findByText('Vis alle')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Tilbake til listen'));
  await waitFor(() => expect(screen.queryByTestId('listings-map')).toBeNull());
});

test('the filters have no «Kun verifiserte»: everyone is verified with Vipps', async () => {
  await renderWithProviders(<SearchScreen />);
  await fireEvent.press(screen.getByLabelText('Åpne filtre'));
  expect(screen.queryByText('Kun verifiserte')).toBeNull();
});

test('results cover Lillehammer, Øyer and Gausdal as one area (asked 2026-11-04)', async () => {
  await renderWithProviders(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText(PH), 'vaskehjelp');
  // "Vaskehjelp før visning" is in Øyer – the same area as Lillehammer
  await waitFor(() => expect(screen.getByText('Vaskehjelp før visning')).toBeTruthy());
});

test('an initialCategory pre-filters and shows as an active filter chip', async () => {
  await renderWithProviders(<SearchScreen initialCategory="hage" />);
  expect(screen.getByLabelText('Fjern filter Hage')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  expect(screen.queryByText('Hjelp med flytting')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Fjern filter Hage'));
  await waitFor(() => expect(screen.getByText('Hjelp med flytting')).toBeTruthy());
});

test('recent and popular searches show when the field is empty', async () => {
  await renderWithProviders(<SearchScreen />);
  expect(await screen.findByText('Populært i Lillehammer')).toBeTruthy();
  await fireEvent.press(screen.getByText('Plen'));
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
});
