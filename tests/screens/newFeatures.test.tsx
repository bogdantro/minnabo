import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ListingQuestions } from '@/components/ListingQuestions';
import { HelperSlotsCard, NoOffersTips } from '@/components/ListingOwnerCards';
import { ProfileThanks, ThankCardPicker } from '@/components/ThankCards';
import { NewSinceLine } from '@/components/NewSinceLine';
import { HelpScreen } from '@/screens/HelpScreen';
import { AgreedSumScreen } from '@/screens/AgreedSumScreen';
import { YearRecapScreen } from '@/screens/YearRecapScreen';
import { UpdateScreen, needsAppUpdate } from '@/components/AppGates';
import { isOlderVersion } from '@/domain/appVersion';
import { isNewHelper } from '@/domain/newHelper';
import { newSinceIndex } from '@/lib/feedSeen';
import { fitMap, mapClusters, MAX_ZOOM, mergeNearby, project } from '@/domain/mapClusters';
import { kommuneCentre } from '@/data/kommuner';
import type { Listing } from '@/domain/types';
import { extras } from '@mocks/mockClient';
import { renderWithProviders } from '../testUtils';

const HOUR = 60 * 60 * 1000;
const listing = (over: Partial<Listing> = {}) =>
  ({
    id: 'l-test',
    type: 'TASK_REQUEST',
    title: 'Klippe plenen',
    category: { id: 'c', slug: 'hage', label: 'Hage', icon: 'leaf' },
    priceMode: 'BY_AGREEMENT',
    location: { municipality: 'Lillehammer', place: 'Nordre Ål' },
    images: [],
    owner: { id: 'u-owner', displayName: 'Kari Holm', initials: 'KH', memberSince: '2026', location: { municipality: 'Lillehammer', place: '' }, verifications: [], isBusiness: false },
    createdAt: new Date(Date.now() - 72 * HOUR).toISOString(),
    status: 'PUBLISHED',
    ...over,
  }) as Listing;

beforeEach(() => extras.reset());

describe('Spørsmål fra naboer', () => {
  test('a neighbour can ask, and the question shows for everyone', async () => {
    await renderWithProviders(<ListingQuestions listing={listing()} meId="me" isOwner={false} youth={false} onContact={jest.fn()} />);
    await fireEvent.press(await screen.findByText('Still et spørsmål'));
    await fireEvent.press(await screen.findByText('Still et offentlig spørsmål'));
    await fireEvent.changeText(screen.getByPlaceholderText('F.eks. Har du med eget utstyr?'), 'Har du med eget utstyr?');
    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByText('Send spørsmålet'));
    expect(await screen.findByText('Har du med eget utstyr?')).toBeTruthy();
    expect(screen.getByText('Venter på svar')).toBeTruthy();
  });

  test('a question is not sent until the person has ticked that it is public', async () => {
    await renderWithProviders(<ListingQuestions listing={listing()} meId="me" isOwner={false} youth={false} onContact={jest.fn()} />);
    await fireEvent.press(await screen.findByText('Still et spørsmål'));
    await fireEvent.press(await screen.findByText('Still et offentlig spørsmål'));
    await fireEvent.changeText(screen.getByPlaceholderText('F.eks. Har du med eget utstyr?'), 'Hei, kan du komme på lørdag?');
    await fireEvent.press(screen.getByText('Send spørsmålet'));
    expect(await screen.findByText('Kryss av for at du har forstått dette.')).toBeTruthy();
    expect(extras.questions).toHaveLength(0);
  });

  test('the first step offers the private chat, and that opens it instead of a question', async () => {
    const contact = jest.fn();
    await renderWithProviders(<ListingQuestions listing={listing()} meId="me" isOwner={false} youth={false} onContact={contact} />);
    await fireEvent.press(await screen.findByText('Still et spørsmål'));
    expect(await screen.findByText(/er ikke en melding til/)).toBeTruthy();
    await fireEvent.press(screen.getByText(/^Kontakt /));
    expect(contact).toHaveBeenCalled();
  });

  test('a youth account reads but is not offered to ask', async () => {
    extras.questions = [{ id: 'q1', listingId: 'l-test', authorId: 'u1', body: 'Har du rake?', answer: 'Ja.', createdAt: new Date().toISOString() }];
    await renderWithProviders(<ListingQuestions listing={listing()} meId="me" isOwner={false} youth onContact={jest.fn()} />);
    expect(await screen.findByText('Har du rake?')).toBeTruthy();
    expect(screen.queryByText('Still et spørsmål')).toBeNull();
  });

  test('the owner answers from the same list', async () => {
    extras.questions = [{ id: 'q1', listingId: 'l-test', authorId: 'u1', body: 'Har du rake?', createdAt: new Date().toISOString() }];
    await renderWithProviders(<ListingQuestions listing={listing()} meId="u-owner" isOwner youth={false} onContact={jest.fn()} />);
    await fireEvent.press(await screen.findByText('Svar'));
    await fireEvent.changeText(screen.getByPlaceholderText('Skriv svaret ditt'), 'Ja, den står i garasjen.');
    await fireEvent.press(screen.getByText('Publiser svaret'));
    expect(await screen.findByText('Ja, den står i garasjen.')).toBeTruthy();
  });

  test('nothing shows for the owner while there are no questions', async () => {
    await renderWithProviders(<ListingQuestions listing={listing()} meId="u-owner" isOwner youth={false} onContact={jest.fn()} />);
    await waitFor(() => expect(screen.queryByText('Spørsmål fra naboer')).toBeNull());
  });
});

describe('cards for the owner', () => {
  test('the tips show after 48 hours without a tilbud', async () => {
    await renderWithProviders(<NoOffersTips listing={listing()} offers={0} force={false} />);
    expect(screen.getByText('Ingen tilbud ennå')).toBeTruthy();
  });

  test('no tips on a new oppdrag or when there are tilbud', async () => {
    await renderWithProviders(<NoOffersTips listing={listing({ createdAt: new Date().toISOString() })} offers={0} force={false} />);
    expect(screen.queryByText('Ingen tilbud ennå')).toBeNull();
  });

  test('a photo tip only when there is no photo', async () => {
    await renderWithProviders(<NoOffersTips listing={listing({ images: [{ id: 'i', url: 'x' }] })} offers={0} force />);
    expect(screen.queryByText('Legg til et bilde. Da ser naboene hva jobben er.')).toBeNull();
  });

  test('two helpers: the owner sees how far it has come', async () => {
    extras.slots['l-test'] = { needed: 2, taken: 1 };
    await renderWithProviders(<HelperSlotsCard listing={listing({ helpersNeeded: 2 })} isOwner />);
    expect(await screen.findByText('1 av 2 hjelpere avtalt')).toBeTruthy();
    expect(screen.getByText('Jeg trenger ikke flere')).toBeTruthy();
  });

  test('other people only see how many are still needed, never who', async () => {
    extras.slots['l-test'] = { needed: 2, taken: 1 };
    await renderWithProviders(<HelperSlotsCard listing={listing({ helpersNeeded: 2 })} isOwner={false} />);
    expect(await screen.findByText('Trenger 1 hjelper til')).toBeTruthy();
  });

  test('one helper shows nothing', async () => {
    await renderWithProviders(<HelperSlotsCard listing={listing()} isOwner />);
    expect(screen.queryByText(/hjelpere avtalt/)).toBeNull();
  });
});

describe('takkekort', () => {
  test('pick a card, add a line, send', async () => {
    extras.thankTo = 'u-helper';
    await renderWithProviders(<ThankCardPicker proposalId="p1" toProfileId="u-helper" first="Jonas" />);
    await fireEvent.press(screen.getByLabelText('Reddet dagen'));
    await fireEvent.changeText(screen.getByPlaceholderText('Skriv en liten hilsen (valgfritt)'), 'Tusen takk!');
    await fireEvent.press(screen.getByText('Send takkekortet'));
    expect(await screen.findByText('Takkekortet er sendt til Jonas')).toBeTruthy();
    expect(extras.thanks[0]).toMatchObject({ card: 'SAVED', message: 'Tusen takk!' });
  });

  test('the profile shows nothing until there is a card', async () => {
    await renderWithProviders(<ProfileThanks profileId="u-helper" />);
    await waitFor(() => expect(screen.queryByText(/Takk fra naboer/)).toBeNull());
  });
});

describe('Hjelp', () => {
  test('the search finds an answer, and says so when nothing fits', async () => {
    await renderWithProviders(<HelpScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText('Søk i hjelpen'), 'adressen');
    expect(await screen.findByText('Hva ser andre av adressen min?')).toBeTruthy();
    expect(screen.queryByText('Koster det noe å bruke MinNabo?')).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText('Søk i hjelpen'), 'xyzzy');
    expect(await screen.findByText('Fant ikke noe svar')).toBeTruthy();
    expect(screen.getByText('Kontakt oss')).toBeTruthy();
  });
});

describe('my numbers', () => {
  test('«Avtalt sum» shows what is left to the limit, per person', async () => {
    extras.agreedSum = { year: 2026, totalMinor: 150000, jobs: 2, people: [{ name: 'Kari', minor: 150000, jobs: 2 }] };
    await renderWithProviders(<AgreedSumScreen year={2026} />);
    expect(await screen.findByText('Kari')).toBeTruthy();
    expect(screen.getByText(/4.500 kr igjen til 6.000.kr/)).toBeTruthy();
    expect(screen.getByText(/Vi vet ikke hva som faktisk ble betalt/)).toBeTruthy();
  });

  test('over the limit says so', async () => {
    extras.agreedSum = { year: 2026, totalMinor: 700000, jobs: 5, people: [{ name: 'Kari', minor: 700000, jobs: 5 }] };
    await renderWithProviders(<AgreedSumScreen year={2026} />);
    expect(await screen.findByText('Over 6 000 kr i år')).toBeTruthy();
  });

  test('an empty year invites you to start, instead of showing zeros', async () => {
    await renderWithProviders(<YearRecapScreen year={2026} />);
    expect(await screen.findByText('Året er ikke over ennå')).toBeTruthy();
  });

  test('a year with jobs shows the numbers', async () => {
    extras.recap = { year: 2026, helped: 12, gotHelp: 3, neighbours: 9, thanks: 4, topCategory: 'hage' };
    await renderWithProviders(<YearRecapScreen year={2026} />);
    expect(await screen.findByText('12')).toBeTruthy();
    expect(screen.getByText('Mest hage i år')).toBeTruthy();
  });
});

describe('small rules', () => {
  test('versions compare as numbers: 1.10 is newer than 1.9', () => {
    expect(isOlderVersion('1.9.0', '1.10.0')).toBe(true);
    expect(isOlderVersion('1.10.0', '1.9.0')).toBe(false);
    expect(isOlderVersion('1.2.0', '1.2.0')).toBe(false);
    expect(isOlderVersion('1.2', '1.2.1')).toBe(true);
  });

  test('a typo in the minimum version stops nobody', () => {
    expect(needsAppUpdate('banan')).toBe(false);
    expect(needsAppUpdate('0.0.0')).toBe(false);
  });

  test('«Oppdater appen» says what to do', async () => {
    await renderWithProviders(<UpdateScreen />);
    expect(screen.getAllByText('Oppdater appen').length).toBeGreaterThan(0);
  });

  test('«Ny på MinNabo» is for the new, not for someone with a job behind them', () => {
    const now = new Date('2026-11-06');
    const fresh = { memberSinceDate: '2026-10-20', completedTasks: 0 };
    expect(isNewHelper(fresh, now)).toBe(true);
    expect(isNewHelper({ ...fresh, completedTasks: 1 }, now)).toBe(false);
    expect(isNewHelper({ ...fresh, memberSinceDate: '2026-01-01' }, now)).toBe(false);
  });

  test('«Nytt siden sist» sits before the first post already seen', () => {
    const at = (h: number) => new Date(1000 * HOUR - h * HOUR).toISOString();
    const posts = [{ createdAt: at(1) }, { createdAt: at(2) }, { createdAt: at(9) }];
    expect(newSinceIndex(posts, 1000 * HOUR - 5 * HOUR, 1000 * HOUR)).toBe(2);
  });

  test('no line on a first visit, or when everything is new or old', () => {
    const at = (h: number) => new Date(1000 * HOUR - h * HOUR).toISOString();
    const posts = [{ createdAt: at(1) }, { createdAt: at(2) }];
    expect(newSinceIndex(posts, null, 1000 * HOUR)).toBe(-1);
    expect(newSinceIndex(posts, 1000 * HOUR - 5 * HOUR, 1000 * HOUR)).toBe(-1);
    expect(newSinceIndex(posts, 1000 * HOUR, 1000 * HOUR)).toBe(-1);
  });

  test('an old hasteoppdrag on top does not pull the line up', () => {
    const now = 1000 * HOUR;
    const at = (h: number) => new Date(now - h * HOUR).toISOString();
    const posts = [{ createdAt: at(50), urgentUntil: at(-5) }, { createdAt: at(1) }, { createdAt: at(9) }];
    expect(newSinceIndex(posts, now - 5 * HOUR, now)).toBe(2);
  });

  test('the map groups by place and never uses more than the kommune centre', () => {
    const a = listing({ id: 'a' });
    const b = listing({ id: 'b' });
    const c = listing({ id: 'c', location: { municipality: 'Øyer', place: 'Tretten' } });
    const clusters = mapClusters([a, b, c]);
    expect(clusters).toHaveLength(2);
    expect(clusters.find((x) => x.place === 'Nordre Ål')?.listings).toHaveLength(2);
    // the first place sits on the kommune's centre, the next ones spread around it: never a real spot
    const lillehammer = clusters.find((x) => x.place === 'Nordre Ål')!;
    expect(lillehammer.lat).toBeCloseTo(kommuneCentre('Lillehammer')![0]);
    expect(lillehammer.lon).toBeCloseTo(kommuneCentre('Lillehammer')![1]);
  });

  test('the first view shows every circle, and the map can never zoom closer than a town', () => {
    const clusters = mapClusters([listing({ id: 'a' }), listing({ id: 'c', location: { municipality: 'Øyer', place: 'Tretten' } })]);
    const fit = fitMap(clusters, 390, 500);
    expect(fit.zoom).toBeLessThanOrEqual(MAX_ZOOM);
    const a = project(clusters[0].lat, clusters[0].lon, fit.zoom);
    const b = project(clusters[1].lat, clusters[1].lon, fit.zoom);
    expect(Math.abs(a.x - b.x)).toBeLessThan(390);
    expect(Math.abs(a.y - b.y)).toBeLessThan(500);
    expect(MAX_ZOOM).toBeLessThanOrEqual(12);
  });

  test('circles that would overlap become one, and keep all their posts', () => {
    const clusters = mapClusters([listing({ id: 'a' }), listing({ id: 'c', location: { municipality: 'Øyer', place: 'Tretten' } })]);
    const merged = mergeNearby(clusters, 5, 60);
    expect(merged).toHaveLength(1);
    expect(merged[0].listings).toHaveLength(2);
  });

  test('a post in a kommune the map does not know is left out, not misplaced', () => {
    expect(mapClusters([listing({ location: { municipality: 'Ukjent', place: 'Et sted' } })])).toEqual([]);
  });

  test('the new-line component reads as a heading for what was seen', async () => {
    await renderWithProviders(<NewSinceLine />);
    expect(screen.getByText('Du har sett det under her')).toBeTruthy();
  });
});
