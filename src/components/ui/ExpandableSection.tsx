import { useState, type ReactNode } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { tokens, hitSlop } from '@/theme';
import { AppText } from './Text';
import { Icon } from './Icon';

/**
 * A collapsed-by-default disclosure for secondary/optional fields, so a long
 * form can front-load only what's required and let the rest be opt-in
 * (e.g. "Flere detaljer" in the legg-ut wizard).
 */
export function ExpandableSection({
  title,
  hint,
  defaultExpanded = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        hitSlop={hitSlop}
        onPress={() => setExpanded((e) => !e)}
        style={styles.header}
      >
        <View style={styles.headerText}>
          <AppText variant="cardTitle" weight="bold">
            {title}
          </AppText>
          {hint ? (
            <AppText variant="meta" color="navyMuted">
              {hint}
            </AppText>
          ) : null}
        </View>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="navyMuted" />
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: tokens.color.line,
    borderRadius: tokens.radius.card,
    padding: tokens.space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.md,
  },
  headerText: { flex: 1, gap: 2 },
  body: { gap: tokens.space.lg, marginTop: tokens.space.lg },
});
