import type { IconName } from '@/components/ui/Icon';

export type ToastKind = 'success' | 'error' | 'info';
export type ToastAction = { label: string; onPress: () => void };
export type ToastItem = {
  id: number;
  kind: ToastKind;
  text: string;
  /** Icon in the lime circle; defaults per kind. */
  icon?: IconName;
  /** Right-hand action, e.g. "Angre". */
  action?: ToastAction;
};

type Listener = (t: ToastItem) => void;

let seq = 0;
const listeners = new Set<Listener>();

type Extra = { icon?: IconName; action?: ToastAction };

function push(kind: ToastKind, text: string, extra?: Extra) {
  const item: ToastItem = { id: ++seq, kind, text, ...extra };
  listeners.forEach((l) => l(item));
}

/** Imperative toast API. `<ToastHost/>` (mounted at the app root) renders them. */
export const toast = {
  success: (text: string, extra?: Extra) => push('success', text, extra),
  error: (text: string, extra?: Extra) => push('error', text, extra),
  info: (text: string, extra?: Extra) => push('info', text, extra),
  subscribe: (fn: Listener): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
