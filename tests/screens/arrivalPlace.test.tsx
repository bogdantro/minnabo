import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { chatRepository } from '@mocks/data/chatRepository';
import { profileRepository } from '@mocks/data/profileRepository';
import { AvtaleSammendragScreen } from '@/screens/AvtaleSammendragScreen';
import { placeText } from '@/lib/geo';
import { toast } from '@/lib/toast';
import { renderWithProviders } from '../testUtils';

const mockPlace = jest.fn<Promise<string | null>, []>();
jest.mock('@/lib/geo', () => ({
  ...jest.requireActual('@/lib/geo'),
  approximatePlace: () => mockPlace(),
}));

const ME = profileRepository.currentUserId;
const ID = 'p-martin-flytting';
const laterToday = () => {
  const d = new Date();
  d.setHours(Math.min(23, d.getHours() + 1), 30, 0, 0);
  return d.toISOString();
};

beforeEach(() => {
  chatRepository._reset();
  mockPlace.mockReset();
});

test('placeText: street and town, never more', () => {
  expect(placeText('Storgata', undefined, 'Lillehammer')).toBe('Storgata, Lillehammer');
  expect(placeText(null, 'Søre Ål', 'Lillehammer')).toBe('Søre Ål, Lillehammer');
  expect(placeText('Lillehammer', null, 'Lillehammer')).toBe('Lillehammer');
  expect(placeText(null, null, 'Lillehammer')).toBeNull();
});

describe('the helper', () => {
  const onTheWay = async () => {
    chatRepository.patchProposal(ID, { fromProfileId: ME, toProfileId: 'u-martin' });
    const now = new Date().toISOString();
    chatRepository.patchAgreement(ID, { scheduledAt: laterToday(), cancelledAt: undefined, helperConfirmedAt: now, helperStatus: 'ON_THE_WAY', helperStatusAt: now });
    await renderWithProviders(<AvtaleSammendragScreen proposalId={ID} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Jeg er framme' }));
    expect(await screen.findByText('Si fra at du er framme')).toBeTruthy();
  };

  test('chooses to show roughly where they are: the street goes with «framme»', async () => {
    mockPlace.mockResolvedValue('Storgata, Lillehammer');
    await onTheWay();
    await fireEvent.press(screen.getByTestId('arrived-share'));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Jeg er framme' }).at(-1)!);
    await waitFor(() => expect(chatRepository.getAgreement(ID)?.helperStatus).toBe('ARRIVED'));
    expect(chatRepository.getAgreement(ID)?.helperStatusPlace).toBe('Storgata, Lillehammer');
  });

  test('without the tick no position is even looked up', async () => {
    await onTheWay();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Jeg er framme' }).at(-1)!);
    await waitFor(() => expect(chatRepository.getAgreement(ID)?.helperStatus).toBe('ARRIVED'));
    expect(mockPlace).not.toHaveBeenCalled();
    expect(chatRepository.getAgreement(ID)?.helperStatusPlace).toBeUndefined();
  });

  test('no position found: «framme» is still sent, and the helper is told', async () => {
    mockPlace.mockResolvedValue(null);
    const info = jest.spyOn(toast, 'info');
    await onTheWay();
    await fireEvent.press(screen.getByTestId('arrived-share'));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Jeg er framme' }).at(-1)!);
    await waitFor(() => expect(chatRepository.getAgreement(ID)?.helperStatus).toBe('ARRIVED'));
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/Fant ikke posisjonen/), expect.anything());
    expect(chatRepository.getAgreement(ID)?.helperStatusPlace).toBeUndefined();
  });
});

test('the owner sees «Ved Storgata, Lillehammer» on the job day', async () => {
  const now = new Date().toISOString();
  chatRepository.patchAgreement(ID, {
    scheduledAt: laterToday(),
    cancelledAt: undefined,
    helperConfirmedAt: now,
    helperStatus: 'ARRIVED',
    helperStatusAt: now,
    helperStatusPlace: 'Storgata, Lillehammer',
  });
  await renderWithProviders(<AvtaleSammendragScreen proposalId={ID} />);
  expect(await screen.findByText('Ved Storgata, Lillehammer')).toBeTruthy();
});
