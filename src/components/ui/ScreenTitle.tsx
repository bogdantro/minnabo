import type { ViewStyle } from 'react-native';
import { AppText } from './Text';

/**
 * The one screen-title style, shared by every tab's first heading
 * (Oppdrag "Hva trenger du hjelp med?", Innboks "Innboks", Fellesskap, …).
 */
export function ScreenTitle({ children, style }: { children: string; style?: ViewStyle }) {
  return (
    <AppText variant="question" weight="bold" accessibilityRole="header" style={style}>
      {children}
    </AppText>
  );
}
