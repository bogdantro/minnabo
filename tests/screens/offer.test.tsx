import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { repositories } from '@mocks/data/repositories';
import { profileRepository } from '@mocks/data/profileRepository';
import { chatRepository } from '@mocks/data/chatRepository';
import { apiClient } from '@/api/client';
import { TabBar, type TabBarProps } from '@/components/TabBar';
import { OfferWizard, offerError } from '@/screens/LeggUt/OfferWizard';
import { OfferDetailScreen } from '@/screens/OfferDetailScreen';
import { experienceText, offerAvailability, weekdaysLabel } from '@/domain/offer';
import type { Listing } from '@/domain/types';
import { renderWithProviders } from '../testUtils';

const ME = profileRepository.currentUserId;
const expoRouter = jest.requireMock('expo-router');
const realParams = expoRouter.useLocalSearchParams;
beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  expoRouter.useLocalSearchParams = realParams;
});

const anOffer = (): Listing => repositories.listings.list({ type: 'SERVICE_OFFER' })[0];

// ------------------------------------------------------------
describe('days and price read naturally', () => {
  test('weekdays', () => {
    expect(weekdaysLabel([1, 2, 3, 4, 5])).toBe('Hverdager');
    expect(weekdaysLabel([6, 0])).toBe('Helg');
    expect(weekdaysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Alle dager');
    expect(weekdaysLabel([1, 3])).toBe('Man, ons');
    expect(weekdaysLabel([])).toBeNull();
  });
  test('experience in years and months', () => {
    expect(experienceText(0)).toBeNull();
    expect(experienceText(8)).toBe('8 mnd');
    expect(experienceText(12)).toBe('1 år');
    expect(experienceText(18)).toBe('1 år og 6 mnd');
  });
  test('the line under an offer card', () => {
    expect(offerAvailability({ offer: { about: '', services: [], availableWeekdays: [6, 0], availabilityText: 'Etter kl. 16' } })).toBe('Ledig helg · Etter kl. 16');
    expect(offerAvailability({ offer: { about: '', services: [], availableWeekdays: [1, 2, 3, 4, 5] } })).toBe('Ledig hverdager');
  });
});

// ------------------------------------------------------------
test('Legg ut asks what to post: an oppdrag, or what you can help with', async () => {
  const props = (): TabBarProps => ({
    state: { index: 0, routes: [{ key: 'index', name: 'index' }, { key: 'fellesskap', name: 'fellesskap' }, { key: 'innboks', name: 'innboks' }] },
    navigation: { navigate: jest.fn(), emit: jest.fn(() => ({ defaultPrevented: false })) },
  } as unknown as TabBarProps);
  await renderWithProviders(<TabBar {...props()} />);
  await fireEvent.press(screen.getByLabelText('Legg ut'));
  expect(await screen.findByText('Hva vil du legge ut?')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(/^Jeg kan hjelpe\./));
  expect(router.push).toHaveBeenCalledWith('/legg-ut/tilbyr');
  await fireEvent.press(screen.getByLabelText('Legg ut'));
  await fireEvent.press(await screen.findByLabelText(/^Jeg trenger hjelp\./));
  expect(router.push).toHaveBeenCalledWith('/legg-ut');
});

// ------------------------------------------------------------
describe('the offer wizard', () => {
  test('each step says what is missing before moving on', () => {
    const f = {
      cat: null, services: [], title: '', about: '', years: 0, months: 0, equipment: '', photos: [], price: 'FROM' as const,
      amount: '', days: [], when: '', kommune: 'Lillehammer', area: '', km: 10,
    };
    expect(offerError(1, f)?.field).toBe('cat');
    expect(offerError(2, { ...f, title: 'Plen' })?.field).toBe('title');
    expect(offerError(2, { ...f, title: 'Plenklipp', about: 'Kort' })?.field).toBe('about');
    expect(offerError(3, f)?.field).toBe('amount');
    expect(offerError(3, { ...f, price: 'BY_AGREEMENT' })).toBeNull();
    expect(offerError(4, f)?.field).toBe('days');
    expect(offerError(4, { ...f, days: [6] })?.field).toBe('area');
  });

  test('walks all five steps and publishes a «Tilbyr hjelp» post', async () => {
    await renderWithProviders(<OfferWizard />);
    expect(screen.getByText('Hva kan du hjelpe med?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Neste'));
    expect(screen.getByText('Velg hva du kan hjelpe med.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Hage' }));
    await fireEvent.press(screen.getByText('Neste'));

    await fireEvent.changeText(screen.getByLabelText('Tittel'), 'Plenklipp og hekk');
    await fireEvent.changeText(screen.getByLabelText('Om hjelpen'), 'Jeg har klipt plener i nabolaget i fem år.');
    await fireEvent.press(screen.getByText('Neste'));

    await fireEvent.changeText(screen.getByLabelText('Beløp'), '300');
    await fireEvent.press(screen.getByText('Neste'));

    await fireEvent.press(screen.getByText('Helg'));
    // Område: search the kommune's nabolag and pick one
    await fireEvent.changeText(await screen.findByLabelText('Søk etter område'), 'nordre');
    await fireEvent.press(await screen.findByRole('radio', { name: 'Nordre Ål' }));
    await fireEvent.press(screen.getByText('Neste'));

    expect(screen.getByText('Ser alt riktig ut?')).toBeTruthy();
    expect(screen.getByText('Ledig helg')).toBeTruthy();
    await fireEvent.press(screen.getByText('Publiser tilbudet'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/oppdrag\//)));
    const mine = repositories.listings.ownedBy(ME).find((l) => l.title === 'Plenklipp og hekk')!;
    expect(mine.type).toBe('SERVICE_OFFER');
    expect(mine.priceMode).toBe('FROM');
    expect(mine.price?.amountMinor).toBe(30000);
    expect(mine.offer).toMatchObject({ availableWeekdays: [0, 6], about: 'Jeg har klipt plener i nabolaget i fem år.' });
  });
});

// ------------------------------------------------------------
describe('the offer page', () => {
  test('a nabo asks for help: a chat opens with the helper', async () => {
    const o = anOffer();
    await renderWithProviders(<OfferDetailScreen listing={o} onBack={() => undefined} />);
    expect(screen.getByText(o.title)).toBeTruthy();
    expect(screen.getAllByText('Tilbyr hjelp').length).toBeGreaterThan(0);
    expect(screen.getByText(/Pris og betaling avtales direkte/)).toBeTruthy();
    const first = o.owner.displayName.split(' ')[0];
    await fireEvent.press(screen.getByText(`Spør ${first} om hjelp`));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/chat\//)));
  });

  test('on my own offer: Rediger, no «Spør om hjelp»', async () => {
    const o = { ...anOffer(), owner: { ...anOffer().owner, id: ME } };
    await renderWithProviders(<OfferDetailScreen listing={o} onBack={() => undefined} />);
    expect(screen.getByText('Dette er tilbudet ditt')).toBeTruthy();
    expect(screen.queryByText(/om hjelp$/)).toBeNull();
    await fireEvent.press(screen.getByText('Rediger'));
    expect(router.push).toHaveBeenCalledWith(`/legg-ut/tilbyr?rediger=${o.id}`);
  });
});

// ------------------------------------------------------------
describe('the rules (as in 0076)', () => {
  test('on an offer only the helper sends a tilbud; the one asking writes a message', async () => {
    const o = anOffer();
    const conv = await apiClient.startConversationForListing(o.id);
    await expect(
      apiClient.sendProposal({ conversationId: conv.id, listingId: o.id, priceAmountMinor: 30000 } as never),
    ).rejects.toThrow('Det er den som tilbyr hjelpen som sender tilbud her.');
  });

  test('an avtale never closes an offer: it stays open for the next nabo', () => {
    const o = anOffer();
    repositories.listings.setStatus(o.id, 'AGREED');
    repositories.listings.setStatus(o.id, 'COMPLETED');
    expect(repositories.listings.get(o.id)?.status).toBe(o.status);
    // pausing still works
    repositories.listings.setStatus(o.id, 'PAUSED');
    expect(repositories.listings.get(o.id)?.status).toBe('PAUSED');
  });

  test('editing an offer keeps its rules', async () => {
    const o = { ...anOffer(), owner: { ...anOffer().owner, id: ME } };
    repositories.listings.replace(o);
    await expect(apiClient.updateOffer(o.id, { ...o, offer: { ...o.offer!, about: 'Kort' } })).rejects.toThrow(/minst 20 tegn/);
    const saved = await apiClient.updateOffer(o.id, { ...o, title: 'Plenklipp hver uke' });
    expect(saved.title).toBe('Plenklipp hver uke');
    expect(chatRepository).toBeTruthy();
  });
});

// ------------------------------------------------------------
// Youth accounts may post «Tilbyr hjelp» in the youth categories only (0084)
// ------------------------------------------------------------
test('a youth sees only the youth categories in «Tilby hjelp»', async () => {
  jest
    .spyOn(apiClient, 'getMyAccount')
    .mockResolvedValue({ vipps: true, youth: true, age: 16, birthYear: 2010, fullName: 'Emil Nygård', phoneMasked: '+47 ••• •• 518' });
  await renderWithProviders(<OfferWizard />);
  await waitFor(() => expect(screen.queryByLabelText('Rengjøring')).toBeNull());
  for (const c of ['Hage', 'Dyrepass', 'Datahjelp', 'Snømåking']) expect(screen.getByLabelText(c)).toBeTruthy();
  jest.restoreAllMocks();
});
