import { View, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { tokens } from '@/theme';
import { AppText } from './Text';

/** A titled group of fields inside a wizard step ("1. Hvordan vil du sette pris?"). */
export function FieldGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <AppText variant="cardTitle" weight="bold">
        {title}
      </AppText>
      <View style={styles.body}>{children}</View>
      {hint ? (
        <AppText variant="meta" color="navyMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: tokens.space.sm },
  body: { gap: tokens.space.sm, marginTop: 2 },
});
