import type { ReactNode } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './Text';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';

export type ScreenStatus =
  | 'ready'
  | 'loading'
  | 'error'
  | 'offline'
  | 'empty'
  | 'noAccess';

export type ScreenStateProps = {
  status: ScreenStatus;
  onRetry?: () => void;
  emptyText?: string;
  children?: ReactNode;
};

const config: Record<
  Exclude<ScreenStatus, 'ready'>,
  { icon: IconName; message: string; retry: boolean }
> = {
  loading: { icon: 'loader', message: nb.state.loading, retry: false },
  error: { icon: 'alert-triangle', message: nb.state.error, retry: true },
  offline: { icon: 'wifi-off', message: nb.state.offline, retry: true },
  empty: { icon: 'inbox', message: nb.state.emptyListings, retry: false },
  noAccess: { icon: 'lock', message: nb.state.noAccess, retry: false },
};

export function ScreenState({ status, onRetry, emptyText, children }: ScreenStateProps) {
  if (status === 'ready') {
    return <>{children}</>;
  }

  const c = config[status];
  const message = status === 'empty' ? emptyText ?? c.message : c.message;

  return (
    <View style={styles.wrap} accessibilityRole="alert">
      {status === 'loading' ? (
        <ActivityIndicator color={tokens.color.cyan} size="large" />
      ) : (
        <Icon name={c.icon} size={32} color="navyMuted" />
      )}
      <AppText variant="body" color="navyMuted" align="center">
        {message}
      </AppText>
      {c.retry && onRetry ? (
        <Button
          variant="secondary"
          label={nb.state.retry}
          onPress={onRetry}
          style={styles.retry}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.md,
    padding: tokens.space.xxl,
    minHeight: 220,
  },
  retry: {
    marginTop: tokens.space.sm,
    paddingHorizontal: tokens.space.xxl,
  },
});
