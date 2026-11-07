import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { categoryArtColors, categoryLabel } from '@/domain/categories';
import { seasonalCategories } from '@/domain/seasonal';
import { useActiveCategories } from '@/hooks/useCategories';
import nb from '@/i18n/nb';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { colors, radius, screenPadding, shadow, text, type CategoryId } from '@/theme/theme';
import { SeasonArt, seasonOf } from './art/Scenes';
import { LeggUtChooser } from './LeggUtChooser';
import { Icon, PressableScale } from './ui';

const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
const CARD_W = 164;

/**
 * What neighbours usually need help with this time of year, drawn for the season. A tap asks
 * «Hva vil du legge ut?» – need help or can help – and opens that wizard with the category chosen.
 */
export function SeasonalRow({ style }: { style?: StyleProp<ViewStyle> }) {
  const [now] = useState(() => new Date());
  // the category the person tapped, while «Hva vil du legge ut?» is open
  const [picked, setPicked] = useState<CategoryId | null>(null);
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
        <Text style={text.meta}>{nb.seasonal.sub}</Text>
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
                setPicked(c);
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
      <LeggUtChooser
        visible={!!picked}
        onClose={() => setPicked(null)}
        onPick={(kind) => {
          const c = picked;
          setPicked(null);
          if (c) safePush(kind === 'need' ? `/legg-ut?kategori=${c}` : `/legg-ut/tilbyr?kategori=${c}`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: 3, paddingHorizontal: screenPadding, marginBottom: 12 },
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
