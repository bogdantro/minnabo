import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { DraftCard } from '@/components/DraftCard';
import { emptyWizard, wizardDraft } from '@/screens/LeggUt/wizardModel';
import { renderWithProviders } from '../testUtils';

beforeEach(async () => {
  jest.clearAllMocks();
  await wizardDraft.clear();
});

test('a half-written oppdrag shows on Oppdrag: Fortsett opens Legg ut, Forkast throws it away', async () => {
  await wizardDraft.save({ ...emptyWizard('Lillehammer'), cat: 'hage', title: 'Rake løv' }, 3);
  await renderWithProviders(<DraftCard />);
  expect(await screen.findByText('Du har et utkast')).toBeTruthy();
  expect(screen.getByText('Rake løv')).toBeTruthy();
  expect(screen.getAllByText('Steg 3 av 8').length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByText('Fortsett'));
  expect(router.push).toHaveBeenCalledWith('/legg-ut');
  await fireEvent.press(screen.getByText('Forkast'));
  await waitFor(() => expect(screen.queryByTestId('draft-card')).toBeNull());
  expect(await wizardDraft.load()).toBeNull();
});

test('an empty draft (nothing chosen yet) shows nothing', async () => {
  await wizardDraft.save(emptyWizard('Lillehammer'), 1);
  await renderWithProviders(<DraftCard />);
  await new Promise((r) => setTimeout(r, 100));
  expect(screen.queryByTestId('draft-card')).toBeNull();
});
