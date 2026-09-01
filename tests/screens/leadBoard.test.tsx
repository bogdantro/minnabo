import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { LeadBoardScreen } from '@/screens/LeadBoardScreen';
import { dismissedLeads } from '@/lib/dismissedLeads';
import { renderWithProviders } from '../testUtils';

beforeEach(() => dismissedLeads._reset());

test('the lead board lists open tasks and can dismiss one', async () => {
  await renderWithProviders(<LeadBoardScreen />);

  const dismissButtons = await screen.findAllByText('Ikke aktuelt');
  const countBefore = dismissButtons.length;
  expect(countBefore).toBeGreaterThan(0);

  await fireEvent.press(dismissButtons[0]);

  await waitFor(() =>
    expect(screen.queryAllByText('Ikke aktuelt').length).toBe(countBefore - 1),
  );
});
