import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import nb from '@/i18n/nb';
import { screenPadding } from '@/theme/theme';
import { RowSkeleton } from './Skeleton';
import { EmptyState, ErrorState, NoAccess, StateView } from './States';

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

/** One switch for the screen states in design/screens/Tilstander.dc.html. */
export function ScreenState({ status, onRetry, emptyText, children }: ScreenStateProps) {
  const router = useRouter();

  switch (status) {
    case 'ready':
      return <>{children}</>;
    case 'loading':
      return (
        <View style={styles.skeleton} accessibilityRole="progressbar" accessibilityLabel={nb.state.loading}>
          {[0, 1, 2, 3].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      );
    case 'error':
      return <ErrorState onRetry={onRetry} />;
    case 'offline':
      return (
        <StateView
          icon="wifioff"
          tone="neutral"
          title={nb.state.offlineTitle}
          body={nb.state.offline}
          actionLabel={nb.state.retry}
          actionIcon="refresh"
          onAction={onRetry}
        />
      );
    case 'empty':
      return <EmptyState icon="clip" title={emptyText ?? nb.state.emptyListings} />;
    case 'noAccess':
      return <NoAccess onAction={() => router.replace('/')} />;
  }
}

const styles = StyleSheet.create({
  skeleton: { flex: 1, gap: 18, paddingHorizontal: screenPadding, paddingTop: 16 },
});
