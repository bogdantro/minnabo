import { Feather } from '@expo/vector-icons';
import { tokens, type ColorToken } from '@/theme';

export type IconName = keyof typeof Feather.glyphMap;

export type IconProps = {
  name: IconName;
  size?: number;
  color?: ColorToken;
};

export function Icon({ name, size = 22, color = 'navy' }: IconProps) {
  return <Feather name={name} size={size} color={tokens.color[color]} />;
}
