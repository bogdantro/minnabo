import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { Input } from '@/components/ui';

// Inside a sheet, and BottomSheetTextInput behaving like the real one on react-native-web:
// its focus handler calls TextInput.State.currentlyFocusedInput(), which the web build lacks.
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { TextInput } = require('react-native');
  return {
    ...jest.requireActual('@mocks/bottomSheet'),
    useBottomSheetInternal: () => ({}),
    BottomSheetTextInput: React.forwardRef(function BottomSheetTextInput(props: object, ref: unknown) {
      return React.createElement(TextInput, {
        ...props,
        ref,
        onFocus: () => {
          throw new Error('RNTextInput.default.State.currentlyFocusedInput is not a function');
        },
      });
    }),
  };
});

const os = Platform.OS;
afterEach(() => {
  Platform.OS = os;
});

test('on web, focusing an input inside a sheet does not crash', async () => {
  Platform.OS = 'web';
  await render(<Input accessibilityLabel="Søk" />);
  await expect(fireEvent(screen.getByLabelText('Søk'), 'focus')).resolves.not.toThrow();
});
