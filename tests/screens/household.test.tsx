/** Husstand, redesigned 2026-11-13 (0101 + 0105): the code, joining, «Hvem kommer når» for both, and leaving. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '@/api/client';
import { extras } from '@mocks/mockClient';
import { cleanCode, codeDaysLeft, filterWho, householdDays, type HouseholdAgreement } from '@/domain/household';
import { HouseholdScreen } from '@/screens/HouseholdScreen';
import { renderWithProviders } from '../testUtils';

beforeEach(() => extras.reset());

const row = (over: Partial<HouseholdAgreement>): HouseholdAgreement => ({ proposalId: 'p', title: 'Snømåking', with: 'Jonas Berg', ...over });

describe('the helpers', () => {
  test('a typed or pasted code is cleaned to six letters and digits', () => {
    expect(cleanCode(' k7p 2-qx ')).toBe('K7P2QX');
    expect(cleanCode('abc1234567')).toBe('ABC123');
  });

  test('days left on a code never go below zero', () => {
    const now = new Date(2026, 10, 13, 12);
    expect(codeDaysLeft(new Date(2026, 10, 20, 12, 30).toISOString(), now)).toBe(7);
    expect(codeDaysLeft(new Date(2026, 10, 13, 20).toISOString(), now)).toBe(0);
    expect(codeDaysLeft(new Date(2026, 10, 20, 11, 59).toISOString(), now)).toBe(7); // a fresh code, a moment later
    expect(codeDaysLeft(new Date(2026, 10, 10).toISOString(), now)).toBe(0);
  });

  test('«Mine» shows mine and ours, the partner filter theirs and ours; a row without who is the partner\'s', () => {
    const list = [row({ proposalId: 'a', who: 'me' }), row({ proposalId: 'b', who: 'partner' }), row({ proposalId: 'c', who: 'both' }), row({ proposalId: 'd' })];
    expect(filterWho(list, 'me').map((a) => a.proposalId)).toEqual(['a', 'c']);
    expect(filterWho(list, 'partner').map((a) => a.proposalId)).toEqual(['b', 'c', 'd']);
    expect(filterWho(list, 'all')).toHaveLength(4);
  });

  test('days come in time order as I dag, I morgen, a date, and the ones without a time last', () => {
    const now = new Date(2026, 10, 13, 9);
    const at = (d: number, h: number) => new Date(2026, 10, 13 + d, h).toISOString();
    const days = householdDays(
      [row({ proposalId: 'x', scheduledText: 'En dag neste uke' }), row({ proposalId: 'c', scheduledAt: at(3, 10) }), row({ proposalId: 'b', scheduledAt: at(1, 17) }), row({ proposalId: 'a', scheduledAt: at(1, 7) }), row({ proposalId: 't', scheduledAt: at(0, 15) })],
      { today: 'I dag', tomorrow: 'I morgen', noTime: 'Uten fast tid', date: () => 'Mon 16. nov' },
      now,
    );
    expect(days.map((d) => d.label)).toEqual(['I dag', 'I morgen', 'Mon 16. nov', 'Uten fast tid']);
    expect(days[1].items.map((a) => a.proposalId)).toEqual(['a', 'b']);
  });
});

describe('the screen', () => {
  test('a code is made, shown as tiles, and can be taken back', async () => {
    await renderWithProviders(<HouseholdScreen />);
    await fireEvent.press(await screen.findByText('Lag invitasjonskode'));
    expect(await screen.findByLabelText('Koden er K 7 P 2 Q X')).toBeTruthy();
    expect(screen.getByText(/Venter på at den andre/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Ta tilbake invitasjonen'));
    await waitFor(() => expect(extras.household.inHousehold).toBe(false));
    expect(await screen.findByText('Lag invitasjonskode')).toBeTruthy();
  });

  test('joining with a code shows «Du og Emma» and «Hvem kommer når» for both, with filters', async () => {
    await renderWithProviders(<HouseholdScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Kode fra den du bor med'), 'abc 123');
    await fireEvent.press(screen.getByText('Bli med'));
    expect(await screen.findByText('Du og Emma')).toBeTruthy();
    expect(screen.getByText('Hvem kommer når')).toBeTruthy();
    expect(screen.getByText('Snømåking av oppkjørselen')).toBeTruthy();
    expect(screen.getByText('Montere hyller i boden')).toBeTruthy();
    expect(screen.getByText('Uten fast tid')).toBeTruthy();
    expect(screen.getByText('Emma sine oppdrag')).toBeTruthy();
    // «Mine»: mine and ours, not Emma's own
    await fireEvent.press(screen.getByText('Mine'));
    expect(screen.queryByText('Snømåking av oppkjørselen')).toBeNull();
    expect(screen.getByText('Montere hyller i boden')).toBeTruthy();
    expect(screen.getByText('Hundelufting')).toBeTruthy();
  });

  test('a wrong code says so and stays on the page', async () => {
    await renderWithProviders(<HouseholdScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Kode fra den du bor med'), 'ZZZZZZ');
    await fireEvent.press(screen.getByText('Bli med'));
    await waitFor(() => expect(extras.household.inHousehold).toBe(false));
    expect(screen.getByText('Jeg har en kode')).toBeTruthy();
  });

  test('leaving asks first, then the page is back to the start', async () => {
    await apiClient.householdJoin('ABC123');
    await renderWithProviders(<HouseholdScreen />);
    await fireEvent.press(await screen.findByText('Gå ut av husstanden'));
    expect(await screen.findByText('Dere slutter å se hverandres oppdrag og avtaler. Emma får beskjed.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Gå ut'));
    await waitFor(() => expect(extras.household.inHousehold).toBe(false));
    expect(await screen.findByText('Bo sammen, se det samme')).toBeTruthy();
  });

  test('a youth sees it is for adults, and nothing to press', async () => {
    const spy = jest
      .spyOn(apiClient, 'getMyAccount')
      .mockResolvedValue({ vipps: true, youth: true, age: 16, birthYear: 2010, fullName: 'Emil Nygård', phoneMasked: '+47 ••• •• 518' });
    await renderWithProviders(<HouseholdScreen />);
    expect(await screen.findByText('Husstand er for voksne')).toBeTruthy();
    expect(screen.queryByText('Lag invitasjonskode')).toBeNull();
    spy.mockRestore();
  });
});
