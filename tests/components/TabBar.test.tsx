import { screen, fireEvent } from '@testing-library/react-native';
import { TabBar, type TabBarProps } from '@/components/TabBar';
import { renderWithProviders } from '../testUtils';

const navigation = {
  navigate: jest.fn(),
  emit: jest.fn(() => ({ defaultPrevented: false })),
};
const state = {
  index: 0,
  routes: [
    { key: 'index', name: 'index' },
    { key: 'fellesskap', name: 'fellesskap' },
    { key: 'innboks', name: 'innboks' },
    { key: 'meny', name: 'meny' },
  ],
};

const props = (): TabBarProps => ({ state, navigation });

test('renders the tab labels, and «Legg ut» under the raised button (asked 2026-11-03)', async () => {
  await renderWithProviders(<TabBar {...props()} />);
  for (const l of ['Oppdrag', 'Fellesskap', 'Legg ut', 'Innboks', 'Meny']) {
    expect(screen.getByText(l)).toBeTruthy();
  }
  expect(screen.getByLabelText('Legg ut')).toBeTruthy();
});

test('tapping Fellesskap navigates to it', async () => {
  navigation.navigate.mockClear();
  await renderWithProviders(<TabBar {...props()} />);
  await fireEvent.press(screen.getByText('Fellesskap'));
  expect(navigation.navigate).toHaveBeenCalledWith('fellesskap');
});

test('the active tab sits in a perfect circle (equal sides, half radius, never squeezed)', async () => {
  const { StyleSheet } = require('react-native');
  await renderWithProviders(<TabBar {...props()} />);
  const s = StyleSheet.flatten(screen.getByTestId('nav-active-bubble').props.style);
  expect(s.width).toBe(s.height);
  expect(s.borderRadius).toBe(s.width / 2);
  expect(s.flexShrink).toBe(0);
  expect(s.backgroundColor).toBeTruthy();
});
