import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { categoryLabel } from '@/domain/categories';
import { seasonalCategories } from '@/domain/seasonal';
import { useActiveCategories } from '@/hooks/useCategories';
import nb from '@/i18n/nb';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import { CategoryArt, Icon, PressableScale } from './ui';

const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

/**
 * «Nå i november»: what neighbours usually need help with this time of year. A tap starts
 * Legg ut oppdrag with that category already chosen.
 */
export function SeasonalRow({ style }: { style?: StyleProp<ViewStyle> }) {
  const [now] = useState(() => new Date());
  // only categories that are switched on (Admin › Innstillinger on the website)
  const active = useActiveCategories();
  const cats = seasonalCategories(now).filter((c) => active.includes(c));
  if (!cats.length) return null;
  return (
    <View style={style} testID="seasonal-row">
      <View style={styles.head}>
        <Icon name="cal" size={16} color={colors.limeDeep} />
        <Text style={styles.eyebrow}>{nb.seasonal.title(MONTHS[now.getMonth()])}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {cats.map((c) => (
          <PressableScale
            key={c}
            accessibilityRole="button"
            accessibilityLabel={nb.seasonal.a11y(categoryLabel(c))}
            onPress={() => {
              haptics.light();
              safePush(`/legg-ut?kategori=${c}`);
            }}
            style={[styles.tile, shadow.card]}
          >
            <CategoryArt category={c} width={44} height={44} radius={14} iconSize={22} />
            <View style={styles.body}>
              <Text style={[text.label, styles.label]} numberOfLines={1}>
                {categoryLabel(c)}
              </Text>
              <Text style={styles.cta}>{nb.seasonal.cta}</Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: screenPadding, marginBottom: 10 },
  eyebrow: { ...text.eyebrow, color: colors.limeDeep },
  row: { gap: 10, paddingHorizontal: screenPadding, paddingBottom: 6 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingVertical: 10, paddingLeft: 10, paddingRight: 16, borderRadius: radius.card, backgroundColor: colors.white },
  body: { gap: 2, maxWidth: 150 },
  label: { fontSize: 14.5 },
  cta: { ...text.meta, color: colors.limeDeep },
});
