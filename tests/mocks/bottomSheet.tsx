/**
 * Jest stand-in for @gorhom/bottom-sheet. Content renders only while the
 * modal is presented, so tests see sheets open and close like on device.
 */
import { forwardRef, useImperativeHandle, useState, type ReactNode } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

type ModalProps = { children?: ReactNode; onDismiss?: () => void; footerComponent?: (props: object) => ReactNode };

export const BottomSheetModal = forwardRef<unknown, ModalProps>(function BottomSheetModal(
  { children, onDismiss, footerComponent },
  ref,
) {
  const [open, setOpen] = useState(false);
  useImperativeHandle(ref, () => ({
    present: () => setOpen(true),
    dismiss: () => {
      setOpen((wasOpen) => {
        if (wasOpen) onDismiss?.();
        return false;
      });
    },
  }));
  // a pinned footer (Sheet `footer`) is drawn after the content
  return open ? (
    <View>
      {children}
      {footerComponent ? footerComponent({}) : null}
    </View>
  ) : null;
});

export const BottomSheetModalProvider = ({ children }: { children?: ReactNode }) => <>{children}</>;
export const BottomSheetView = View;
export const BottomSheetScrollView = ScrollView;
export const BottomSheetBackdrop = () => null;
export const BottomSheetFooter = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
export const useBottomSheetTimingConfigs = () => ({});
export const BottomSheetTextInput = TextInput;
/** Real hook returns the sheet context; outside a sheet (unsafe) it is null. */
export const useBottomSheetInternal = () => null;
