import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { LeadBoardScreen } from '@/screens/LeadBoardScreen';
import { dismissedLeads } from '@/lib/dismissedLeads';
import { renderWithProviders } from '../testUtils';

beforeEach(() => dismissedLeads._reset());

test('the lead board lists open tasks and can dismiss one', async () => {
  await renderWithProviders(<LeadBoardScreen />);

  await screen.findAllByText('Ikke aktuelt');
  // let the kommune scope settle so the count is stable
  await waitFor(() => expect(screen.queryByText('Vaskehjelp før visning')).toBeNull());
  const countBefore = screen.queryAllByText('Ikke aktuelt').length;
  expect(countBefore).toBeGreaterThan(0);

  await fireEvent.press(screen.getAllByText('Ikke aktuelt')[0]);

  await waitFor(() =>
    expect(screen.queryAllByText('Ikke aktuelt').length).toBe(countBefore - 1),
  );
});

test('the lead board is scoped to the user kommune (Lillehammer)', async () => {
  await renderWithProviders(<LeadBoardScreen />);

  // a Lillehammer task request is listed
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  // tasks from other kommuner are filtered out
  await waitFor(() => {
    expect(screen.queryByText('Vaskehjelp før visning')).toBeNull(); // Øyer
    expect(screen.queryByText('Montere garderobeskap')).toBeNull(); // Gausdal
  });
});
