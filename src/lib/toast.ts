export type ToastKind = 'success' | 'error' | 'info';
export type ToastItem = { id: number; kind: ToastKind; text: string };

type Listener = (t: ToastItem) => void;

let seq = 0;
const listeners = new Set<Listener>();

function push(kind: ToastKind, text: string) {
  const item: ToastItem = { id: ++seq, kind, text };
  listeners.forEach((l) => l(item));
}

/** Imperative toast API. `<ToastHost/>` (mounted at the app root) renders them. */
export const toast = {
  success: (text: string) => push('success', text),
  error: (text: string) => push('error', text),
  info: (text: string) => push('info', text),
  subscribe: (fn: Listener): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
