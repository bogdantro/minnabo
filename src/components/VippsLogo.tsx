import { Image, type ImageStyle, type StyleProp } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@/theme/theme';

/** The smile from Vipps' round icon (assets/vipps….svg, viewBox 512). */
const SMILE =
  'M310.928712,209.438559 C330.502475,209.438559 347.277346,194.57842 347.277346,173.21928 L347.281611,173.21928 C347.281611,151.855022 330.502475,137 310.928712,137 C291.359214,137 274.588607,151.855022 274.588607,173.21928 C274.588607,194.57842 291.359214,209.438559 310.928712,209.438559 Z M358.458699,267.959419 C334.222485,299.530463 308.594644,321.358692 263.391619,321.358692 L263.397304,321.358692 C217.278847,321.358692 181.390772,293.494864 153.434548,252.631614 C142.24751,235.910759 125.006394,232.197856 112.423464,241.020975 C100.775866,249.382113 97.986925,267.028351 108.697768,282.356157 C147.37052,341.333312 200.954584,375.691876 263.391619,375.691876 C320.712751,375.691876 365.44811,347.833734 400.390901,301.392601 C413.434391,284.212608 412.969567,266.56637 400.390901,256.812183 C388.737618,247.515712 371.497923,250.780848 358.458699,267.959419 Z';

/**
 * Vipps' round icon. Default: orange circle, white smile. `onOrange`: white
 * circle with an orange smile, for use on the orange "Fortsett med Vipps" button.
 */
export function VippsIcon({ size = 28, onOrange = false }: { size?: number; onOrange?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={256} cy={256} r={256} fill={onOrange ? colors.white : colors.vipps} />
      <Path d={SMILE} fill={onOrange ? colors.vipps : colors.white} />
    </Svg>
  );
}

const WORDMARK = {
  /** orange word on a light background */
  pos: { source: require('../../assets/Vipps_rgb_orange_pos.svg.webp'), ratio: 2000 / 809 },
  /** white word on Vipps orange */
  neg: { source: require('../../assets/vipps-rgb-oransje-neg.webp'), ratio: 1920 / 777 },
} as const;

/** The Vipps wordmark at a given height. */
export function VippsWordmark({ height = 24, variant = 'pos', style }: { height?: number; variant?: 'pos' | 'neg'; style?: StyleProp<ImageStyle> }) {
  const w = WORDMARK[variant];
  return <Image source={w.source} accessibilityLabel="Vipps" resizeMode="contain" style={[{ height, width: height * w.ratio }, style]} />;
}
