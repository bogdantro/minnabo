import { act, renderHook, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { LIST_PAGE, ListScreen, useListPaging } from '@/components/ui';
import { renderWithProviders } from '../testUtils';

test('a long list starts with one page and adds a page as the end comes near – never more than there is', async () => {
  const { result } = await renderHook(() => useListPaging(50));
  expect(result.current.shown).toBe(LIST_PAGE);
  await act(async () => result.current.more());
  expect(result.current.shown).toBe(LIST_PAGE * 2);
  await act(async () => result.current.more());
  await act(async () => result.current.more());
  expect(result.current.shown).toBe(50);
});

test('a short list shows everything at once', async () => {
  const { result } = await renderHook(() => useListPaging(7));
  expect(result.current.shown).toBe(7);
});

test('a new filter starts from the first page again', async () => {
  const { result, rerender } = await renderHook(({ k }: { k: string }) => useListPaging(50, k), { initialProps: { k: 'a' } });
  await act(async () => result.current.more());
  expect(result.current.shown).toBe(LIST_PAGE * 2);
  await rerender({ k: 'b' });
  expect(result.current.shown).toBe(LIST_PAGE);
});

test('rows render, and an empty list shows the empty state', async () => {
  await renderWithProviders(
    <ListScreen data={[{ id: 'a' }]} keyExtractor={(r) => r.id} renderItem={({ item }) => <Text>{`rad ${item.id}`}</Text>} />,
  );
  expect(screen.getByText('rad a')).toBeTruthy();
  await renderWithProviders(
    <ListScreen data={[]} keyExtractor={(r: { id: string }) => r.id} renderItem={() => null} empty={<Text>Ingen oppdrag her</Text>} />,
  );
  expect(screen.getByText('Ingen oppdrag her')).toBeTruthy();
});
