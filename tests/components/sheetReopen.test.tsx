import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { screen, fireEvent } from '@testing-library/react-native';
import { Sheet } from '@/components/ui/Sheet';
import { renderWithProviders } from '../testUtils';

/**
 * Stricter stand-in than tests/mocks/bottomSheet.tsx: like the real library (5.2),
 * `dismiss()` on a modal that is not mounted leaves it in "dismissing", and a
 * modal in that state ignores later `present()` calls.
 */
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { Pressable, ScrollView, View } = require('react-native');
  const BottomSheetModal = React.forwardRef(function BottomSheetModal(
    { children, onDismiss }: { children?: unknown; onDismiss?: () => void },
    ref: unknown,
  ) {
    const [open, setOpen] = React.useState(false);
    const status = React.useRef('INITIAL');
    const close = () => {
      status.current = 'INITIAL';
      setOpen(false);
      onDismiss?.();
    };
    React.useImperativeHandle(ref, () => ({
      present: () => {
        if (status.current === 'DISMISSING') return;
        status.current = 'PRESENTED';
        setOpen(true);
      },
      dismiss: () => {
        if (status.current === 'PRESENTED') close();
        else status.current = 'DISMISSING';
      },
    }));
    return open ? (
      <View>
        {/* the user swiping the sheet down / tapping the scrim */}
        <Pressable testID="swipe-down" onPress={close} />
        {children}
      </View>
    ) : null;
  });
  return {
    BottomSheetModal,
    BottomSheetView: View,
    BottomSheetScrollView: ScrollView,
    BottomSheetBackdrop: () => null,
    useBottomSheetTimingConfigs: () => ({}),
  };
});

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <Text>Åpne</Text>
      </Pressable>
      <Pressable onPress={() => setOpen(false)}>
        <Text>Lukk utenfra</Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Meny">
        <Text>Innhold</Text>
      </Sheet>
    </>
  );
}

test('opens again after the user swiped it down', async () => {
  await renderWithProviders(<Harness />);
  await fireEvent.press(screen.getByText('Åpne'));
  expect(screen.getByText('Innhold')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('swipe-down'));
  expect(screen.queryByText('Innhold')).toBeNull();

  await fireEvent.press(screen.getByText('Åpne'));
  expect(screen.getByText('Innhold')).toBeTruthy();
});

test('opens again after the close button', async () => {
  await renderWithProviders(<Harness />);
  await fireEvent.press(screen.getByText('Åpne'));
  await fireEvent.press(screen.getByLabelText('Lukk'));
  expect(screen.queryByText('Innhold')).toBeNull();

  await fireEvent.press(screen.getByText('Åpne'));
  expect(screen.getByText('Innhold')).toBeTruthy();
});

test('opens again after being closed by the parent', async () => {
  await renderWithProviders(<Harness />);
  await fireEvent.press(screen.getByText('Åpne'));
  await fireEvent.press(screen.getByText('Lukk utenfra'));
  expect(screen.queryByText('Innhold')).toBeNull();

  await fireEvent.press(screen.getByText('Åpne'));
  expect(screen.getByText('Innhold')).toBeTruthy();
});
