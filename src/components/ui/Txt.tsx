import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts, text } from '@/theme/theme';

export type TxtVariant = keyof typeof text;
export type TxtColor = keyof typeof colors;
export type TxtWeight = keyof typeof fonts;

export type TxtProps = TextProps & {
  /** Type style from `theme.text`. */
  variant?: TxtVariant;
  /** Colour key from `theme.colors` (overrides the variant's colour). */
  color?: TxtColor;
  /** Font key from `theme.fonts` (overrides the variant's family). */
  font?: TxtWeight;
  size?: number;
  align?: TextStyle['textAlign'];
};

/** Redesign text. Every style comes from `theme.text`; no raw values in screens. */
export function Txt({ variant = 'body', color, font, size, align, style, ...rest }: TxtProps) {
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        text[variant],
        color ? { color: colors[color] } : null,
        font ? { fontFamily: fonts[font] } : null,
        size ? { fontSize: size } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
