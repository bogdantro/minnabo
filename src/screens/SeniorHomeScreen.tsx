import { Pressable, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { categoryLabel } from '@/domain/categories';
import { useActiveCategories } from '@/hooks/useCategories';
import { HomeTopBar } from '@/components/TopBar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUnreadConversationCount } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { useSeniorMode } from '@/lib/seniorMode';
import { colors, fonts, radius, screenPadding, shadow, text, type CategoryId } from '@/theme/theme';
import { CategoryArt, CountBadge, Icon, Screen } from '@/components/ui';

/** The help people ask neighbours for most, first; only those the admin has switched on are shown. */
const FIRST: CategoryId[] = ['handling', 'snomaking', 'hage', 'data', 'transport', 'montering', 'rengjoring', 'ved'];
const TILES = 6;
/** Bigger than the usual 44 pt: easy to hit with a shaky hand. */
const TILE_H = 116;

/**
 * «Enkel visning» (0101): one question, big tiles, and the two places that matter most.
 * Every tile starts the normal oppdrag wizard with the category picked.
 */
export function SeniorHomeScreen() {
  const me = useCurrentUser();
  const [, setSenior] = useSeniorMode();
  const active = useActiveCategories();
  const unread = useUnreadConversationCount();
  const cats = FIRST.filter((c) => active.includes(c)).slice(0, TILES);
  const t = nb.senior;
  const first = me.displayName.split(' ')[0];

  const start = (cat?: CategoryId) => {
    haptics.light();
    safePush(cat ? `/legg-ut?kategori=${cat}` : '/legg-ut');
  };

  return (
    <Screen
      scroll
      spacer="nav"
      header={<HomeTopBar avatar={{ uri: me.avatarUrl, initials: me.initials }} onProfilePress={() => safePush('/profil')} onNotificationsPress={() => safePush('/varsler')} />}
    >
      <View style={styles.body}>
        <Text style={styles.hello} accessibilityRole="header">
          {t.hello(first)}
        </Text>
        <Text style={styles.ask}>{t.ask}</Text>
        <Text style={styles.sub}>{t.askSub}</Text>

        <View style={styles.grid}>
          {cats.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`${t.ask} ${categoryLabel(c)}`}
              onPress={() => start(c)}
              style={({ pressed }) => [styles.tile, shadow.card, pressed && styles.pressed]}
            >
              <CategoryArt category={c} width={54} height={54} radius={27} iconSize={26} />
              <Text style={styles.tileText} numberOfLines={2}>
                {categoryLabel(c)}
              </Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t.ask} ${t.other}`}
            onPress={() => start()}
            style={({ pressed }) => [styles.tile, styles.tileInk, pressed && styles.pressed]}
          >
            <View style={styles.plus}>
              <Icon name="plus" size={26} color={colors.ink} />
            </View>
            <Text style={[styles.tileText, styles.white]}>{t.other}</Text>
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" onPress={() => safePush('/avtaler')} style={({ pressed }) => [styles.row, shadow.card, pressed && styles.pressed]}>
          <View style={[styles.rowIc, { backgroundColor: colors.okTint }]}>
            <Icon name="cal" size={24} color={colors.ok} />
          </View>
          <Text style={styles.rowText}>{t.mine}</Text>
          <Icon name="right" size={24} color={colors.faint} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread ? `${t.messages}, ${unread}` : t.messages}
          onPress={() => safePush('/innboks')}
          style={({ pressed }) => [styles.row, shadow.card, pressed && styles.pressed]}
        >
          <View style={[styles.rowIc, { backgroundColor: colors.cyanTint }]}>
            <Icon name="msg" size={24} color={colors.cyanDeep} />
          </View>
          <Text style={styles.rowText}>{t.messages}</Text>
          {unread ? <CountBadge count={unread} /> : <Icon name="right" size={24} color={colors.faint} />}
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel={t.normalA11y} onPress={() => setSenior(false)} style={styles.normal} hitSlop={8}>
          <Text style={styles.normalText}>{t.normal}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: screenPadding, paddingTop: 12, paddingBottom: 30, gap: 14 },
  hello: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.ink },
  ask: { fontFamily: fonts.display, fontSize: 24, lineHeight: 29, color: colors.ink },
  sub: { ...text.body, fontSize: 17, lineHeight: 24, color: colors.ink2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    minHeight: TILE_H,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    padding: 14,
    gap: 10,
    justifyContent: 'center',
  },
  tileInk: { backgroundColor: colors.ink },
  plus: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 22, color: colors.ink },
  white: { color: colors.white },
  pressed: { transform: [{ scale: 0.97 }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 76, paddingHorizontal: 16, borderRadius: radius.card, backgroundColor: colors.white },
  rowIc: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink },
  normal: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, marginTop: 6 },
  normalText: { ...text.link, fontSize: 16 },
});
