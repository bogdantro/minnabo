import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { tokens, type ColorToken } from '@/theme';

type Props = { size?: number; color?: ColorToken };

/** Clipboard + person + form lines — "Jeg trenger hjelp" (legg-ut intro). */
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
