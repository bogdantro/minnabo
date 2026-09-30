import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { categoryColors, type CategoryId } from '@/theme/theme';
import { Icon } from './Icon';

export type CategoryArtProps = {
  category: CategoryId;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  radius?: number;
  iconSize?: number;
  /** Real photo when available; the category tile is the fallback. */
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
};

/** `.art` – flat category tile with a centred Lucide icon (stand-in for photos). */
export function CategoryArt({ category, width, height, radius = 0, iconSize = 34, uri, style }: CategoryArtProps) {
  const c = categoryColors[category] ?? categoryColors.annet;
  return (
    <View
      style={[styles.base, { backgroundColor: c.bg, width, height, borderRadius: radius }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <Icon name={category in categoryColors ? category : 'annet'} size={iconSize} color={c.fg} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
