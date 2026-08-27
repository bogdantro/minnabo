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

test('renders all five labels including Legg ut', async () => {
  await renderWithProviders(<TabBar {...props()} />);
  for (const l of ['Oppdrag', 'Fellesskap', 'Legg ut', 'Innboks', 'Meny']) {
    expect(screen.getByText(l)).toBeTruthy();
  }
});

test('tapping Fellesskap navigates to it', async () => {
  navigation.navigate.mockClear();
  await renderWithProviders(<TabBar {...props()} />);
  await fireEvent.press(screen.getByText('Fellesskap'));
  expect(navigation.navigate).toHaveBeenCalledWith('fellesskap');
});
