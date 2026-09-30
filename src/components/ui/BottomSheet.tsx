import type { ReactNode } from 'react';
import { Sheet } from './Sheet';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** @deprecated sheets size to their content (max 90 %). Kept for old call sites. */
  heightRatio?: number;
  /** @deprecated see heightRatio */
  maxHeight?: number;
  children: ReactNode;
};

/**
 * @deprecated use `<Sheet>`. Thin wrapper so older screens get the redesigned
 * sheet until they are rebuilt. Content scrolls, like the old component did.
 */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} scroll>
      {children}
    </Sheet>
  );
}
