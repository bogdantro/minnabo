import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { NoticeboardScreen } from '@/screens/NoticeboardScreen';
import { noticeboardStore } from '@/data/noticeboardStore';
import { renderWithProviders } from '../testUtils';

beforeEach(() => noticeboardStore._reset());

test('the noticeboard lists seeded posts and filters by kind', async () => {
  await renderWithProviders(<NoticeboardScreen />);
  await waitFor(() => expect(screen.getByText('Gis bort: barnesykkel 16"')).toBeTruthy());

  // Gjøvik's "Låner ut: slagbormaskin og stige" is now scoped out for the
  // Lillehammer demo user, so filter to another kind that has a Lillehammer post.
  await fireEvent.press(screen.getByRole('button', { name: 'Mistet / funnet' }));
  expect(await screen.findByText('Funnet: nøkkelknippe ved Søndre park')).toBeTruthy();
  await waitFor(() =>
    expect(screen.queryByText('Gis bort: barnesykkel 16"')).toBeNull(),
  );
});

test('publishing a post adds it to the store', async () => {
  await renderWithProviders(<NoticeboardScreen />);
  const before = noticeboardStore.list().length;

  await fireEvent.press(screen.getByText('Nytt oppslag'));
  await fireEvent.changeText(await screen.findByLabelText('Overskrift'), 'Gis bort: pallekarmer');
  await fireEvent.changeText(screen.getByLabelText('Beskrivelse'), 'Fire stykker, hentes snarest.');
  await fireEvent.press(screen.getByText('Publiser oppslag'));

  await waitFor(() => expect(noticeboardStore.list().length).toBe(before + 1));
});
