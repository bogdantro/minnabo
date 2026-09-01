import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { tokens } from '@/theme';
import nb from '@/i18n/nb';
import { groupThousands } from '@/domain/price';
import { useJobWorkspace, useUpdateJobWorkspace } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';
import { Button } from './ui/Button';
import { TextField } from './ui/TextField';

function fmtDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function JobWorkspaceSection({ proposalId }: { proposalId: string }) {
  const { data: ws } = useJobWorkspace(proposalId);
  const update = useUpdateJobWorkspace(proposalId);
  const [newItem, setNewItem] = useState('');
  const [matLabel, setMatLabel] = useState('');
  const [matKr, setMatKr] = useState('');
  const [, tick] = useState(0);

  const running = ws?.timerStartedAt != null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!ws) return null;

  const trackedMs = ws.timerAccumMs + (ws.timerStartedAt != null ? Date.now() - ws.timerStartedAt : 0);
  const materialsTotal = ws.materials.reduce((sum, m) => sum + m.amountKr, 0);

  return (
    <View style={styles.wrap}>
      <AppText variant="cardTitle" weight="bold">
        {nb.jobWorkspace.title}
      </AppText>

      {/* Time tracker */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <AppText variant="meta" weight="bold" color="navyMuted">
            {nb.jobWorkspace.timer}
          </AppText>
          <AppText variant="cardTitle" weight="bold">
            {fmtDuration(trackedMs)}
          </AppText>
        </View>
        <Button
          label={running ? nb.jobWorkspace.stop : nb.jobWorkspace.start}
          variant={running ? 'secondary' : 'primary'}
          iconLeft={running ? 'pause' : 'play'}
          onPress={() => {
            haptics.light();
            update.mutate({ kind: 'toggleTimer' });
          }}
        />
      </View>

      {/* Checklist */}
      <View style={styles.card}>
        <AppText variant="meta" weight="bold" color="navyMuted">
          {nb.jobWorkspace.checklist}
        </AppText>
        {ws.checklist.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: c.done }}
            accessibilityLabel={c.text}
            onPress={() => update.mutate({ kind: 'toggleChecklist', itemId: c.id })}
            onLongPress={() => update.mutate({ kind: 'removeChecklist', itemId: c.id })}
            style={styles.checkRow}
          >
            <Icon name={c.done ? 'check-square' : 'square'} size={18} color={c.done ? 'lime' : 'navyMuted'} />
            <AppText variant="body" style={[styles.checkText, c.done && styles.checkDone]}>
              {c.text}
            </AppText>
          </Pressable>
        ))}
        <View style={styles.addRow}>
          <View style={styles.grow}>
            <TextField
              label={nb.jobWorkspace.addItem}
              hideLabel
              placeholder={nb.jobWorkspace.addItem}
              value={newItem}
              onChangeText={setNewItem}
            />
          </View>
          <Button
            label={nb.jobWorkspace.add}
            variant="secondary"
            onPress={() => {
              if (!newItem.trim()) return;
              update.mutate({ kind: 'addChecklist', text: newItem });
              setNewItem('');
            }}
          />
        </View>
      </View>

      {/* Materials log */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <AppText variant="meta" weight="bold" color="navyMuted">
            {nb.jobWorkspace.materials}
          </AppText>
          {materialsTotal > 0 ? (
            <AppText variant="meta" weight="bold">
              {groupThousands(materialsTotal)} kr
            </AppText>
          ) : null}
        </View>
        <AppText variant="meta" color="navyMuted">
          {nb.jobWorkspace.materialsNote}
        </AppText>
        {ws.materials.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={`${m.label} ${m.amountKr}`}
            onLongPress={() => update.mutate({ kind: 'removeMaterial', itemId: m.id })}
            style={styles.rowBetween}
          >
            <AppText variant="body">{m.label}</AppText>
            <AppText variant="body" weight="bold">
              {groupThousands(m.amountKr)} kr
            </AppText>
          </Pressable>
        ))}
        <View style={styles.addRow}>
          <View style={styles.grow}>
            <TextField
              label={nb.jobWorkspace.materialLabel}
              hideLabel
              placeholder={nb.jobWorkspace.materialLabel}
              value={matLabel}
              onChangeText={setMatLabel}
            />
          </View>
          <View style={styles.matKr}>
            <TextField
              label="kr"
              hideLabel
              placeholder="kr"
              keyboardType="numeric"
              value={matKr}
              onChangeText={setMatKr}
            />
          </View>
          <Button
            label={nb.jobWorkspace.add}
            variant="secondary"
            onPress={() => {
              const kr = Number(matKr.replace(/\s/g, ''));
              if (!matLabel.trim() || !kr) return;
              update.mutate({ kind: 'addMaterial', label: matLabel, amountKr: kr });
              setMatLabel('');
              setMatKr('');
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.sm },
  card: {
    gap: tokens.space.sm,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.color.line,
    padding: tokens.space.md,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm, paddingVertical: 4 },
  checkText: { flex: 1 },
  checkDone: { textDecorationLine: 'line-through', color: tokens.color.navyMuted },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: tokens.space.sm },
  grow: { flex: 1 },
  matKr: { width: 72 },
});
