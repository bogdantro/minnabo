import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { tokens, type ColorToken } from '@/theme';

type Props = { size?: number; color?: ColorToken };

/** Clipboard + person + form lines — "Jeg trenger hjelp" (steg/leggutside). */
export function NeedHelpIcon({ size = 64, color = 'lime' }: Props) {
  const c = tokens.color[color];
  const s = 3;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Rect x="12" y="10" width="40" height="46" rx="6" stroke={c} strokeWidth={s} />
      <Rect x="24" y="5" width="16" height="9" rx="3" stroke={c} strokeWidth={s} />
      <Circle cx="32" cy="27" r="6" stroke={c} strokeWidth={s} />
      <Path d="M22 42c0-6 4.5-9 10-9s10 3 10 9" stroke={c} strokeWidth={s} strokeLinecap="round" />
      <Line x1="21" y1="49" x2="43" y2="49" stroke={c} strokeWidth={s} strokeLinecap="round" />
    </Svg>
  );
}

/** Worker with cap holding a wrench — "Jeg tilbyr hjelp". */
export function OfferHelpIcon({ size = 64, color = 'cyan' }: Props) {
  const c = tokens.color[color];
  const s = 3;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* head */}
      <Circle cx="25" cy="24" r="7" stroke={c} strokeWidth={s} />
      {/* cap dome + brim */}
      <Path d="M16 22c0-9 6.5-13 12-11" stroke={c} strokeWidth={s} strokeLinecap="round" />
      <Path d="M27 12c6 0 9 4 9 9" stroke={c} strokeWidth={s} strokeLinecap="round" />
      <Line x1="34" y1="21" x2="45" y2="18" stroke={c} strokeWidth={s} strokeLinecap="round" />
      {/* torso / shoulders */}
      <Path d="M11 54c0-13 6-19 14-19 6 0 10 3 12 8" stroke={c} strokeWidth={s} strokeLinecap="round" />
      {/* arm to wrench */}
      <Path d="M27 40c5 1 9 4 12 8" stroke={c} strokeWidth={s} strokeLinecap="round" />
      {/* wrench */}
      <Path
        d="M39 48l9-9m0 0a5 5 0 1 0-5-5l-3 3 5 5 3-3z"
        stroke={c}
        strokeWidth={s}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
