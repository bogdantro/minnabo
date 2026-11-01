import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMyAgreements } from '@/api/queries';
import type { AgendaItem } from '@/domain/types';
import nb from '@/i18n/nb';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { colors, radius, text } from '@/theme/theme';
import { FadeUp, Icon, TextLink } from './ui';

const KEY = (proposalId: string) => `minnabo.safetyTip.hidden.${proposalId}`;

/** True when no earlier avtale with this person has been finished – the first job together. */
export function firstJobWith(items: AgendaItem[] | undefined, counterpartId: string, proposalId: string): boolean {
  return !(items ?? []).some((a) => a.counterpartId === counterpartId && a.proposalId !== proposalId && a.fullyCompleted && !a.cancelled);
}

/** The same avtale always shows the same tip (no flicker between visits): a tiny hash of its id. */
export function tipFor(proposalId: string, iAmHelper: boolean): string {
  const tips = iAmHelper ? nb.safetyTip.helper : nb.safetyTip.client;
  let h = 0;
  for (const ch of proposalId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return tips[h % tips.length];
}

/**
 * «Første gang med Ola?» – one short safety tip on the avtale before the first job with
 * someone new. Hidden for good on this avtale with the X.
 */
export function SafetyTip({ proposalId, counterpartId, first, iAmHelper }: { proposalId: string; counterpartId: string; first: string; iAmHelper: boolean }) {
  const { data } = useMyAgreements();
  // unknown until storage has answered, so a hidden tip never flashes on screen
  const [hidden, setHidden] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY(proposalId))
      .then((v) => alive && setHidden(v === '1'))
      .catch(() => alive && setHidden(false));
    return () => {
      alive = false;
    };
  }, [proposalId]);

  if (hidden !== false || !data || !firstJobWith(data, counterpartId, proposalId)) return null;

  const hide = () => {
    haptics.light();
    setHidden(true);
    AsyncStorage.setItem(KEY(proposalId), '1').catch(() => undefined);
  };

  return (
    <FadeUp style={styles.card} testID="safety-tip">
      <View style={styles.ic}>
        <Icon name="shield" size={20} color={colors.cyanDeep} />
      </View>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>{nb.safetyTip.eyebrow}</Text>
        <Text style={[text.label, styles.title]}>{nb.safetyTip.title(first)}</Text>
        <Text style={[text.body, styles.tip]}>{tipFor(proposalId, iAmHelper)}</Text>
        <TextLink label={nb.safetyTip.trusted} icon="right" onPress={() => safePush('/trygge-kontakter')} style={styles.link} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={nb.safetyTip.hide} onPress={hide} hitSlop={12} style={styles.close}>
        <Icon name="x" size={16} color={colors.mute} />
      </Pressable>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: radius.card, backgroundColor: colors.cyanTint },
  ic: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  body: { flex: 1, minWidth: 0, gap: 3 },
  eyebrow: { ...text.eyebrow, color: colors.cyanDeep },
  title: { fontSize: 15.5 },
  tip: { fontSize: 14.5, lineHeight: 20, color: colors.ink2 },
  link: { alignSelf: 'flex-start', marginTop: 4 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: -4, marginRight: -4 },
});
