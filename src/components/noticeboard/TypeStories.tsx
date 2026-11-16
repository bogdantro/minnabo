import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { haptics } from '@/lib/haptics';
import { colors, fonts } from '@/theme/theme';
import { NOTICE_STYLE, NOTICE_TYPES, type NoticeType } from '@/components/community/noticeKinds';
import { Icon, type IconName } from '@/components/ui';

export type NoticeFilter = NoticeType | 'ALL';

const RING = 68;
const DISC = 58;

/**
 * The kinds of oppslag as a row of circles, like stories (asked 2026-11-10): the base design's ring-framed
 * discs. A cyan ring means there is something to see, the chosen one gets a thick lime ring, and the number
 * sits in a small badge. Still a plain filter underneath, read out as «Gis bort, 2».
 */
export function TypeStories({ value, counts, onChange }: { value: NoticeFilter; counts: Record<NoticeFilter, number>; onChange: (f: NoticeFilter) => void }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={nb.noticeboard.kindLabel}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {(['ALL', ...NOTICE_TYPES] as NoticeFilter[]).map((k) => {
          const on = value === k;
          const st: { icon: IconName; bg: string; fg: string } = k === 'ALL' ? { icon: 'pinned', bg: colors.limeTint, fg: colors.limeDeep } : NOTICE_STYLE[k];
          const label = k === 'ALL' ? nb.noticeboard.all : nb.noticeboard.kinds[k];
          // a short word under the circle; the full name is read out
          const short = k === 'ALL' ? nb.noticeboard.all : nb.noticeboard.kindsShort[k];
          const n = counts[k] ?? 0;
          return (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label}, ${n}`}
              onPress={() => {
                haptics.select();
                onChange(k);
              }}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <View style={[styles.ring, n ? styles.ringHas : styles.ringNone, on && styles.ringOn]}>
                <View style={[styles.disc, { backgroundColor: st.bg }]}>
                  <Icon name={st.icon} size={24} color={st.fg} />
                </View>
                {n ? (
                  <View style={[styles.badge, on && styles.badgeOn]}>
                    <Text style={[styles.badgeText, on && styles.badgeTextOn]}>{n}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                {short}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 6 },
  item: { width: 76, alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.75 },
  ring: { width: RING, height: RING, borderRadius: RING / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  ringHas: { borderWidth: 2, borderColor: colors.cyan },
  ringNone: { borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed' },
  ringOn: { borderWidth: 3, borderColor: colors.lime, borderStyle: 'solid' },
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOn: { backgroundColor: colors.ink },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.ink },
  badgeTextOn: { color: colors.white },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.ink2, maxWidth: 76 },
  labelOn: { fontFamily: fonts.bodyBold, color: colors.ink },
});
