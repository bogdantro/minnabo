import { screen, fireEvent } from '@testing-library/react-native';
import { SearchScreen } from '@/screens/SearchScreen';
import { SavedScreen } from '@/screens/SavedScreen';
import { savedSearchStore } from '@/data/savedSearchStore';
import { renderWithProviders } from '../testUtils';

const settle = () => new Promise((r) => setTimeout(r, 500));

test('saving a search from /sok stores it with the given name', async () => {
  await renderWithProviders(<SearchScreen initialQuery="plen" />);
  await settle();

  await fireEvent.press(screen.getByLabelText('Lagre dette søket'));
  await fireEvent.changeText(screen.getByPlaceholderText('F.eks. Hage i Lillehammer'), 'Plenklipping');
  await fireEvent.press(screen.getAllByText('Lagre søk').slice(-1)[0]);

  const saved = savedSearchStore.list();
  expect(saved).toHaveLength(1);
  expect(saved[0].name).toBe('Plenklipping');
  expect(saved[0].filter.query).toBe('plen');
});

test('Lagrede screen lists saved searches under the Søk tab', async () => {
  savedSearchStore.add('Hage nær meg', { query: 'hage', categorySlug: 'hage' }, 'RELEVANCE');
  await renderWithProviders(<SavedScreen />);

  await fireEvent.press(screen.getByText('Søk'));
  await settle();

  expect(screen.getByText('Hage nær meg')).toBeTruthy();
  expect(screen.getByText('«hage»')).toBeTruthy();
});
