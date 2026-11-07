import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { kommuneCentre } from '@/data/kommuner';
import { project, TILE, tileUrl } from '@/domain/mapClusters';
import { colors } from '@/theme/theme';
import { Image } from '@/components/ui/Image';

/** Far enough out to show a whole town, close enough to recognise it. */
const ZOOM = 11;
const CIRCLE = 124;

/**
 * A real map of the kommune with the approximate area as a soft circle. It is always centred on the
 * kommune, never on the post: the map says «around here», and can't hint at an address (rule 6).
 * `breathing` is the slow pulse from the Legg ut wizard. The label goes in `children`.
 */
export function AreaMap({ municipality, height, breathing = false, children }: { municipality?: string; height: number; breathing?: boolean; children?: ReactNode }) {
  const [width, setWidth] = useState(0);
  const centre = municipality ? kommuneCentre(municipality) : null;
  const at = centre ? project(centre[0], centre[1], ZOOM) : null;

  const tiles: { x: number; y: number }[] = [];
  if (at && width) {
    const left = at.x - width / 2;
    const top = at.y - height / 2;
    for (let y = Math.floor(top / TILE); y <= Math.floor((top + height) / TILE); y++) {
      for (let x = Math.floor(left / TILE); x <= Math.floor((left + width) / TILE); x++) tiles.push({ x, y });
    }
  }

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!breathing) return;
    pulse.set(withRepeat(withSequence(withTiming(1.07, { duration: 1600, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) })), -1));
    return () => cancelAnimation(pulse);
  }, [breathing, pulse]);
  const zone = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));

  return (
    <View style={[styles.map, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} testID="area-map">
      {at
        ? tiles.map((t) => (
            <Image
              key={`${t.x}/${t.y}`}
              source={{ uri: tileUrl(ZOOM, t.x, t.y) }}
              style={[styles.tile, { left: t.x * TILE - (at.x - width / 2), top: t.y * TILE - (at.y - height / 2) }]}
            />
          ))
        : null}
      <Animated.View style={[styles.circle, { top: height / 2 - CIRCLE / 2 }, zone]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { overflow: 'hidden', borderRadius: 22, backgroundColor: colors.mapBg },
  tile: { position: 'absolute', width: TILE + 0.5, height: TILE + 0.5 },
  circle: {
    position: 'absolute',
    alignSelf: 'center',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.ink,
    backgroundColor: colors.mapZone,
  },
});
