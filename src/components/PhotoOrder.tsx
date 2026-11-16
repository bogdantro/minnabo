import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import nb from '@/i18n/nb';
import { haptics } from '@/lib/haptics';
import { Button } from '@/components/ui';

/** Moves one photo; the first photo is the cover. ['a','b','c'], 2, 0 -> ['c','a','b']. */
export function movePhoto(photos: string[], from: number, to: number): string[] {
  if (from < 0 || from >= photos.length || to < 0 || to >= photos.length || from === to) return photos;
  const next = [...photos];
  const [p] = next.splice(from, 1);
  next.splice(to, 0, p);
  return next;
}

/**
 * Under the photo grid in Legg ut, while a photo is selected: make it the cover, or move it one step.
 * `onChange` gets the new order and the selected photo's new place.
 */
export function PhotoOrderControls({
  photos,
  selected,
  onChange,
}: {
  photos: string[];
  selected: number;
  onChange: (photos: string[], selected: number | null) => void;
}) {
  if (selected < 0 || selected >= photos.length || photos.length < 2) return null;
  const move = (to: number, keepSelected = true) => {
    haptics.light();
    onChange(movePhoto(photos, selected, to), keepSelected ? to : null);
  };
  return (
    <Animated.View entering={FadeInDown.duration(180)} style={styles.row} testID="photo-order">
      {selected > 0 ? <Button label={nb.photoOrder.makeCover} icon="star" variant="ink" size="sm" block={false} onPress={() => move(0, false)} /> : null}
      <View style={styles.arrows}>
        <Button label={nb.photoOrder.left} icon="left" variant="ghost" size="sm" block={false} disabled={selected === 0} accessibilityLabel={nb.photoOrder.leftA11y} onPress={() => move(selected - 1)} />
        <Button label={nb.photoOrder.right} iconRight="right" variant="ghost" size="sm" block={false} disabled={selected === photos.length - 1} accessibilityLabel={nb.photoOrder.rightA11y} onPress={() => move(selected + 1)} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 },
  arrows: { flexDirection: 'row', gap: 8 },
});
