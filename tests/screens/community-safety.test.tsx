import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { FellesskapScreen } from '@/screens/FellesskapScreen';
import { SafetyScreen } from '@/screens/SafetyScreen';
import { safetyStore } from '@/data/safetyStore';
import { chatRepository } from '@/data/chatRepository';
import { renderWithProviders } from '../testUtils';

test('Fellesskap shows partners, documented donations and no Røde Kors content', async () => {
  await renderWithProviders(<FellesskapScreen />);
  expect(screen.getByText('Sammen gjør vi en forskjell')).toBeTruthy();
  expect(screen.getByText('Hovedpartnere')).toBeTruthy();
  expect(screen.getByText('Dokumenterte bidrag')).toBeTruthy();
  expect(screen.getByText(/skriftlig godkjenning/)).toBeTruthy();
});

test('blocking a user hides their conversations', () => {
  const before = chatRepository.listConversations().length;
  safetyStore.toggleBlock('u-emma');
  expect(chatRepository.listConversations().length).toBe(before - 1);
});

test('a report is recorded with the chosen reason', async () => {
  await renderWithProviders(<SafetyScreen targetType="USER" targetId="u-emma" />);
  await fireEvent.press(screen.getByText('Spam'));
  await fireEvent.press(screen.getByText('Send rapport'));
  await waitFor(() => expect(screen.getByText(/Rapporten er sendt/)).toBeTruthy());
  expect(safetyStore.listReports()[0].reason).toBe('Spam');
});
