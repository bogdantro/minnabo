import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { tokens, type ColorToken, type TextVariant, type FontWeight } from '@/theme';

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: ColorToken;
  weight?: FontWeight;
  align?: TextStyle['textAlign'];
};

export function AppText({
  variant = 'body',
  color = 'navy',
  weight,
  align,
  style,
  ...rest
}: AppTextProps) {
  const base = tokens.text[variant];
  const fontFamily = weight ? tokens.font[weight] : base.fontFamily;

  return (
    <RNText
      {...rest}
      style={[
        {
          fontSize: base.fontSize,
          lineHeight: base.lineHeight,
          fontFamily,
          color: tokens.color[color],
          textAlign: align,
        },
        style,
      ]}
    />
  );
}
