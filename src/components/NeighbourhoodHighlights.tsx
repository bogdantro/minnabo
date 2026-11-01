import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNeighbourhoodHighlights, useProfile } from '@/api/queries';
import type { NeighbourhoodHighlight } from '@/api/ApiClient';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import nb from '@/i18n/nb';
import { safePush } from '@/lib/nav';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Avatar, FadeUp, Icon, TextLink } from './ui';

/**
 * «Mest hjelpsomme denne måneden» on a Nabolag page: up to three neighbours who chose to be
 * shown (0080). Nothing at all when nobody qualifies. Adults who aren't shown get one quiet
 * line saying where to turn it on.
 */
export function NeighbourhoodHighlights({ kommune, style }: { kommune: string; style?: object }) {
  const me = useCurrentUser();
  const { data } = useNeighbourhoodHighlights(kommune);
  const optedIn = !!useProfile(me.id).data?.highlightOptIn;
  if (!data?.length) return null;
  return (
    <FadeUp style={[styles.card, shadow.card, style]} testID="nabolag-highlights">
      <View style={styles.head}>
        <Icon name="award" size={18} color={colors.limeDeep} />
        <Text style={styles.eyebrow}>{nb.highlights.title}</Text>
      </View>
      {data.map((h, i) => (
        <Row key={h.profileId} h={h} rank={i + 1} />
      ))}
      {!optedIn && !me.isYouth && me.municipality === kommune ? (
        <TextLink label={nb.highlights.join} icon="right" onPress={() => safePush('/personvern')} style={styles.join} />
      ) : null}
    </FadeUp>
  );
}

function Row({ h, rank }: { h: NeighbourhoodHighlight; rank: number }) {
  const { data: p } = useProfile(h.profileId);
  const name = p?.displayName ?? '';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={nb.highlights.rowA11y(rank, name, h.jobs)}
      onPress={() => safePush(`/profil/${h.profileId}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.rank}>{rank}</Text>
      <Avatar initials={p?.initials ?? '·'} uri={p?.avatarUrl} seed={h.profileId} size={40} ring={false} />
      <Text style={[text.label, styles.name]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.jobs}>{nb.highlights.jobs(h.jobs)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.card, padding: 16, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  eyebrow: { ...text.eyebrow, color: colors.limeDeep },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  pressed: { opacity: 0.7 },
  rank: { ...text.num, width: 18, fontSize: 16, color: colors.mute, textAlign: 'center' },
  name: { flex: 1, minWidth: 0, fontSize: 15 },
  jobs: { ...text.metaBold, color: colors.okText },
  join: { alignSelf: 'flex-start', marginTop: 4 },
});
