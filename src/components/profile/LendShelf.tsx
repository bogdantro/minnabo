import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LendItem } from '@/domain/types';
import nb from '@/i18n/nb';
import { safePush } from '@/lib/nav';
import { LEND_ART } from '@/domain/lend';
import { colors, radius, text } from '@/theme/theme';
import { CategoryArt, Icon } from '@/components/ui';

/** «Ting jeg låner ut» on a profile (0101): a row of the things; each opens the person's shelf on Utlån. */
export function LendShelf({ items, profileId, isSelf }: { items: LendItem[]; profileId: string; isSelf: boolean }) {
  const open = () => safePush(isSelf ? '/utlan?fane=mine' : `/utlan?profil=${profileId}`);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((i) => (
        <Pressable key={i.id} accessibilityRole="button" accessibilityLabel={i.title} onPress={open} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
          <CategoryArt category={LEND_ART[i.category]} uri={i.imageUrl} width={92} height={92} radius={18} iconSize={28} />
          <Text style={styles.title} numberOfLines={2}>
            {i.title}
          </Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel={nb.lend.seeAll} onPress={open} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
        <View style={[styles.photo, styles.more]}>
          <Icon name="arrow" size={22} color={colors.ink} />
        </View>
        <Text style={styles.title}>{nb.lend.seeAll}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12, paddingTop: 12, paddingRight: 8 },
  item: { width: 92, gap: 6 },
  pressed: { opacity: 0.75 },
  photo: { width: 92, height: 92, borderRadius: radius.m, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  more: { backgroundColor: colors.bg },
  title: { ...text.meta, fontSize: 12.5, color: colors.ink },
});
