import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { StatusPill } from '@/components/ui/StatusPill';
import { CategoryChip } from '@/components/ui/CategoryChip';
import { SearchField } from '@/components/ui/SearchField';
import { ScreenState } from '@/components/ui/ScreenState';

const flatten = (style: unknown): string => JSON.stringify(style);

test('AppText applies the variant font size', async () => {
  await render(<AppText variant="question">Hei</AppText>);
  expect(flatten(screen.getByText('Hei').props.style)).toContain('"fontSize":24');
});

test('Avatar shows initials with no uri and an online dot when online', async () => {
  await render(<Avatar initials="JB" online testID="av" />);
  expect(screen.getByText('JB')).toBeTruthy();
  expect(screen.getByTestId('av-online')).toBeTruthy();
});

test('Button ignores re-taps while an async onPress is still running', async () => {
  let resolve!: () => void;
  const fn = jest.fn(() => new Promise<void>((r) => (resolve = r)));
  await render(<Button label="Gi tilbud" onPress={fn} />);
  await fireEvent.press(screen.getByText('Gi tilbud'));
  await fireEvent.press(screen.getByText('Gi tilbud'));
  expect(fn).toHaveBeenCalledTimes(1);
  resolve();
});

test('Button fires a synchronous onPress on every tap', async () => {
  const fn = jest.fn();
  await render(<Button label="Neste" onPress={fn} />);
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(screen.getByText('Neste'));
  expect(fn).toHaveBeenCalledTimes(2);
});

test('disabled Button does not fire', async () => {
  const fn = jest.fn();
  await render(<Button label="Send" onPress={fn} disabled />);
  await fireEvent.press(screen.getByText('Send'));
  expect(fn).not.toHaveBeenCalled();
});

test('StatusPill shows its label', async () => {
  await render(<StatusPill label="Åpent oppdrag" tone="cyan" />);
  expect(screen.getByText('Åpent oppdrag')).toBeTruthy();
});

test('CategoryChip fires onPress', async () => {
  const fn = jest.fn();
  await render(<CategoryChip label="Hage" icon="feather" onPress={fn} />);
  await fireEvent.press(screen.getByText('Hage'));
  expect(fn).toHaveBeenCalled();
});

test('SearchField calls onChangeText', async () => {
  const fn = jest.fn();
  await render(
    <SearchField placeholder="Søk etter småjobber" value="" onChangeText={fn} />,
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText('Søk etter småjobber'),
    'plen',
  );
  expect(fn).toHaveBeenCalledWith('plen');
});

test('ScreenState renders children when ready', async () => {
  await render(
    <ScreenState status="ready">
      <Text>Innhold</Text>
    </ScreenState>,
  );
  expect(screen.getByText('Innhold')).toBeTruthy();
});

test('ScreenState shows retry on error and calls onRetry', async () => {
  const fn = jest.fn();
  await render(<ScreenState status="error" onRetry={fn} />);
  await fireEvent.press(screen.getByText('Prøv igjen'));
  expect(fn).toHaveBeenCalled();
});

test('ScreenState offline message mentions nett', async () => {
  await render(<ScreenState status="offline" />);
  expect(screen.getByText(/nett/i)).toBeTruthy();
});
