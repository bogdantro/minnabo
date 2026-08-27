import { View, StyleSheet, type ViewStyle } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './Text';

export type SectionHeaderProps = {
  title: string;
  style?: ViewStyle;
};

export function SectionHeader({ title, style }: SectionHeaderProps) {
  return (
    <View style={[styles.wrap, style]}>
      <AppText variant="section" weight="bold" accessibilityRole="header">
        {title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: tokens.space.md,
  },
});
