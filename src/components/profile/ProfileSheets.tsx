import { Image, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Button, Icon, IconButton, Sheet, type IconName } from '@/components/ui';

export type VerifKind = 'VIPPS' | 'PHONE' | 'EMAIL' | 'BUSINESS';

export const VERIF_ART: Record<VerifKind, { icon: IconName; bg: string; fg: string }> = {
  VIPPS: { icon: 'shield', bg: colors.vippsIdBg, fg: colors.vippsIdFg },
  PHONE: { icon: 'phone', bg: colors.cyanTint, fg: colors.cyanDeep },
  EMAIL: { icon: 'mail', bg: colors.limeTint, fg: colors.limeDeep },
  BUSINESS: { icon: 'building', bg: colors.neutralPill, fg: colors.ink2 },
};

/** Profil verification sheet: what was checked, what is never shared. */
export function VerifSheet({
  kind,
  checked,
  onClose,
  onReadMore,
}: {
  kind: VerifKind | null;
  checked: string[];
  onClose: () => void;
  onReadMore: () => void;
}) {
  const k = kind ?? 'VIPPS';
  const copy = nb.profile.verif[k];
  const art = VERIF_ART[k];
  return (
    <Sheet visible={!!kind} onClose={onClose}>
      <View style={styles.head} accessibilityRole="header" accessibilityLabel={copy.title}>
        <View style={styles.headL}>
          <View style={[styles.icirc48, { backgroundColor: art.bg }]}>
            <Icon name={art.icon} size={24} color={art.fg} />
          </View>
          <View>
            <Text style={text.h3}>{copy.title}</Text>
            <View style={styles.vbadge}>
              <Icon name="check" size={14} color={colors.verified} />
              <Text style={[text.verified, { color: colors.verified }]}>{nb.profile.verified}</Text>
            </View>
          </View>
        </View>
        <IconButton icon="x" iconSize={18} accessibilityLabel="Lukk" onPress={onClose} />
      </View>
      <Text style={[styles.label, styles.labelTop]}>{nb.profile.verifChecked}</Text>
      <View style={styles.stack8}>
        {checked.map((c) => (
          <View key={c} style={styles.checkRow}>
            <View style={styles.okDot}>
              <Icon name="check" size={14} color={colors.white} />
            </View>
            <Text style={styles.checkText}>{c}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.label, styles.labelMid]}>{nb.profile.verifNotShared}</Text>
      <View style={styles.privRow}>
        <Icon name="lock" size={18} color={colors.mute} />
        <Text style={styles.privText}>{copy.private}</Text>
      </View>
      <Button label={nb.profile.verifReadMore} variant="ghost" iconRight="arrow" onPress={onReadMore} style={styles.mt18} />
    </Sheet>
  );
}

/** Profil portfolio viewer: big photo, Forrige / Neste and position dots. */
export function PortfolioViewer({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: string[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const i = index ?? 0;
  const n = photos.length;
  return (
    <Sheet visible={index !== null} onClose={onClose} title={nb.profile.portCount(i + 1, n)}>
      <View style={[styles.big, shadow.medium]}>
        {photos[i] ? <Image source={{ uri: photos[i] }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
        {n > 1 ? (
          <>
            <IconButton icon="left" variant="glass" accessibilityLabel={nb.profile.prev} onPress={() => onIndex((i + n - 1) % n)} style={[styles.nav, styles.navL]} />
            <IconButton icon="right" variant="glass" accessibilityLabel={nb.profile.next} onPress={() => onIndex((i + 1) % n)} style={[styles.nav, styles.navR]} />
          </>
        ) : null}
      </View>
      {n > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {photos.map((p, d) => (
            <View key={p} style={[styles.dot, d === i ? styles.dotOn : null]} />
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  headL: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  icirc48: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  vbadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  label: { fontFamily: text.cardTitle.fontFamily, fontSize: 14, lineHeight: 17, color: colors.ink },
  labelTop: { marginTop: 6, marginBottom: 10 },
  labelMid: { marginTop: 18, marginBottom: 10 },
  stack8: { gap: 8 },
  checkRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.m, backgroundColor: colors.surface2 },
  okDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkText: { ...text.body, flex: 1, fontSize: 14.5, lineHeight: 20 },
  privRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.m, borderWidth: 1, borderColor: colors.line },
  privText: { ...text.body, flex: 1, fontSize: 14, lineHeight: 20.3, color: colors.ink2 },
  mt18: { marginTop: 18 },
  big: { height: 262, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.track },
  nav: { position: 'absolute', top: '50%', marginTop: -22 },
  navL: { left: 12 },
  navR: { right: 12 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.dotIdle },
  dotOn: { width: 22, backgroundColor: colors.ink },
});
