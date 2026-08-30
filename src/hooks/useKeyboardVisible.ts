import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/** True while the software keyboard is shown. */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setVisible(false));
    // Android has no *Will* events
    const showA = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hideA = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
      showA.remove();
      hideA.remove();
    };
  }, []);
  return visible;
}
