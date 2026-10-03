import { screen, fireEvent } from '@testing-library/react-native';
import { SearchScreen } from '@/screens/SearchScreen';
import { SavedScreen } from '@/screens/SavedScreen';
import { savedSearchStore } from '@mocks/data/savedSearchStore';
import { renderWithProviders } from '../testUtils';

const settle = () => new Promise((r) => setTimeout(r, 500));

test('saving a search from /sok stores it in one tap', async () => {
  await renderWithProviders(<SearchScreen initialQuery="plen" />);
  await settle();

  await fireEvent.press(screen.getByText('Lagre søk'));
  await settle();

  const saved = savedSearchStore.list();
  expect(saved).toHaveLength(1);
  expect(saved[0].name).toBe('plen');
  expect(saved[0].filter.query).toBe('plen');
});

test('Lagrede screen lists saved searches under the Søk tab, delete has Angre', async () => {
  savedSearchStore.add('Hage nær meg', { query: 'hage', categorySlug: 'hage' }, 'RELEVANCE');
  await renderWithProviders(<SavedScreen />);

  await fireEvent.press(await screen.findByRole('tab', { name: 'Søk (1)' }));
  await settle();

  expect(screen.getByText('«hage»')).toBeTruthy();
  expect(screen.getByText(/Hage nær meg · Lagret/)).toBeTruthy();
  expect(screen.getByText('Hage')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Slett søket hage'));
  await settle();
  expect(savedSearchStore.list()).toHaveLength(0);
  expect(await screen.findByText('Ingen lagrede søk')).toBeTruthy();
});

test('unsaving a listing on Lagrede removes it and Angre brings it back', async () => {
  const { savedStore } = require('@mocks/data/savedStore');
  const { toast } = require('@/lib/toast');
  let undo: (() => void) | undefined;
  const off = toast.subscribe((t: { action?: { onPress: () => void } }) => (undo = t.action?.onPress));
  savedStore.toggle('l-male-gjerdet');
  await renderWithProviders(<SavedScreen />);

  await fireEvent.press(await screen.findByLabelText('Fjern Male gjerdet fra lagrede'));
  await settle();
  expect(savedStore.has('l-male-gjerdet')).toBe(false);
  expect(await screen.findByText('Ingen lagrede oppføringer')).toBeTruthy();

  undo?.();
  await settle();
  off();
  expect(savedStore.has('l-male-gjerdet')).toBe(true);
});
