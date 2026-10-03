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
