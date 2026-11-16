/** Fellesskap (0108): the new pages, the shared helper and farevarsler. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '@/api/client';
import { community } from '@mocks/mockCommunity';
import { noticeboardStore } from '@mocks/data/noticeboardStore';
import { FellesskapScreen } from '@/screens/FellesskapScreen';
import { ProjectsScreen } from '@/screens/felles/ProjectsScreen';
import { BuddiesScreen } from '@/screens/felles/BuddiesScreen';
import { SeasonScreen } from '@/screens/felles/SeasonScreen';
import { FellesSearchScreen } from '@/screens/felles/FellesSearchScreen';
import { OrganisationsScreen } from '@/screens/felles/OrganisationsScreen';
import { SharedStreetCard } from '@/components/SharedStreetCard';
import { levelOf, pickAlert } from '@/lib/metAlerts';
import { seasonOf } from '@/content/seasonChecklist';
import { SEASON_TASKS } from '@/content/seasonChecklist';
import { safePush } from '@/lib/nav';
import type { Listing } from '@/domain/types';
import { renderWithProviders } from '../testUtils';

jest.mock('@/lib/nav', () => ({ safePush: jest.fn() }));

const YOUTH = { vipps: true, youth: true, age: 16, birthYear: 2010, fullName: 'Emil Nygård', phoneMasked: '' };
const asYouth = () => jest.spyOn(apiClient, 'getMyAccount').mockResolvedValue(YOUTH);

beforeEach(() => {
  community._reset();
  noticeboardStore._reset();
  (safePush as jest.Mock).mockClear();
});
afterEach(() => jest.restoreAllMocks());

describe('Nabolagsprosjekter', () => {
  test('a new forslag is published, and supporting it is counted once', async () => {
    await renderWithProviders(<ProjectsScreen />);
    await fireEvent.press(await screen.findByText('Start et prosjekt'));
    await fireEvent.press(await screen.findByLabelText('Forslag til kommunen'));
    await fireEvent.changeText(screen.getByLabelText('Tittel'), 'Lys i lysløypa');
    await fireEvent.changeText(screen.getByLabelText('Hva og hvorfor'), 'Det er mørkt om kvelden.');
    await fireEvent.press(screen.getByText('Publiser'));
    await waitFor(() => expect(community.projects[0]).toMatchObject({ title: 'Lys i lysløypa', kind: 'PROPOSAL' }));
    const id = community.projects[0].id;
    expect(await apiClient.supportProject(id, true, true)).toBe(1);
    expect(await apiClient.supportProject(id, true, true)).toBe(1);
    // the author sees the names of those who said yes to showing them
    expect((await apiClient.projectSupport(id)).names).toEqual(['Marius B.']);
  });
});

describe('Språkvenn og vennetjeneste', () => {
  test('a youth can sign up as språkvenn but is not offered the vennetjeneste', async () => {
    asYouth();
    await renderWithProviders(<BuddiesScreen />);
    expect(await screen.findByText('Vennetjenesten er for voksne.')).toBeTruthy();
    expect(screen.queryByTestId('buddy-VENNETJENESTE')).toBeNull();
    expect(screen.getByTestId('buddy-SPRAKVENN')).toBeTruthy();
  });

  test('signing up shows that MinNabo is looking for a match', async () => {
    await renderWithProviders(<BuddiesScreen />);
    await fireEvent.press((await screen.findAllByText('Meld meg på'))[0]);
    expect(await screen.findByText('MinNabo leter etter en nabo som passer')).toBeTruthy();
  });
});

describe('Sesongsjekk', () => {
  test('«Få hjelp» opens Legg ut with the category and the task as the title', async () => {
    await renderWithProviders(<SeasonScreen />);
    const first = SEASON_TASKS[seasonOf(new Date())][0];
    await fireEvent.press(await screen.findByLabelText(`Få hjelp med ${first.title}`));
    expect(safePush).toHaveBeenCalledWith(`/legg-ut?kategori=${first.category}&tittel=${encodeURIComponent(first.title)}`);
  });

  test('the seasons follow the months', () => {
    expect(seasonOf(new Date(2026, 3, 1))).toBe('VAR');
    expect(seasonOf(new Date(2026, 6, 1))).toBe('SOMMER');
    expect(seasonOf(new Date(2026, 9, 1))).toBe('HOST');
    expect(seasonOf(new Date(2026, 0, 1))).toBe('VINTER');
  });
});

describe('Søk i Fellesskap', () => {
  test('one word finds lag, partners and oppslag together', async () => {
    await renderWithProviders(<FellesSearchScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Søk i Fellesskap'), 'korps');
    expect(await screen.findByText('Nordre Ål skolekorps')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Søk i Fellesskap'), 'nøkkelknippe');
    expect(await screen.findByText('Funnet: nøkkelknippe ved Søndre park')).toBeTruthy();
  });
});

describe('Lag og foreninger', () => {
  test('shows each lag with its next arrangement', async () => {
    await apiClient.createNoticeboardPost({ kind: 'GENERAL', title: 'Klubbkveld', body: 'Velkommen alle', place: 'Sentrum', municipality: 'Lillehammer', eventType: 'FEST', eventAt: new Date(Date.now() + 3 * 86_400_000).toISOString() });
    noticeboardStore._patch(noticeboardStore.list()[0].id, { organisationId: 'org-lil-il' });
    await renderWithProviders(<OrganisationsScreen />);
    expect(await screen.findByText(/Neste arrangement: Klubbkveld/)).toBeTruthy();
  });
});

describe('the shared helper for one street', () => {
  const listing = (over: Partial<Listing> = {}) =>
    ({ id: 'l-snow', title: 'Måke innkjørselen', status: 'PUBLISHED', sharedStreet: true, location: { municipality: 'Lillehammer', place: 'Søre Ål' }, ...over }) as Listing;

  test('a neighbour joins with a note, and the card counts it', async () => {
    await renderWithProviders(<SharedStreetCard listing={listing()} isOwner={false} />);
    await fireEvent.changeText(await screen.findByLabelText('Hvor er det? (omtrentlig)'), 'Nr. 14');
    await fireEvent.press(screen.getByText('Ta med min innkjørsel'));
    expect(await screen.findByText('1 nabo er med')).toBeTruthy();
    expect(community.joiners['l-snow']).toEqual([{ profileId: 'u-mb', note: 'Nr. 14' }]);
  });

  test('nothing shows on an oppdrag that was not shared', async () => {
    await renderWithProviders(<SharedStreetCard listing={listing({ sharedStreet: false })} isOwner={false} />);
    expect(screen.queryByTestId('shared-street')).toBeNull();
  });
});

describe('farevarsler', () => {
  test('the most serious warning is shown', () => {
    expect(levelOf('3; orange; Severe')).toBe('orange');
    expect(levelOf(undefined)).toBe('yellow');
    const a = pickAlert([
      { properties: { eventAwarenessName: 'Kuling', awareness_level: '2; yellow; Moderate' } },
      { properties: { eventAwarenessName: 'Kraftig snøfall', awareness_level: '3; orange; Severe' } },
    ]);
    expect(a).toMatchObject({ title: 'Kraftig snøfall', level: 'orange' });
    expect(pickAlert([])).toBeNull();
  });
});
