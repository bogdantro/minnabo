import { useState } from 'react';
import {
  View,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import type { ListingImage } from '@/domain/types';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { StatusPill } from './ui/StatusPill';

export type GalleryProps = {
  images: ListingImage[];
  saved?: boolean;
  onToggleSave?: () => void;
  height?: number;
  rounded?: boolean;
  badge?: string;
};

export function Gallery({
  images,
  saved = false,
  onToggleSave,
  height = 240,
  rounded = false,
  badge,
}: GalleryProps) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const pageWidth = width - tokens.space.xl * 2;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (next !== index) setIndex(next);
  };

  return (
    <View style={[styles.wrap, { height }, rounded && styles.rounded]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEnabled={images.length > 1}
      >
        {images.map((img) => (
          <Image
            key={img.id}
            source={{ uri: img.url }}
            style={{ width: pageWidth, height }}
            resizeMode="cover"
          />
        ))}
      </ScrollView>

      {badge ? (
        <View style={styles.badge}>
          <StatusPill label={badge} tone="cyan" filled />
        </View>
      ) : null}

      {images.length > 1 ? (
        <View style={styles.counter}>
          <AppText variant="meta" color="white" weight="bold">
            {index + 1}/{images.length}
          </AppText>
        </View>
      ) : null}

      {onToggleSave ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? nb.a11y.unsave : nb.a11y.save}
          onPress={onToggleSave}
          style={styles.heart}
        >
          <Icon name="heart" size={20} color={saved ? 'lime' : 'navy'} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: tokens.radius.card,
    overflow: 'hidden',
    backgroundColor: tokens.color.line,
  },
  rounded: { borderRadius: tokens.radius.card },
  badge: {
    position: 'absolute',
    left: tokens.space.md,
    top: tokens.space.md,
  },
  counter: {
    position: 'absolute',
    left: tokens.space.md,
    bottom: tokens.space.md,
    backgroundColor: tokens.color.overlay,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 4,
  },
  heart: {
    position: 'absolute',
    right: tokens.space.md,
    bottom: tokens.space.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.card,
  },
});
