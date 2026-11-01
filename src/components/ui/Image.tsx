import { Image as ExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';
import type { ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import { colors } from '@/theme/theme';

/** Fade-in for a photo that arrives from the network; instant when reduced motion is on. */
const FADE_MS = 180;

export type ImageProps = {
  /** `{ uri }` from Supabase storage, or a bundled `require(...)` asset. */
  source: ImageSourcePropType | { uri: string } | null | undefined;
  style?: StyleProp<ImageStyle>;
  /** Same names as React Native's Image, so screens didn't have to change. */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  accessibilityLabel?: string;
  /** Kept for React Native's Image API; expo-image never inverts colours. */
  accessibilityIgnoresInvertColors?: boolean;
  accessible?: boolean;
  testID?: string;
  /** Lists that re-use rows (FlatList) pass the row id so a re-used cell never flashes the old photo. */
  recyclingKey?: string;
};

const FIT: Record<NonNullable<ImageProps['resizeMode']>, ExpoImageProps['contentFit']> = {
  cover: 'cover',
  contain: 'contain',
  stretch: 'fill',
  center: 'none',
};

/**
 * Every photo in the app goes through this (expo-image): cached in memory and on disk, so a photo
 * seen once opens instantly the next time and works offline; a soft fade-in; and a calm flat
 * placeholder colour while it loads (no gradients). Bundled assets (logos) are shown as they are.
 */
export function Image({ source, style, resizeMode = 'cover', accessibilityLabel, accessible, testID, recyclingKey }: ImageProps) {
  const reduced = useReducedMotion();
  const remote = !!source && typeof source === 'object' && 'uri' in source && !!source.uri;
  return (
    <ExpoImage
      source={source as ExpoImageProps['source']}
      style={[remote ? { backgroundColor: colors.neutralPill } : null, style]}
      contentFit={FIT[resizeMode]}
      transition={remote && !reduced ? FADE_MS : 0}
      cachePolicy="memory-disk"
      recyclingKey={recyclingKey}
      accessibilityLabel={accessibilityLabel}
      accessible={accessible ?? !!accessibilityLabel}
      testID={testID}
    />
  );
}
