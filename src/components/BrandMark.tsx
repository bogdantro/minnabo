import { View, Image, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import { AppText } from './ui/Text';

const logoIcon = require('../../assets/logo-icon.png');

export function BrandMark({
  size = 28,
  showWordmark = true,
}: {
  size?: number;
  showWordmark?: boolean;
}) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="MinNabo">
      <Image source={logoIcon} style={{ width: size, height: size }} resizeMode="contain" />
      {showWordmark ? (
        <AppText variant="section" weight="extrabold">
          MinNabo
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
});
