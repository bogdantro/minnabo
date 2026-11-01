import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import nb from '@/i18n/nb';
import { categoryLabel } from '@/domain/categories';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { colors, shadow, text } from '@/theme/theme';
import { wizardDraft, type WizardState } from '@/screens/LeggUt/wizardModel';
import { Button, CategoryArt, FadeUp } from './ui';

/** Steps in the oppdrag wizard (LeggUtWizard LAST). */
const STEPS = 8;

/**
 * «Du har et utkast» on Oppdrag: a half-written oppdrag is never forgotten. Read again every time
 * the screen comes into view (the wizard saves the draft by itself, see LeggUtWizard autosave).
 * `style` positions it; nothing at all is rendered when there is no draft (no empty gap).
 */
export function DraftCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const [draft, setDraft] = useState<{ state: WizardState; step: number } | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void wizardDraft.load().then((d) => {
        // a draft with nothing in it isn't worth a card
        if (alive) setDraft(d && (d.state.cat || d.state.title.trim()) ? d : null);
      });
      return () => {
        alive = false;
      };
    }, []),
  );
  if (!draft) return null;

  const { state, step } = draft;
  const title = state.title.trim() || (state.cat ? categoryLabel(state.cat) : nb.draft.untitled);
  const discard = () => {
    const kept = draft;
    void wizardDraft.clear();
    setDraft(null);
    haptics.light();
    toast.info(nb.draft.discarded, {
      icon: 'trash',
      action: {
        label: nb.draft.undo,
        onPress: () => {
          void wizardDraft.save(kept.state, kept.step);
          setDraft(kept);
        },
      },
    });
  };

  return (
    <View style={style}>
      <FadeUp style={[styles.card, shadow.card]} testID="draft-card">
        <View style={styles.top}>
          <CategoryArt category={state.cat ?? 'annet'} uri={state.photos[0]} width={48} height={48} radius={14} iconSize={22} />
          <View style={styles.body}>
            <Text style={styles.eyebrow}>{nb.draft.title}</Text>
            <Text style={[text.label, styles.name]} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.track} accessibilityLabel={nb.draft.progress(step, STEPS)}>
              <View style={[styles.fill, { width: `${Math.round((step / STEPS) * 100)}%` }]} />
            </View>
            <Text style={text.meta}>{nb.draft.progress(step, STEPS)}</Text>
          </View>
        </View>
        <View style={styles.btns}>
          <Button label={nb.draft.discard} variant="ghost" size="sm" block={false} onPress={discard} style={styles.btn} />
          <Button label={nb.draft.resume} iconRight="arrow" size="sm" block={false} onPress={() => safePush('/legg-ut')} style={styles.btn15} />
        </View>
      </FadeUp>
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
});
