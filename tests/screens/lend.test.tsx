/** Utlån, redesigned 2026-11-13 (0101 + 0104): dates, the popup with the ask, and the owner's reply. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '@/api/client';
import { extras } from '@mocks/mockClient';
import { profileRepository } from '@mocks/data/profileRepository';
import { addDays, busyToday, clash, dayOf, dayStrip, loanDays, quickRange } from '@/domain/lend';
import { LendScreen } from '@/screens/LendScreen';
import type { LendItem } from '@/domain/types';
import { renderWithProviders } from '../testUtils';

const item = (over: Partial<LendItem> = {}): LendItem => ({
  id: 'li-1',
  ownerId: 'u-emma',
  title: 'Stige 3 meter',
  category: 'VERKTOY',
  note: 'Aluminium. Hentes på Stampesletta.',
  municipality: 'Lillehammer',
  active: true,
  createdAt: new Date().toISOString(),
  ...over,
});

beforeEach(() => extras.reset());

describe('the dates', () => {
  test('both ends count, and a clash is any overlap', () => {
    expect(loanDays('2026-11-14', '2026-11-16')).toBe(3);
    expect(loanDays('2026-11-14', '2026-11-14')).toBe(1);
    const busy = [{ fromDate: '2026-11-15', toDate: '2026-11-16' }];
    expect(clash(busy, '2026-11-13', '2026-11-14')).toBeNull();
    expect(clash(busy, '2026-11-16', '2026-11-18')).toEqual(busy[0]);
    expect(clash(busy, '2026-11-14', '2026-11-20')).toEqual(busy[0]);
  });

  test('«Helgen» is Saturday and Sunday, and just today on a Sunday', () => {
    expect(quickRange('weekend', new Date(2026, 10, 12, 9))).toEqual({ from: '2026-11-14', to: '2026-11-15' }); // a Thursday
    expect(quickRange('weekend', new Date(2026, 10, 15, 9))).toEqual({ from: '2026-11-15', to: '2026-11-15' }); // a Sunday
    expect(quickRange('tomorrow', new Date(2026, 10, 30, 23))).toEqual({ from: '2026-12-01', to: '2026-12-01' });
  });

  test('the 14-day strip marks taken days, and «Utlånt nå» only when today is taken', () => {
    const today = new Date(2026, 10, 13, 10);
    const busy = [{ fromDate: '2026-11-15', toDate: '2026-11-16' }];
    const strip = dayStrip(busy, today);
    expect(strip).toHaveLength(14);
    expect(strip.filter((d) => d.busy).map((d) => d.day)).toEqual(['2026-11-15', '2026-11-16']);
    expect(busyToday(busy, today)).toBeNull();
    expect(busyToday(busy, new Date(2026, 10, 15, 10))).toEqual(busy[0]);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('the screen', () => {
  test('a thing opens in a popup, and «I dag» sends a request for today', async () => {
    extras.lendItems = [item()];
    await renderWithProviders(<LendScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Stige 3 meter, Verktøy/ }));
    expect(await screen.findByText('De neste 14 dagene')).toBeTruthy();
    await fireEvent.press(screen.getByText('Spør om lån'));
    await fireEvent.press(await screen.findByText('I dag'));
    await fireEvent.changeText(screen.getByLabelText('Melding til eieren'), 'Til takrennene');
    await fireEvent.press(screen.getByText('Send forespørsel'));
    expect(await screen.findByText('Forespørselen er sendt')).toBeTruthy();
    const today = dayOf(new Date());
    expect(extras.lendRequests[0]).toMatchObject({ itemId: 'li-1', fromDate: today, toDate: today, note: 'Til takrennene', status: 'PENDING' });
  });

  test('days that are taken can not be asked for', async () => {
    const today = dayOf(new Date());
    extras.lendItems = [item()];
    extras.lendRequests = [
      { id: 'lr-x', itemId: 'li-1', itemTitle: 'Stige 3 meter', ownerId: 'u-emma', borrowerId: 'u-jonas', fromDate: today, toDate: addDays(today, 1), status: 'ACCEPTED', createdAt: new Date().toISOString() },
    ];
    await renderWithProviders(<LendScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Stige 3 meter/ }));
    await fireEvent.press(await screen.findByText('Spør om lån'));
    await fireEvent.press(await screen.findByText('I dag'));
    expect(await screen.findByText(/Den er lånt ut/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Send forespørsel'));
    expect(extras.lendRequests).toHaveLength(1);
  });

  test('the owner accepts with a reply, and the borrower sees it', async () => {
    const me = profileRepository.currentUserId;
    extras.lendItems = [item({ ownerId: me, id: 'li-mine', title: 'Vaffeljern', category: 'KJOKKEN' })];
    extras.lendRequests = [
      { id: 'lr-1', itemId: 'li-mine', itemTitle: 'Vaffeljern', ownerId: me, borrowerId: 'u-jonas', fromDate: '2026-12-01', toDate: '2026-12-02', note: 'Til bursdagen', status: 'PENDING', createdAt: new Date().toISOString() },
    ];
    await renderWithProviders(<LendScreen startTab="asks" />);
    expect(await screen.findByText('Til bursdagen')).toBeTruthy();
    await fireEvent.press(screen.getByText('Godta'));
    await fireEvent.changeText(await screen.findByLabelText('Svar'), 'Hentes i garasjen etter kl. 17');
    await fireEvent.press(screen.getByText('Godta og send'));
    await waitFor(() => expect(extras.lendRequests[0]).toMatchObject({ status: 'ACCEPTED', reply: 'Hentes i garasjen etter kl. 17' }));
    expect(await screen.findByText('Hentes i garasjen etter kl. 17')).toBeTruthy();
  });

  test('busy days show only the dates, and a cancelled loan frees them', async () => {
    const today = dayOf(new Date());
    extras.lendRequests = [
      { id: 'lr-2', itemId: 'li-1', itemTitle: 'Stige', ownerId: 'u-emma', borrowerId: profileRepository.currentUserId, fromDate: today, toDate: today, status: 'ACCEPTED', createdAt: new Date().toISOString() },
    ];
    expect(await apiClient.lendBusyDays('li-1')).toEqual([{ fromDate: today, toDate: today }]);
    await apiClient.respondLend('lr-2', 'CANCELLED');
    expect(await apiClient.lendBusyDays('li-1')).toEqual([]);
    await expect(apiClient.respondLend('lr-2', 'CANCELLED')).rejects.toThrow('allerede avsluttet');
  });

  test('a youth can lend out too (0107): «Mine ting» and the add button are there', async () => {
    const spy = jest
      .spyOn(apiClient, 'getMyAccount')
      .mockResolvedValue({ vipps: true, youth: true, age: 16, birthYear: 2010, fullName: 'Emil Nygård', phoneMasked: '+47 ••• •• 518' });
    extras.lendItems = [item()];
    await renderWithProviders(<LendScreen />);
    expect(await screen.findByText('Mine ting')).toBeTruthy();
    expect(screen.getAllByLabelText('Legg til noe du kan låne ut').length).toBeGreaterThan(0);
    expect(screen.queryByText(/ikke låne ut/)).toBeNull();
    spy.mockRestore();
  });
});
