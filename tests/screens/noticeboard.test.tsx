import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { NoticeboardScreen } from '@/screens/NoticeboardScreen';
import { noticeboardStore } from '@mocks/data/noticeboardStore';
import { renderWithProviders } from '../testUtils';

beforeEach(() => noticeboardStore._reset());

test('the noticeboard lists posts in my kommune and filters by kind', async () => {
  await renderWithProviders(<NoticeboardScreen />);
  await waitFor(() => expect(screen.getByText('Gis bort: barnesykkel 16"')).toBeTruthy());
  expect(screen.getByText('Oppslag fra naboene')).toBeTruthy();
  // Gjøvik's tool-lending post is outside the Lillehammer demo user's kommune.
  expect(screen.queryByText('Låner ut: slagbormaskin og stige')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: /^Mistet og funnet, \d+$/ }));
  expect(await screen.findByText('Funnet: nøkkelknippe ved Søndre park')).toBeTruthy();
  await waitFor(() => expect(screen.queryByText('Gis bort: barnesykkel 16"')).toBeNull());
});

test('compose validates type, title and text before publishing', async () => {
  await renderWithProviders(<NoticeboardScreen />);
  const before = noticeboardStore.list().length;

  await fireEvent.press((await screen.findAllByLabelText('Nytt oppslag'))[0]);
  await fireEvent.press(await screen.findByText('Publiser oppslag'));
  expect(screen.getByText('Velg hva slags oppslag det er')).toBeTruthy();
  expect(screen.getByText('Skriv en tittel på minst 4 tegn')).toBeTruthy();
  expect(screen.getByText('Skriv litt mer, minst 10 tegn')).toBeTruthy();

  await fireEvent.press(screen.getByRole('radio', { name: 'Gis bort' }));
  await fireEvent.changeText(screen.getByLabelText('Tittel'), 'Gis bort: pallekarmer');
  await fireEvent.changeText(screen.getByLabelText('Tekst'), 'Fire stykker, hentes snarest.');
  await fireEvent.press(screen.getByText('Publiser oppslag'));

  await waitFor(() => expect(noticeboardStore.list().length).toBe(before + 1));
  expect(noticeboardStore.list()[0]).toMatchObject({ kind: 'GIVEAWAY', municipality: 'Lillehammer' });
});

test('"Lagre" saves an oppslag, and "Svar" adds a public comment under it', async () => {
  await renderWithProviders(<NoticeboardScreen />);
  await waitFor(() => expect(screen.getByText('Gis bort: barnesykkel 16"')).toBeTruthy());

  await fireEvent.press(screen.getAllByText('Lagre')[0]);
  await waitFor(() => expect(screen.getByText('Lagret')).toBeTruthy());
  expect(noticeboardStore.savedIds()).toHaveLength(1);

  await fireEvent.press(screen.getByLabelText('Svar på Gis bort: barnesykkel 16", 0 svar'));
  expect(await screen.findByText('Ingen svar ennå. Bli den første.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Ditt svar'), 'Er den fortsatt ledig?');
  await fireEvent.press(screen.getAllByText('Svar').slice(-1)[0]);
  expect(await screen.findByText('Er den fortsatt ledig?')).toBeTruthy();
  await waitFor(() => expect(noticeboardStore.comments('n-seed-1')).toHaveLength(1));
  // the card now counts it
  await waitFor(() => expect(screen.getByText('1 svar')).toBeTruthy());
});

test('the owner can edit an oppslag and mark it as done', async () => {
  const mine = noticeboardStore.create({ kind: 'GIVEAWAY', title: 'Gis bort: bokhylle', body: 'Hvit bokhylle, hentes i dag.', place: 'Lillehammer', municipality: 'Lillehammer' });
  await renderWithProviders(<NoticeboardScreen />);
  await waitFor(() => expect(screen.getByText('Gis bort: bokhylle')).toBeTruthy());

  await fireEvent.press(screen.getByLabelText('Rediger Gis bort: bokhylle'));
  await fireEvent.changeText(await screen.findByLabelText('Tittel'), 'Gis bort: hvit bokhylle');
  await fireEvent.press(screen.getByText('Lagre endringer'));
  await waitFor(() => expect(noticeboardStore.get(mine.id)?.title).toBe('Gis bort: hvit bokhylle'));

  await fireEvent.press(await screen.findByLabelText('Marker som avsluttet: Gis bort: hvit bokhylle'));
  await waitFor(() => expect(noticeboardStore.get(mine.id)?.doneAt).toBeTruthy());
  expect(await screen.findByText('Avsluttet')).toBeTruthy();
});
