import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from '@/theme';

/**
 * Wraps a horizontal scroller and paints a soft fade on the right edge so it
 * reads as scrollable.
 */
export function HScrollFade({
  children,
  color = tokens.color.bg,
  width = 36,
}: {
  children: ReactNode;
  color?: string;
  width?: number;
}) {
  return (
    <View style={styles.wrap}>
      {children}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(253,251,250,0)', color]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.fade, { width }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  fade: { position: 'absolute', right: 0, top: 0, bottom: 0 },
});
