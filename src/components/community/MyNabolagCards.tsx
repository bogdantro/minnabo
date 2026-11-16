import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { NabolagSummary } from '@/api/ApiClient';
import type { NoticeboardPost } from '@/domain/types';
import { safePush } from '@/lib/nav';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Icon, PressableScale } from '@/components/ui';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The page of one nabolag. It carries the nabolag's own kommune: after a move, the person's
 *  kommune is no longer the one the nabolag is in. */
export const nabolagHref = (n: { place: string; municipality: string }) =>
  `/nabolag?place=${encodeURIComponent(n.place)}&kommune=${encodeURIComponent(n.municipality)}`;

/**
 * One card per nabolag I am in, each opening that nabolag directly (Fellesskap and the top of the Nabolag
 * list). A lime ring disc like the base design, the name big, how many are in it, and «N nye» when there
 * are new oppslag this week.
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
            <View style={styles.band} />
            <View style={styles.ring}>
              <View style={styles.icon}>
                <Icon name="home" size={22} color={colors.limeDeep} />
              </View>
              <View style={styles.check}>
                <Icon name="check" size={11} color={colors.ink} />
              </View>
            </View>
            <View style={styles.body}>
              <Text style={[text.eyebrow, styles.eyebrow]}>{nb.neighbourhood.yours}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {n.name}
              </Text>
              <View style={styles.metaRow}>
                <Icon name="users" size={13} color={colors.mute} />
                <Text style={text.meta} numberOfLines={1}>
                  {meta}
                </Text>
              </View>
            </View>
            {fresh > 0 ? (
              <View style={styles.fresh}>
                <View style={styles.freshDot} />
                <Text style={styles.freshText}>{nb.neighbourhood.freshBadge(fresh)}</Text>
              </View>
            ) : (
              <View style={styles.go}>
                <Icon name="right" size={18} color={colors.ink} />
              </View>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, paddingLeft: 20, borderRadius: radius.listingCard, backgroundColor: colors.white, overflow: 'hidden' },
  // a lime edge says «this one is mine»
  band: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: colors.lime },
  ring: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', right: -2, bottom: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.lime, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 3 },
  eyebrow: { fontSize: 10.5, color: colors.limeDeep },
  title: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23, letterSpacing: -0.35, color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fresh: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: colors.ink },
  freshDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime },
  freshText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.white },
  go: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
