import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { renderWithProviders } from '../testUtils';

test('shows the unread count, filter chips with counts and grouped rows', async () => {
  await renderWithProviders(<NotificationsScreen />);
  await waitFor(() => expect(screen.getByText('Nytt tilbud fra Emma Larsen')).toBeTruthy());
  expect(screen.getByText('uleste varsler')).toBeTruthy();
  expect(screen.getByLabelText('Alle, 4')).toBeTruthy();
  expect(screen.getByLabelText('Tilbud, 2')).toBeTruthy();
  expect(screen.getByText('Tidligere')).toBeTruthy();
  expect(screen.getByText('Velg hva du vil bli varslet om')).toBeTruthy();
});

test('a filter narrows the list; "Bare uleste" hides read rows', async () => {
  await renderWithProviders(<NotificationsScreen />);
  await waitFor(() => expect(screen.getByText('Ny melding fra Sara Ahmed')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Tilbud, 2'));
  expect(screen.queryByText('Ny melding fra Sara Ahmed')).toBeNull();
  expect(screen.getByText('Tilbud godtatt')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Meldinger, 1'));
  await fireEvent.press(screen.getByRole('switch', { name: 'Bare uleste' }));
  expect(screen.getByText('Ingen varsler her ennå')).toBeTruthy();
  await fireEvent.press(screen.getByText('Vis alle varsler'));
  expect(screen.getByText('Ny melding fra Sara Ahmed')).toBeTruthy();
});

test('mark all read updates the count to "Alt er lest"', async () => {
  await renderWithProviders(<NotificationsScreen />);
  await waitFor(() => expect(screen.getByText('uleste varsler')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Merk alle som lest'));
  await waitFor(() => expect(screen.getByText('Alt er lest')).toBeTruthy());
});
