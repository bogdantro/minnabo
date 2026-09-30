import { Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { tokens, type ColorToken } from '@/theme';
import { colors } from '@/theme/theme';
import { iconComponents, type IconKey } from './iconMap';

type FeatherName = keyof typeof Feather.glyphMap;

/**
 * Redesign icons are the keys of `theme.icons` (Lucide). Plain Feather names
 * are still accepted so screens that have not been re-skinned keep working.
 */
export type IconName = IconKey | FeatherName;
export type { IconKey };

export type IconProps = {
  name: IconName;
  size?: number;
  /** A colour value (use `colors.*` from the theme). Legacy token names still resolve. */
  color?: ColorToken | (string & {});
  /** Fill the shape with the icon colour (filled heart / star / badge). */
  filled?: boolean;
  strokeWidth?: number;
};

/** Glyphs the design draws solid (mn.css uses fill for these). */
const FILLED: ReadonlySet<string> = new Set(['star', 'play', 'pause', 'sparkle']);

/** The design's i-verified glyph: solid badge with a white tick (not expressible with a stroked Lucide icon). */
export function VerifiedIcon({ size = 16, color = colors.verified }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
      />
      <Path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke={colors.white} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function resolveColor(color: string): string {
  return color in tokens.color ? tokens.color[color as ColorToken] : color;
}

export function Icon({ name, size = 20, color = colors.ink, filled, strokeWidth = 2 }: IconProps) {
  const c = resolveColor(color);
  if (name === 'verified') return <VerifiedIcon size={size} color={c} />;
  const Lucide = iconComponents[name as IconKey];
  if (Lucide) {
    return (
      <Lucide
        size={size}
        color={c}
        strokeWidth={strokeWidth}
        fill={(filled ?? FILLED.has(name)) ? c : 'none'}
        absoluteStrokeWidth={false}
      />
    );
  }
  return <Feather name={name as FeatherName} size={size} color={c} />;
}
