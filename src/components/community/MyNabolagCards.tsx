import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { NabolagSummary } from '@/api/ApiClient';
import type { NoticeboardPost } from '@/domain/types';
import { safePush } from '@/lib/nav';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Icon, PressableScale } from '@/components/ui';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The page of one nabolag. It carries the nabolag's own kommune: after a move, the person's
 *  kommune is no longer the one the nabolag is in. */
export const nabolagHref = (n: { place: string; municipality: string }) =>
  `/nabolag?place=${encodeURIComponent(n.place)}&kommune=${encodeURIComponent(n.municipality)}`;

/**
 * One card per nabolag I am in, each opening that nabolag directly. Used on Fellesskap and at the
 * top of the Nabolag list, so the nabolag you chose is always one tap away.
 */
export function MyNabolagCards({ nabolag, posts, now }: { nabolag: NabolagSummary[]; posts: NoticeboardPost[]; now: number }) {
  return (
    <View style={styles.list}>
      {nabolag.map((n) => {
        const fresh = posts.filter((p) => p.neighbourhoodId === n.id && now - Date.parse(p.createdAt) < WEEK_MS).length;
        const meta = nb.neighbourhood.cardMeta(n.memberCount, fresh);
        return (
          <PressableScale
            key={n.id}
            accessibilityRole="link"
            accessibilityLabel={`${n.name}. ${meta}`}
            onPress={() => safePush(nabolagHref(n))}
            scaleTo={0.985}
            style={[styles.card, shadow.card]}
          >
            <View style={styles.icon}>
              <Icon name="home" size={22} color={colors.limeDeep} />
            </View>
            <View style={styles.body}>
              <Text style={[text.eyebrow, styles.eyebrow]}>{nb.neighbourhood.yours}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {n.name}
              </Text>
              <Text style={text.meta}>{meta}</Text>
            </View>
            {fresh > 0 ? (
              <View style={styles.fresh}>
                <Text style={styles.freshText}>{fresh}</Text>
              </View>
            ) : null}
            <Icon name="right" size={20} color={colors.faint} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.card, backgroundColor: colors.white },
  icon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 4 },
  eyebrow: { fontSize: 11 },
  title: { fontFamily: text.h3.fontFamily, fontSize: 17, lineHeight: 20.4, letterSpacing: -0.34, color: colors.ink },
  fresh: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 7, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  freshText: { fontFamily: text.pillLg.fontFamily, fontSize: 13, color: colors.ink },
});
