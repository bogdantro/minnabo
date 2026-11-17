/** Buttons and cards on a message from MinNabo (0111, asked 2026-11-16). */
import { fireEvent, screen, within } from '@testing-library/react-native';
import { MinNaboScreen } from '@/screens/MinNaboScreen';
import { minnaboLinks } from '@/domain/minnaboLinks';
import { minnaboStore } from '@mocks/data/minnaboStore';
import { safePush } from '@/lib/nav';
import { renderWithProviders } from '../testUtils';

jest.mock('@/lib/nav', () => ({ safePush: jest.fn(), safeNavigate: jest.fn() }));

beforeEach(() => {
  minnaboStore._reset();
  (safePush as jest.Mock).mockClear();
});

describe('which links a message shows', () => {
  test('a known place gets its default label, and my own label wins', () => {
    const links = minnaboLinks([{ type: 'route', key: 'kommune' }, { type: 'route', key: 'fellesskap', label: 'Se hva som skjer' }], false);
    expect(links.map((l) => (l.kind === 'button' ? [l.label, l.path] : null))).toEqual([
      ['Velg kommune', '/profil/rediger'],
      ['Se hva som skjer', '/fellesskap'],
    ]);
  });

  test('a key this app does not know is left out instead of opening a broken page', () => {
    expect(minnaboLinks([{ type: 'route', key: 'noe_nytt' }], false)).toEqual([]);
  });

  test('a youth never gets a button to something they cannot use, and «Se oppdrag» goes to their own home', () => {
    const links = minnaboLinks([{ type: 'route', key: 'legg_ut' }, { type: 'route', key: 'sesongsjekk' }, { type: 'route', key: 'oppdrag' }], true);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ kind: 'button', path: '/ung' });
  });

  test('cards open the business, the nabolag and the lag; a hidden one (no name) drops out', () => {
    const links = minnaboLinks(
      [
        { type: 'partner', id: 'p1', name: 'Fjellbygg AS', sub: 'Bygg og vedlikehold' },
        { type: 'nabolag', id: 'n1', name: 'Søre Ål', place: 'Søre Ål', sub: 'Lillehammer' },
        { type: 'lag', id: 'o1', name: 'Lillehammer IL' },
        { type: 'lag', id: 'o2' },
      ],
      false,
    );
    expect(links.map((l) => l.path)).toEqual(['/partner/p1', '/nabolag?place=S%C3%B8re%20%C3%85l&kommune=Lillehammer', '/foreninger?vis=o1']);
  });
});

describe('in the MinNabo chat', () => {
  test('a button opens its place, and a business card opens the business', async () => {
    minnaboStore.adminSends({
      body: 'Du har ikke valgt kommune ennå.',
      attachments: [
        { type: 'route', key: 'kommune' },
        { type: 'partner', id: 'p1', name: 'Fjellbygg AS', sub: 'Bygg og vedlikehold' },
      ],
    });
    await renderWithProviders(<MinNaboScreen />);
    const links = await screen.findByTestId('minnabo-links');
    await fireEvent.press(within(links).getByText('Velg kommune'));
    expect(safePush).toHaveBeenCalledWith('/profil/rediger');
    await fireEvent.press(within(links).getByLabelText('Fjellbygg AS. Bygg og vedlikehold. Se bedriften'));
    expect(safePush).toHaveBeenCalledWith('/partner/p1');
  });

  test('a message without attachments shows no links', async () => {
    minnaboStore.adminSends({ body: 'Bare tekst.' });
    await renderWithProviders(<MinNaboScreen />);
    expect(await screen.findByText('Bare tekst.')).toBeTruthy();
    expect(screen.queryByTestId('minnabo-links')).toBeNull();
  });
});
