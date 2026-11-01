import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { heroTransition, useHeroFlight } from '@/lib/heroTransition';
import { Image } from './ui/Image';

/** Card → gallery flight time; long enough to follow, short enough not to wait for. */
const FLY_MS = 360;

/**
 * Mounted once at the app root: the photo flying from a tapped oppdrag card into the detail
 * gallery (lib/heroTransition). It sits above every screen and never takes touches.
 */
export function HeroOverlay() {
  const flight = useHeroFlight();
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const from = flight?.from;
  const to = flight?.to;

  useEffect(() => {
    if (!flight) return;
    if (reduced) {
      heroTransition.finish();
      return;
    }
    if (!to) {
      p.set(0);
      return;
    }
    p.set(withTiming(1, { duration: FLY_MS, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }, (done) => {
      if (done) runOnJS(heroTransition.finish)();
    }));
  }, [flight, to, reduced, p]);

  const box = useAnimatedStyle(() => {
    if (!from) return { opacity: 0 };
    const t = to ?? from;
    const mix = (a: number, b: number) => a + (b - a) * p.value;
    return {
      left: mix(from.x, t.x),
      top: mix(from.y, t.y),
      width: mix(from.width, t.width),
      height: mix(from.height, t.height),
      borderRadius: mix(from.radius, t.radius),
      opacity: 1,
    };
  }, [from, to]);

  if (!flight || reduced) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.fly, box]} testID="hero-overlay">
      <Image source={{ uri: flight.uri }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fly: { position: 'absolute', overflow: 'hidden', zIndex: 999, elevation: 999 },
});
