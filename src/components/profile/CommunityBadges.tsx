import { ScrollView, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { CommunityBadges as Badges } from '@/domain/community';
import { colors, fonts, radius } from '@/theme/theme';
import { Icon, type IconName } from '@/components/ui';

type Badge = { key: keyof Badges; icon: IconName; bg: string; fg: string; label: { one: string; many: (n: number) => string } };

const BADGES: Badge[] = [
  { key: 'lent', icon: 'montering', bg: colors.lavenderTint, fg: colors.lavender, label: nb.felles.badges.lent },
  { key: 'dugnads', icon: 'users', bg: colors.limeTint, fg: colors.limeDeep, label: nb.felles.badges.dugnads },
  { key: 'arranged', icon: 'cal', bg: colors.cyanTint, fg: colors.cyanDeep, label: nb.felles.badges.arranged },
];

/** Fellesskapsmerker (0108): discs for lending, dugnader and arranging – counted, never stored. */
export function CommunityBadgesRow({ badges }: { badges: Badges }) {
  const earned = BADGES.filter((b) => badges[b.key] > 0);
  if (!earned.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {earned.map((b) => {
        const n = badges[b.key];
        const label = n === 1 ? b.label.one : b.label.many(n);
        return (
          <View key={b.key} style={styles.badge} accessible accessibilityLabel={label}>
            <View style={[styles.ring, { borderColor: b.fg }]}>
              <View style={[styles.disc, { backgroundColor: b.bg }]}>
                <Icon name={b.icon} size={20} color={b.fg} />
              </View>
            </View>
            <Text style={styles.label} numberOfLines={2}>
              {label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

export const hasCommunityBadges = (b: Badges | undefined) => !!b && BADGES.some((x) => b[x.key] > 0);

const styles = StyleSheet.create({
  row: { gap: 14, paddingVertical: 4 },
  badge: { width: 84, alignItems: 'center', gap: 6 },
  ring: { width: 64, height: 64, borderRadius: radius.pill, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  disc: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.bodySemi, fontSize: 12.5, lineHeight: 16, color: colors.ink, textAlign: 'center' },
});
