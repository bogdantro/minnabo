import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Sheet } from '@/components/ui/Sheet';
import { renderWithProviders } from '../testUtils';

/**
 * Meny froze (2026-11-12): open a page from Meny and come back, or tap Meny again, while the sheet is still
 * sliding down. Like the real library, this stand-in closes over time: `dismiss()` starts the animation,
 * `present()` during it is ignored, and `onDismiss` comes when it ends («finish-close» here).
 */
jest.mock('@gorhom/bottom-sheet', () => {
  /* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories can't use imports */
  const React = require('react');
  const { Pressable, ScrollView, View } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const BottomSheetModal = React.forwardRef(function BottomSheetModal(
    { children, onDismiss }: { children?: unknown; onDismiss?: () => void },
    ref: unknown,
  ) {
    const [open, setOpen] = React.useState(false);
    // a counter so every change of the status draws again, like the animation does
    const [, redraw] = React.useState(0);
    const status = React.useRef('CLOSED');
    React.useImperativeHandle(ref, () => ({
      present: () => {
        if (status.current === 'DISMISSING') return;
        status.current = 'PRESENTED';
        setOpen(true);
        redraw((n: number) => n + 1);
      },
      dismiss: () => {
        if (status.current === 'PRESENTED') status.current = 'DISMISSING';
        redraw((n: number) => n + 1);
      },
    }));
    const finish = () => {
      if (status.current !== 'DISMISSING') return;
      // eslint-disable-next-line react-hooks/immutability -- a stand-in for the library's own animation state
      status.current = 'CLOSED';
      setOpen(false);
      onDismiss?.();
    };
    return (
      <>
        {/* the end of the slide-down animation */}
        <Pressable testID="finish-close" onPress={finish} />
        {open && status.current !== 'DISMISSING' ? <View>{children}</View> : null}
      </>
    );
  });
  return {
    BottomSheetModal,
    BottomSheetView: View,
    BottomSheetScrollView: ScrollView,
    BottomSheetBackdrop: () => null,
    useBottomSheetTimingConfigs: () => ({}),
  };
});

let openState = false;
function Harness() {
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line react-hooks/globals -- the test reads what the screen holds
  openState = open;
  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <Text>Åpne meny</Text>
      </Pressable>
      <Pressable onPress={() => setOpen(false)}>
        <Text>Gå til en side</Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Menyen">
        <Text>Innholdet i menyen</Text>
      </Sheet>
    </>
  );
}

test('opening the sheet again while it is still closing opens it once the close is done', async () => {
  await renderWithProviders(<Harness />);
  await fireEvent.press(screen.getByText('Åpne meny'));
  expect(screen.getByText('Innholdet i menyen')).toBeTruthy();

  // a page is opened from Meny: the sheet starts to slide down …
  await fireEvent.press(screen.getByText('Gå til en side'));
  // … and Meny is opened again before it has finished
  await fireEvent.press(screen.getByText('Åpne meny'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('finish-close'));
  });

  expect(screen.getByText('Innholdet i menyen')).toBeTruthy();
  expect(openState).toBe(true);
});

test('after that, Meny still closes and opens normally', async () => {
  await renderWithProviders(<Harness />);
  await fireEvent.press(screen.getByText('Åpne meny'));
  await fireEvent.press(screen.getByText('Gå til en side'));
  await fireEvent.press(screen.getByText('Åpne meny'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('finish-close'));
  });
  await fireEvent.press(screen.getByText('Gå til en side'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('finish-close'));
  });
  expect(screen.queryByText('Innholdet i menyen')).toBeNull();
  expect(openState).toBe(false);
  await fireEvent.press(screen.getByText('Åpne meny'));
  expect(screen.getByText('Innholdet i menyen')).toBeTruthy();
});

test('a sheet stuck half-closed (the close is never reported) still opens again shortly after', async () => {
  await renderWithProviders(<Harness />);
  await fireEvent.press(screen.getByText('Åpne meny'));
  await fireEvent.press(screen.getByText('Gå til en side'));
  await fireEvent.press(screen.getByText('Åpne meny'));
  // «finish-close» is never pressed: the close never ends
  await act(async () => {
    await new Promise((r) => setTimeout(r, 1000));
  });
  expect(screen.getByText('Innholdet i menyen')).toBeTruthy();
  expect(openState).toBe(true);
});
