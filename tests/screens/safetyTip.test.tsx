import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firstJobWith, tipFor } from '@/components/SafetyTip';
import { AvtaleSammendragScreen } from '@/screens/AvtaleSammendragScreen';
import type { AgendaItem } from '@/domain/types';
import nb from '@/i18n/nb';
import { chatRepository } from '@mocks/data/chatRepository';
import { renderWithProviders } from '../testUtils';

const item = (id: string, who: string, extra: Partial<AgendaItem> = {}) =>
  ({ proposalId: id, counterpartId: who, fullyCompleted: true, cancelled: false, ...extra }) as AgendaItem;

beforeEach(async () => {
  chatRepository._reset();
  await AsyncStorage.clear();
});

test('only the first job with a person counts as «first time»', () => {
  expect(firstJobWith([item('a', 'ola', { fullyCompleted: false })], 'ola', 'a')).toBe(true);
  expect(firstJobWith([item('old', 'ola'), item('a', 'ola', { fullyCompleted: false })], 'ola', 'a')).toBe(false);
  // a cancelled job together doesn't count as knowing each other
  expect(firstJobWith([item('old', 'ola', { cancelled: true })], 'ola', 'a')).toBe(true);
});

test('the same avtale always gets the same tip, from the right list', () => {
  expect(tipFor('p-1', true)).toBe(tipFor('p-1', true));
  expect(nb.safetyTip.helper).toContain(tipFor('p-1', true));
  expect(nb.safetyTip.client).toContain(tipFor('p-1', false));
});

test('the avtale shows the tip before the first job, and «Skjul» hides it for good', async () => {
  const first = await renderWithProviders(<AvtaleSammendragScreen proposalId="p-martin-flytting" />);
  expect(await screen.findByTestId('safety-tip')).toBeTruthy();
  expect(screen.getByText('Første gang med Martin?')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Skjul tipset'));
  await waitFor(() => expect(screen.queryByTestId('safety-tip')).toBeNull());
  first.unmount();

  await renderWithProviders(<AvtaleSammendragScreen proposalId="p-martin-flytting" />);
  await screen.findByText('Avtalen er klar');
  await waitFor(() => expect(screen.queryByTestId('safety-tip')).toBeNull());
});
