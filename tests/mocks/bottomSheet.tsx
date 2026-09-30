/**
 * Jest stand-in for @gorhom/bottom-sheet. Content renders only while the
 * modal is presented, so tests see sheets open and close like on device.
 */
import { forwardRef, useImperativeHandle, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

type ModalProps = { children?: ReactNode; onDismiss?: () => void };

export const BottomSheetModal = forwardRef<unknown, ModalProps>(function BottomSheetModal(
  { children, onDismiss },
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
  return open ? <View>{children}</View> : null;
});

export const BottomSheetModalProvider = ({ children }: { children?: ReactNode }) => <>{children}</>;
export const BottomSheetView = View;
export const BottomSheetScrollView = ScrollView;
export const BottomSheetBackdrop = () => null;
export const useBottomSheetTimingConfigs = () => ({});
