import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { tokens } from '@/theme';

/**
 * Screen shell for anything with a text input: lifts the content above the
 * keyboard on iOS and keeps the footer button reachable. Replaces the bare
 * `<SafeAreaView style={styles.wrap} edges={['bottom']}>` wrapper.
 */
export function KeyboardAvoider({
  children,
  edges = ['bottom'],
  offset = 0,
}: {
  children: ReactNode;
  edges?: readonly Edge[];
  /** extra px above the keyboard (e.g. a fixed header height) */
  offset?: number;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={offset}
    >
      <SafeAreaView style={styles.flex} edges={edges}>
        {children}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: tokens.color.bg },
});
