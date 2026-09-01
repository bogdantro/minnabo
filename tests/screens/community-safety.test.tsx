import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { FellesskapScreen } from '@/screens/FellesskapScreen';
import { SafetyScreen } from '@/screens/SafetyScreen';
import { BlockedListScreen } from '@/screens/BlockedListScreen';
import { TrustedContactsScreen } from '@/screens/TrustedContactsScreen';
import { safetyStore } from '@/data/safetyStore';
import { trustedContacts } from '@/lib/trustedContacts';
import { chatRepository } from '@/data/chatRepository';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  safetyStore._reset();
  trustedContacts._reset();
});

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

test('the blocked list shows blocked users and can unblock them', async () => {
  safetyStore.toggleBlock('u-emma');
  await renderWithProviders(<BlockedListScreen />);

  await waitFor(() => expect(screen.getByText('Emma Larsen')).toBeTruthy());
  await fireEvent.press(screen.getByText('Opphev blokkering'));

  await waitFor(() => expect(safetyStore.isBlocked('u-emma')).toBe(false));
  await waitFor(() => expect(screen.getByText('Du har ikke blokkert noen.')).toBeTruthy());
});

test('a trusted contact can be added and is listed', async () => {
  await renderWithProviders(<TrustedContactsScreen />);

  await fireEvent.changeText(screen.getByLabelText('Navn'), 'Mamma');
  await fireEvent.changeText(screen.getByLabelText('Telefonnummer'), '90012345');
  await fireEvent.press(screen.getByText('Lagre kontakt'));

  await waitFor(() => expect(screen.getByText('Mamma')).toBeTruthy());
  expect(trustedContacts.list()).toHaveLength(1);
});

test('a report is recorded with the chosen reason', async () => {
  await renderWithProviders(<SafetyScreen targetType="USER" targetId="u-emma" />);
  await fireEvent.press(screen.getByText('Spam'));
  await fireEvent.press(screen.getByText('Send rapport'));
  await waitFor(() => expect(screen.getByText(/Rapporten er sendt/)).toBeTruthy());
  expect(safetyStore.listReports()[0].reason).toBe('Spam');
});
