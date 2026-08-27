import { useState } from 'react';
import { View, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { PageHeader } from '@/components/TopBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { AppText } from '@/components/ui/Text';

const ROWS = [
  { key: 'messages', label: 'Nye meldinger' },
  { key: 'offers', label: 'Nye og endrede tilbud' },
  { key: 'accepted', label: 'Tilbud godtatt eller avslått' },
  { key: 'agreed', label: 'Avtalt tidspunkt' },
  { key: 'completion', label: 'Ferdigmelding' },
  { key: 'reviews', label: 'Vurderinger' },
] as const;

export function NotificationPrefsScreen() {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(ROWS.map((r) => [r.key, true])),
  );
  const [channel, setChannel] = useState({ push: true, email: false });

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']}>
      <PageHeader title={nb.notifications.title} />
      <View style={styles.content}>
        <ScreenTitle>{nb.notifications.title}</ScreenTitle>

        <View style={styles.card}>
          <ToggleRow
            label={nb.settings.pushNotifications}
            value={channel.push}
            onValueChange={(v) => setChannel((c) => ({ ...c, push: v }))}
          />
          <ToggleRow
            label={nb.settings.emailNotifications}
            value={channel.email}
            onValueChange={(v) => setChannel((c) => ({ ...c, email: v }))}
            last
          />
        </View>

        <AppText variant="meta" weight="bold" color="navyMuted" style={styles.groupTitle}>
          VARSLE MEG OM
        </AppText>
        <View style={styles.card}>
          {ROWS.map((row, i) => (
            <ToggleRow
              key={row.key}
              label={row.label}
              value={state[row.key]}
              onValueChange={(v) => setState((s) => ({ ...s, [row.key]: v }))}
              last={i === ROWS.length - 1}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
  last,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <AppText variant="body" style={styles.rowLabel}>
        {label}
      </AppText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: tokens.color.lime, false: tokens.color.line }}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: tokens.space.xl, gap: tokens.space.md },
  groupTitle: { letterSpacing: 0.6, marginTop: tokens.space.sm },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    ...tokens.shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    minHeight: 52,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: tokens.color.line },
  rowLabel: { flex: 1 },
});
