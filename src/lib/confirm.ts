import { Alert, Platform } from 'react-native';
import nb from '@/i18n/nb';

/**
 * Promise-based confirmation dialog for destructive / irreversible actions.
 * Resolves true if the user confirms.
 */
export function confirm(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const confirmLabel = opts.confirmLabel ?? nb.common.confirm;
  const cancelLabel = opts.cancelLabel ?? nb.common.cancel;

  if (Platform.OS === 'web') {
    // RN Web has no Alert with buttons — fall back to window.confirm.
    const ok =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(`${opts.title}${opts.message ? `\n\n${opts.message}` : ''}`)
        : true;
    return Promise.resolve(ok);
  }

  return new Promise((resolve) => {
    Alert.alert(opts.title, opts.message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: opts.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
