import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { useProfile } from '@/api/queries';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Avatar, Button, Icon, type IconName } from '@/components/ui';

/**
 * The top of Utlån: the base design's art band (blobs, a dashed ring round a lime disc, a few tilted tag chips
 * and the faces of neighbours who lend out), the title, two live numbers and «Lån ut noe».
 */
export function LendHero({
  kommune,
  things,
  lenders,
  faces,
  onAdd,
}: {
  kommune: string;
  things: number;
  lenders: number;
  /** owners shown as small discs in the band */
  faces: string[];
  /** unset for youth: they can borrow, not lend out */
  onAdd?: () => void;
}) {
  const t = nb.lend;
  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.band} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.blob, styles.blobL]} />
        <View style={[styles.blob, styles.blobR]} />
        <View style={styles.ring} />
        <View style={[styles.disc, shadow.medium]}>
          <Icon name="montering" size={30} color={colors.ink} />
        </View>
        <Chip icon="hage" label={t.cats.HAGE} style={styles.chip1} />
        <Chip icon="transport" label={t.cats.TRANSPORT} style={styles.chip2} />
        <Chip icon="sykkel" label={t.cats.FRITID} style={styles.chip3} />
        {faces[0] ? <Face id={faces[0]} style={styles.face1} /> : null}
        {faces[1] ? <Face id={faces[1]} style={styles.face2} /> : null}
        <View style={[styles.dot, styles.dot1]} />
        <View style={[styles.dot, styles.dot2]} />
      </View>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>{t.heroEyebrow(kommune)}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {t.heroTitle}
        </Text>
        <Text style={styles.lead}>{t.heroLead}</Text>
        <View style={styles.stats}>
          <Stat icon="tag" value={t.statThings(things)} />
          <Stat icon="users" value={t.statLenders(lenders)} />
        </View>
        {onAdd ? <Button label={t.addCta} icon="plus" variant="ink" onPress={onAdd} accessibilityLabel={t.addA11y} style={styles.cta} /> : null}
      </View>
    </View>
  );
}

function Chip({ icon, label, style }: { icon: IconName; label: string; style: object }) {
  return (
    <View style={[styles.tag, shadow.card, style]}>
      <Icon name={icon} size={13} color={colors.limeDeep} />
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function Face({ id, style }: { id: string; style: object }) {
  const p = useProfile(id).data;
  return (
    <View style={[styles.face, style]}>
      <Avatar initials={p?.initials ?? '·'} uri={p?.avatarUrl} seed={id} size={34} ring={false} />
    </View>
  );
}

function Stat({ icon, value }: { icon: IconName; value: string }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={14} color={colors.limeDeep} />
      <Text style={styles.statText}>{value}</Text>
    </View>
  );
}

const BAND = 150;

const styles = StyleSheet.create({
  card: { borderRadius: radius.listingCard, backgroundColor: colors.white, overflow: 'hidden' },
  band: { height: BAND, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: colors.limeSoft, opacity: 0.85 },
  blobL: { width: 200, height: 200, left: -70, top: -90 },
  blobR: { width: 230, height: 230, right: -90, bottom: -140 },
  ring: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lime },
  disc: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white },
  tag: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.white },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  chip1: { left: 16, top: 18, transform: [{ rotate: '-7deg' }] },
  chip2: { right: 16, top: 26, transform: [{ rotate: '6deg' }] },
  chip3: { left: 28, bottom: 18, transform: [{ rotate: '5deg' }] },
  face: { position: 'absolute', borderRadius: 19, borderWidth: 2, borderColor: colors.white, backgroundColor: colors.white },
  face1: { right: '25%', bottom: 14 },
  face2: { right: 22, bottom: 52 },
  dot: { position: 'absolute', borderRadius: 99 },
  dot1: { width: 10, height: 10, left: '33%', top: 20, backgroundColor: colors.cyan },
  dot2: { width: 7, height: 7, right: '33%', bottom: 26, backgroundColor: colors.lime },
  body: { padding: 18, gap: 6 },
  eyebrow: { ...text.eyebrow, fontSize: 11, color: colors.limeDeep },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.5, color: colors.ink },
  lead: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.limeTint },
  statText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  cta: { marginTop: 10 },
});
