import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { FellesskapScreen } from '@/screens/FellesskapScreen';
import { RapporterScreen } from '@/screens/RapporterScreen';
import { BlockedListScreen } from '@/screens/BlockedListScreen';
import { TrustedContactsScreen } from '@/screens/TrustedContactsScreen';
import { safetyStore } from '@mocks/data/safetyStore';
import { trustedContacts } from '@/lib/trustedContacts';
import { chatRepository } from '@mocks/data/chatRepository';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  safetyStore._reset();
  trustedContacts._reset();
});

test('Fellesskap shows partners, documented donations and no Røde Kors content', async () => {
  await renderWithProviders(<FellesskapScreen />);
  expect(screen.getByText('Sammen gjør vi en forskjell')).toBeTruthy();
  expect(screen.getByText('Hovedpartnere')).toBeTruthy();
  expect(screen.getByText('Donasjoner')).toBeTruthy();
  // Røde Kors only as 'Kommer' until written approval (feature flag off).
  expect(screen.getByText('Samarbeid med Røde Kors er under avklaring.')).toBeTruthy();
});

test('Fellesskap shows MAIN partners always but hides out-of-kommune LOCAL partners', async () => {
  await renderWithProviders(<FellesskapScreen />);
  expect(await screen.findByText('Fjellbygg AS')).toBeTruthy(); // MAIN, always shown
  // demo user is in Lillehammer; every LOCAL partner sits in another kommune
  await waitFor(() => expect(screen.queryByText('Mjøsa Elektro')).toBeNull());
  expect(
    await screen.findByText(/Ingen lokale støttespillere i Lillehammer/),
  ).toBeTruthy();
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

test('a trusted contact needs a name and 8 digits, then is listed with its relation', async () => {
  await renderWithProviders(<TrustedContactsScreen />);
  expect(screen.getByText('Ingen trygge kontakter ennå')).toBeTruthy();

  await fireEvent.press(screen.getByText('Legg til kontakt'));
  await fireEvent.changeText(await screen.findByLabelText('Navn'), 'Ola Haugen');
  await fireEvent.changeText(screen.getByLabelText('Mobilnummer'), '9241');
  await fireEvent.press(screen.getByRole('button', { name: 'Legg til' }));
  expect(screen.getByText('Skriv inn 8 siffer')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Mobilnummer'), '92411380');
  await fireEvent.press(screen.getByText('Venn'));
  await fireEvent.press(screen.getByRole('button', { name: 'Legg til' }));

  await waitFor(() => expect(trustedContacts.list()).toHaveLength(1));
  expect(trustedContacts.list()[0]).toMatchObject({ name: 'Ola Haugen', phone: '+47 924 11 380', relation: 'Venn' });
  expect(await screen.findByText('Venn · +47 924 11 380')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Fjern Ola Haugen'));
  expect(await screen.findByText('Fjerne Ola?')).toBeTruthy();
  await fireEvent.press(screen.getByText('Fjern'));
  await waitFor(() => expect(trustedContacts.list()).toHaveLength(0));
});

test('Rapporter: 3 steps, then a case number; svindel pre-selects "Blokker også"', async () => {
  await renderWithProviders(<RapporterScreen profileId="u-emma" />);
  expect(await screen.findByText('Hva vil du rapportere?')).toBeTruthy();
  expect(await screen.findByText('Emma Larsen')).toBeTruthy();
  await fireEvent.press(screen.getByText('Neste'));

  expect(screen.getByText('Hva er galt?')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Svindel eller krav om forhåndsbetaling' }));
  await fireEvent.press(screen.getByText('Neste'));

  expect(screen.getByText('Fortell litt mer')).toBeTruthy();
  expect(screen.getByLabelText('Blokker også brukeren').props.accessibilityState).toMatchObject({ checked: true });
  await fireEvent.press(screen.getByText('Send rapport'));

  expect(await screen.findByText('Takk – vi ser på saken')).toBeTruthy();
  expect(screen.getByText(/^Saksnr\. MN-/)).toBeTruthy();
  expect(safetyStore.listReports()[0]).toMatchObject({ targetType: 'USER', targetId: 'u-emma', reason: 'Svindel eller krav om forhåndsbetaling' });
  await waitFor(() => expect(safetyStore.isBlocked('u-emma')).toBe(true));
});

test('Rapporter: "Annet" and general reports need details', async () => {
  const before = safetyStore.listReports().length;
  await renderWithProviders(<RapporterScreen />);
  expect(await screen.findByText(/Rapporten gjelder ikke én bestemt/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(screen.getByRole('radio', { name: 'Annet' }));
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(screen.getByText('Send rapport'));
  expect(screen.getByText('Beskriv kort hva som skjedde')).toBeTruthy();
  expect(safetyStore.listReports()).toHaveLength(before);

  await fireEvent.changeText(screen.getByLabelText('Detaljer'), 'Noen deler falske oppdrag i nabolaget.');
  await fireEvent.press(screen.getByText('Send rapport'));
  expect(await screen.findByText('Takk – vi ser på saken')).toBeTruthy();
});
