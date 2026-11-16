import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import nb from '@/i18n/nb';
import { useJobWorkspace } from '@/api/queries';
import { BeforeAfter } from '@/components/BeforeAfter';
import { safePush } from '@/lib/nav';
import { colors, radius, shadow, text } from '@/theme/theme';
import { FadeUp, TextLink } from '@/components/ui';

/**
 * «Før og etter» (0101): the first before photo and the last after photo from Jobbdag, side by side
 * with a slider. Shown to both people in the avtale; nothing when there isn't one of each.
 */
export function BeforeAfterCard({ proposalId, showJobbdagLink = true, style }: { proposalId: string; showJobbdagLink?: boolean; style?: StyleProp<ViewStyle> }) {
  const { data: ws } = useJobWorkspace(proposalId);
  const before = ws?.photos.find((p) => p.phase === 'BEFORE');
  const after = [...(ws?.photos ?? [])].reverse().find((p) => p.phase === 'AFTER');
  if (!before || !after) return null;
  return (
    <FadeUp style={style}>
      <View style={[styles.card, shadow.card]}>
        <View style={styles.head}>
          <Text style={text.label}>{nb.beforeAfter.title}</Text>
          <Text style={text.meta}>{nb.beforeAfter.sub}</Text>
        </View>
        <BeforeAfter before={before.url} after={after.url} accessibilityLabel={nb.jobWorkspace.compareA11y(1)} />
        {showJobbdagLink ? <TextLink label={nb.beforeAfter.allPhotos} icon="right" onPress={() => safePush(`/jobbdag/${proposalId}`)} /> : null}
      </View>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.card, padding: 16, gap: 12 },
  head: { gap: 2 },
});
