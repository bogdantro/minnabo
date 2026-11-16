import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import nb from '@/i18n/nb';
import { categoryLabel } from '@/domain/categories';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, radius, shadow, text } from '@/theme/theme';
import { draftHasContent, wizardDraft, type SavedDraft } from '@/screens/LeggUt/wizardModel';
import { Button, CategoryArt, FadeUp, Icon } from './ui';

/** Steps in the oppdrag wizard (LeggUtWizard LAST). */
const STEPS = 8;

const draftTitle = (d: SavedDraft) => d.state.title.trim() || (d.state.cat ? categoryLabel(d.state.cat) : nb.draft.untitled);

/**
 * «Du har et utkast» on Oppdrag: a half-written oppdrag is never forgotten, and since 2026-11-09 there can be
 * several. The newest is the big card, the others are rows under it. Read again every time the screen comes into
 * view (the wizard saves by itself, see LeggUtWizard autosave). Nothing at all is rendered without a draft.
 */
export function DraftCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void wizardDraft.list().then((all) => {
        // a draft with nothing in it isn't worth a card
        if (alive) setDrafts(all.filter(draftHasContent));
      });
      return () => {
        alive = false;
      };
    }, []),
  );
  if (!drafts.length) return null;

  const [first, ...rest] = drafts;
  const discard = (d: SavedDraft) => {
    void wizardDraft.clear(d.id);
    setDrafts((list) => list.filter((x) => x.id !== d.id));
    haptics.light();
    toast.info(nb.draft.discarded, {
      icon: 'trash',
      action: {
        label: nb.draft.undo,
        onPress: () => {
          void wizardDraft.save(d.state, d.step, d.id);
          setDrafts((list) => [d, ...list.filter((x) => x.id !== d.id)].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
        },
      },
    });
  };
  const resume = (d: SavedDraft) => safePush(`/legg-ut?utkast=${d.id}`);

  return (
    <View style={style}>
      <FadeUp style={[styles.card, shadow.card]} testID="draft-card">
        <View style={styles.top}>
          <CategoryArt category={first.state.cat ?? 'annet'} uri={first.state.photos[0]} width={48} height={48} radius={14} iconSize={22} />
          <View style={styles.body}>
            <Text style={styles.eyebrow}>{drafts.length > 1 ? nb.draft.titleMany(drafts.length) : nb.draft.title}</Text>
            <Text style={[text.label, styles.name]} numberOfLines={1}>
              {draftTitle(first)}
            </Text>
            <View style={styles.track} accessibilityLabel={nb.draft.progress(first.step, STEPS)}>
              <View style={[styles.fill, { width: `${Math.round((first.step / STEPS) * 100)}%` }]} />
            </View>
            <Text style={text.meta}>{nb.draft.progress(first.step, STEPS)}</Text>
          </View>
        </View>
        <View style={styles.btns}>
          <Button label={nb.draft.discard} variant="ghost" size="sm" block={false} onPress={() => discard(first)} style={styles.btn} />
          <Button label={nb.draft.resume} iconRight="arrow" size="sm" block={false} onPress={() => resume(first)} style={styles.btn15} />
        </View>
        {rest.length ? (
          <View style={styles.more}>
            {rest.map((d) => (
              <DraftRow key={d.id} draft={d} onPress={() => resume(d)} onDiscard={() => discard(d)} />
            ))}
          </View>
        ) : null}
      </FadeUp>
    </View>
  );
}

/** One more draft: a row to open it, with «Forkast» on the side when there is room for it. */
export function DraftRow({ draft, onPress, onDiscard }: { draft: SavedDraft; onPress: () => void; onDiscard?: () => void }) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${nb.draft.resume}: ${draftTitle(draft)}, ${nb.draft.progress(draft.step, STEPS)}`}
        onPress={onPress}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
      >
        <CategoryArt category={draft.state.cat ?? 'annet'} uri={draft.state.photos[0]} width={36} height={36} radius={11} iconSize={17} />
        <View style={styles.body}>
          <Text style={[text.label, styles.rowName]} numberOfLines={1}>
            {draftTitle(draft)}
          </Text>
          <Text style={text.meta}>{nb.draft.progress(draft.step, STEPS)}</Text>
        </View>
        <Icon name="right" size={18} color={colors.faint} />
      </Pressable>
      {onDiscard ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${nb.draft.discard}: ${draftTitle(draft)}`} onPress={onDiscard} hitSlop={6} style={styles.rowX}>
          <Icon name="x" size={16} color={colors.mute} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, backgroundColor: colors.white, padding: 14, gap: 12, borderWidth: 1.5, borderColor: colors.limeTint },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { flex: 1, minWidth: 0, gap: 4 },
  eyebrow: { ...text.eyebrow, fontSize: 10.5, color: colors.limeDeep },
  name: { fontSize: 15.5 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden', marginTop: 2 },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.lime },
  btns: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1 },
  btn15: { flex: 1.5 },
  more: { borderTopWidth: 1, borderTopColor: colors.line2, paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowMain: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderRadius: radius.m },
  rowName: { fontSize: 14 },
  rowX: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
});
