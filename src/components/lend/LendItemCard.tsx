import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LendItem } from '@/domain/types';
import nb from '@/i18n/nb';
import { useLendBusyDays, useProfile } from '@/api/queries';
import { LEND_ART, busyToday, dateOf } from '@/domain/lend';
import { dayMonth } from '@/lib/datetime';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Avatar, CategoryArt, Icon, PressableScale } from '@/components/ui';

const PHOTO_H = 132;

/** One thing in the Utlån grid: the photo (or the category's tile), its kind, the owner and whether it is out now. */
export function LendItemCard({ item, onOpen }: { item: LendItem; onOpen: () => void }) {
  const owner = useProfile(item.ownerId).data;
  const busy = useLendBusyDays(item.id).data ?? [];
  const [now] = useState(() => new Date());
  const out = busyToday(busy, now);
  const first = (owner?.displayName ?? '').split(' ')[0];
  const t = nb.lend;
  const place = owner?.location.place && owner.location.place !== owner.location.municipality ? owner.location.place : owner?.location.municipality;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[item.title, t.cats[item.category], t.ownerOf(first), out ? t.busyUntil(dayMonth(dateOf(out.toDate).toISOString())) : t.free].join(', ')}
      onPress={onOpen}
      scaleTo={0.97}
      style={[styles.card, shadow.card]}
    >
      <View>
        <CategoryArt category={LEND_ART[item.category]} uri={item.imageUrl} width="100%" height={PHOTO_H} iconSize={40} />
        <View style={styles.kind}>
          <Icon name={LEND_ART[item.category]} size={12} color={colors.ink} />
          <Text style={styles.kindText}>{t.cats[item.category]}</Text>
        </View>
        <View style={[styles.state, out ? styles.stateOut : styles.stateFree]}>
          <View style={[styles.stateDot, out ? styles.dotOut : styles.dotFree]} />
          <Text style={[styles.stateText, out && styles.stateTextOut]}>{out ? t.lentNow : t.free}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.owner}>
          <Avatar initials={owner?.initials ?? '·'} uri={owner?.avatarUrl} seed={item.ownerId} size={24} ring={false} />
          <View style={styles.flex}>
            <Text style={styles.ownerName} numberOfLines={1}>
              {first}
            </Text>
            {place ? (
              <Text style={styles.ownerPlace} numberOfLines={1}>
                {place}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, backgroundColor: colors.white, overflow: 'hidden' },
  flex: { flex: 1, minWidth: 0 },
  kind: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    transform: [{ rotate: '-4deg' }],
  },
  kindText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.ink },
  state: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 9, borderRadius: radius.pill },
  stateFree: { backgroundColor: colors.white },
  stateOut: { backgroundColor: colors.ink },
  stateDot: { width: 7, height: 7, borderRadius: 4 },
  dotFree: { backgroundColor: colors.ok },
  dotOut: { backgroundColor: colors.lime },
  stateText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.ink },
  stateTextOut: { color: colors.white },
  body: { padding: 12, gap: 10 },
  title: { ...text.label, fontSize: 15, lineHeight: 19 },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ownerName: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink },
  ownerPlace: { ...text.meta, fontSize: 11.5 },
});
