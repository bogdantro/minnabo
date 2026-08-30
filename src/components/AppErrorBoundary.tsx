import { Component, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { reportError } from '@/lib/reporting';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { Button } from './ui/Button';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catches render/runtime errors anywhere below it and shows a recovery screen. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    reportError(error, { componentStack: info.componentStack, boundary: 'root' });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.wrap}>
        <View style={styles.badge}>
          <Icon name="alert-triangle" size={30} color="dangerText" />
        </View>
        <AppText variant="section" weight="extrabold" align="center">
          {nb.errorBoundary.title}
        </AppText>
        <AppText variant="body" color="navyMuted" align="center" style={styles.body}>
          {nb.errorBoundary.body}
        </AppText>
        <Button label={nb.errorBoundary.retry} onPress={this.reset} />
        <Button
          label={nb.errorBoundary.report}
          variant="ghost"
          onPress={() => reportError(error, { boundary: 'root', manual: true })}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: tokens.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.md,
    padding: tokens.space.xxl,
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FDECEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.space.sm,
  },
  body: { marginBottom: tokens.space.sm },
});
