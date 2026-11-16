/** Fellesskap (0108): the new parts of the tab, the new pages and the rules they follow. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { community } from '@mocks/mockCommunity';
import { noticeboardStore } from '@mocks/data/noticeboardStore';
import { FellesskapScreen } from '@/screens/FellesskapScreen';
import { NoticeboardScreen } from '@/screens/NoticeboardScreen';
import { moreRows } from '@/components/community/FellesTop';
import { safePush } from '@/lib/nav';
import { renderWithProviders } from '../testUtils';

jest.mock('@/lib/nav', () => ({ safePush: jest.fn() }));


beforeEach(() => {
  community._reset();
  noticeboardStore._reset();
  (safePush as jest.Mock).mockClear();
});
afterEach(() => jest.restoreAllMocks());

describe('the Fellesskap tab', () => {
  test('shows this week in the nabolag and how often neighbours helped this month', async () => {
    await renderWithProviders(<FellesskapScreen />);
    expect(await screen.findByTestId('felles-week')).toBeTruthy();
    // the card reads as one sentence: the week's counts and the month's number
    expect(screen.getByLabelText(/6 jobber gjort.*hjalp hverandre 23 ganger/)).toBeTruthy();
  });

  test('«Ukas bilde» is the photo with the most hearts, on Oppslagstavla (moved 2026-11-15)', async () => {
    await renderWithProviders(<NoticeboardScreen />);
    expect(await screen.findByText('Morgentåke over Mjøsa')).toBeTruthy();
    expect(screen.queryByText('Fullmåne over Hafjell')).toBeNull();
  });

  test('Fellesskap no longer shows «Ukas bilde» or «Nye naboer»', async () => {
    await renderWithProviders(<FellesskapScreen />);
    expect(await screen.findByTestId('felles-week')).toBeTruthy();
    expect(screen.queryByTestId('ukas-bilde')).toBeNull();
    expect(screen.queryByTestId('new-neighbours')).toBeNull();
    expect(screen.getByText('Gratis for deg')).toBeTruthy();
    // Utlån and «Skjer i nærheten» moved to Oppslagstavla (2026-11-16)
    expect(screen.queryByTestId('fellesskap-utlan')).toBeNull();
    expect(screen.queryByText('Skjer i nærheten')).toBeNull();
  });

  test('Oppslagstavla has the Utlån card', async () => {
    await renderWithProviders(<NoticeboardScreen />);
    expect(await screen.findByTestId('tavle-utlan')).toBeTruthy();
    expect(screen.getByText('Ting naboene låner ut')).toBeTruthy();
  });

  test('«Jeg kan hjelpe i dag» is gone from Fellesskap (removed 2026-11-15)', async () => {
    await renderWithProviders(<FellesskapScreen />);
    expect(await screen.findByTestId('felles-week')).toBeTruthy();
    expect(screen.queryByTestId('help-today')).toBeNull();
    expect(screen.queryByLabelText('Jeg kan hjelpe i dag')).toBeNull();
    // «Ditt år i Fellesskap» went too
    expect(screen.queryByText('Ditt år i Fellesskap')).toBeNull();
  });

  test('«Mer i nabolaget» left Fellesskap for a menu on Oppslagstavla (2026-11-16)', async () => {
    await renderWithProviders(<FellesskapScreen />);
    expect(await screen.findByTestId('felles-week')).toBeTruthy();
    expect(screen.queryByTestId('felles-more')).toBeNull();
    expect(screen.queryByText('Mer i nabolaget')).toBeNull();
    // «Gratis for deg» stays: it introduces the støttespillere below it
    expect(screen.getByText('Gratis for deg')).toBeTruthy();
  });

  test('Oppslagstavla has a «Mer i nabolaget» menu row in its group card', async () => {
    await renderWithProviders(<NoticeboardScreen />);
    expect(await screen.findByTestId('tavle-more')).toBeTruthy();
    expect(screen.getByText('Lag, prosjekter, språkvenn og mer')).toBeTruthy();
  });

  test('the menu: no Ukas bilde (already on the board), and a youth gets no sesongsjekk', () => {
    expect(moreRows(false).map((r) => r.path)).toEqual(['/foreninger', '/prosjekter', '/naboskap', '/sesongsjekk']);
    expect(moreRows(true).map((r) => r.path)).toEqual(['/foreninger', '/prosjekter', '/naboskap']);
  });

  test('a vote for a lag counts once, and moving it moves the one vote', async () => {
    await renderWithProviders(<FellesskapScreen />);
    expect(await screen.findByTestId('support-card')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Stem: Lillehammer IL'));
    await waitFor(() => expect(screen.getByText('13 stemmer')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Stem: Nordre Ål skolekorps'));
    await waitFor(() => expect(screen.getByText('12 stemmer')).toBeTruthy());
    expect(screen.getByText('10 stemmer')).toBeTruthy();
  });
});

