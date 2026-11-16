/**
 * Links that must land on the right thing (asked 2026-11-15: hits in «Søk i Fellesskap» opened the wrong place).
 * An oppslag link shows that oppslag first, a lag or prosjekt link puts that one first, and typos still find oppdrag.
 */
import { fireEvent, screen, within } from '@testing-library/react-native';
import { NoticeboardScreen } from '@/screens/NoticeboardScreen';
import { OrganisationsScreen } from '@/screens/felles/OrganisationsScreen';
import { ProjectsScreen } from '@/screens/felles/ProjectsScreen';
import { FellesSearchScreen } from '@/screens/felles/FellesSearchScreen';
import { safePush } from '@/lib/nav';
import { fuzzyMatch, editDistance } from '@/lib/fuzzy';
import { repositories } from '@mocks/data/repositories';
import { renderWithProviders } from '../testUtils';

jest.mock('@/lib/nav', () => ({ safePush: jest.fn(), safeNavigate: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const expoRouter = require('expo-router');
const params = (p: Record<string, string>) => jest.spyOn(expoRouter, 'useLocalSearchParams').mockReturnValue(p);

afterEach(() => {
  jest.restoreAllMocks();
  (safePush as jest.Mock).mockClear();
});

describe('Oppslagstavla', () => {
  test('a link to one oppslag shows that oppslag first and marked, without opening the answers', async () => {
    params({ oppslag: 'n-seed-3' });
    await renderWithProviders(<NoticeboardScreen />);
    const marked = await screen.findByTestId('focused-oppslag');
    expect(within(marked).getByText('Funnet: nøkkelknippe ved Søndre park')).toBeTruthy();
    expect(screen.getByText('Oppslaget du åpnet')).toBeTruthy();
    // the answers stay closed: the oppslag itself is what was asked for
    expect(screen.queryByText('Ingen svar ennå. Bli den første.')).toBeNull();
  });

  test('«Vis alle» goes back to the plain list', async () => {
    params({ oppslag: 'n-seed-3' });
    await renderWithProviders(<NoticeboardScreen />);
    await fireEvent.press(await screen.findByText('Vis alle'));
    expect(screen.queryByTestId('focused-oppslag')).toBeNull();
  });

  test('an answer varsel (svar=1) opens the answers too', async () => {
    params({ oppslag: 'n-seed-3', svar: '1' });
    await renderWithProviders(<NoticeboardScreen />);
    expect(await screen.findByTestId('focused-oppslag')).toBeTruthy();
    expect(await screen.findByText('Ingen svar ennå. Bli den første.')).toBeTruthy();
  });

  test('a link to an oppslag that is gone says so', async () => {
    params({ oppslag: 'n-finnes-ikke' });
    await renderWithProviders(<NoticeboardScreen />);
    expect(await screen.findByText('Oppslaget finnes ikke lenger. Det kan være avsluttet eller slettet.')).toBeTruthy();
    expect(screen.queryByTestId('focused-oppslag')).toBeNull();
  });
});

describe('Lag og prosjekter', () => {
  test('a lag from the search comes first, marked', async () => {
    params({ vis: 'org-lil-vel' });
    await renderWithProviders(<OrganisationsScreen />);
    expect(await screen.findByText('Søre Ål vel')).toBeTruthy();
    const cards = screen.getAllByTestId(/^org-/);
    expect(cards[0].props.testID).toBe('org-org-lil-vel');
  });

  test('a prosjekt from the search comes first', async () => {
    params({ vis: 'cp-fartshump' });
    await renderWithProviders(<ProjectsScreen />);
    expect(await screen.findByText('Fartshump i Storgata ved skolen')).toBeTruthy();
    expect(screen.getAllByTestId(/^project-/)[0].props.testID).toBe('project-cp-fartshump');
  });

  test('«Søk i Fellesskap» opens the lag it found, not just the list', async () => {
    params({});
    await renderWithProviders(<FellesSearchScreen />);
    await fireEvent.changeText(screen.getByLabelText('Søk i Fellesskap'), 'søre ål vel');
    await fireEvent.press(await screen.findByText('Søre Ål vel'));
    expect(safePush).toHaveBeenCalledWith('/foreninger?vis=org-lil-vel');
  });
});

describe('typos in Søk', () => {
  test('edit distance counts single changes', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('flyting', 'flytting')).toBe(1);
  });

  test('a small typo finds the word, a short different word does not', () => {
    const all = repositories.listings.list({}, 'NEWEST');
    expect(fuzzyMatch(all, 'flyting').map((l) => l.title)).toContain('Hjelp med flytting');
    expect(fuzzyMatch(all, 'zzzz')).toEqual([]);
  });
});
