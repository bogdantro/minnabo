import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { categoryArtColors, categoryLabel } from '@/domain/categories';
import { seasonalCategories } from '@/domain/seasonal';
import { useActiveCategories } from '@/hooks/useCategories';
import nb from '@/i18n/nb';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import { SeasonArt, seasonOf } from './art/Scenes';
import { Icon, PressableScale } from './ui';

const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
const CARD_W = 164;

/**
 * What neighbours usually need help with this time of year, drawn for the season.
 * A tap starts Legg ut oppdrag with that category already chosen.
 */
export function SeasonalRow({ style }: { style?: StyleProp<ViewStyle> }) {
  const [now] = useState(() => new Date());
  // only categories that are switched on (Admin › Innstillinger on the website)
  const active = useActiveCategories();
  const cats = seasonalCategories(now).filter((c) => active.includes(c));
  if (!cats.length) return null;
  const month = MONTHS[now.getMonth()];
  const season = seasonOf(now);
  return (
    <View style={style} testID="seasonal-row">
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {nb.seasonal.title(month)}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={CARD_W + 12} contentContainerStyle={styles.row}>
        {cats.map((c) => {
          const art = categoryArtColors(c);
          return (
            <PressableScale
              key={c}
              accessibilityRole="button"
              accessibilityLabel={nb.seasonal.a11y(categoryLabel(c))}
              onPress={() => {
                haptics.light();
                safePush(`/legg-ut?kategori=${c}`);
              }}
              style={[styles.card, shadow.card]}
            >
              <View style={styles.scene}>
                <SeasonArt season={season} icon={c} bg={art.bg} fg={art.fg} />
              </View>
              <View style={styles.body}>
                <Text style={styles.label} numberOfLines={2}>
                  {categoryLabel(c)}
                </Text>
                <View style={styles.foot}>
                  <Text style={styles.cta} numberOfLines={1}>
                    {nb.seasonal.cta}
                  </Text>
                  <View style={styles.go}>
                    <Icon name="arrow" size={14} color={colors.ink} />
                  </View>
                </View>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: screenPadding, marginBottom: 12 },
  title: { ...text.h3, fontSize: 19, lineHeight: 24 },
  row: { gap: 12, paddingHorizontal: screenPadding, paddingBottom: 8 },
  card: { width: CARD_W, borderRadius: radius.card, backgroundColor: colors.white },
  scene: { height: 92, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, overflow: 'hidden' },
  body: { paddingTop: 12, paddingHorizontal: 13, paddingBottom: 12, gap: 8, flexGrow: 1, justifyContent: 'space-between' },
  label: { ...text.h3, fontSize: 16, lineHeight: 20 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  cta: { ...text.meta, flexShrink: 1, fontFamily: text.label.fontFamily, color: colors.limeDeep },
  go: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
});
