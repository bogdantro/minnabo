import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import nb from '@/i18n/nb';
import type { Listing } from '@/domain/types';
import { openWebsite } from '@/config/links';
import { colors, fonts, radius, text } from '@/theme/theme';
import { Icon, TextLink } from '@/components/ui';

/**
 * What MinNabo's moderation did to an oppdrag, shown to its owner (Mine oppdrag and the
 * detail screen). A first oppdrag waiting for approval is "Venter på godkjenning"; anything
 * else that is hidden is "Oppdraget er skjult av MinNabo" with the reason and "Kontakt oss".
 * Renders nothing for an oppdrag that is visible as normal.
 */
export function ModerationBanner({ listing, style }: { listing: Listing; style?: StyleProp<ViewStyle> }) {
  const m = listing.moderation;
  if (!m || (!m.hidden && !m.pendingReview)) return null;

  if (m.pendingReview) {
    return (
      <View style={[styles.box, styles.pending, style]} accessibilityRole="alert">
        <Icon name="hourglass" size={18} color={colors.cyanDeep} />
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.cyanDeep }]}>{nb.moderation.pendingTitle}</Text>
          <Text style={[text.meta, styles.body]}>{nb.moderation.pendingBody}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.box, styles.hidden, style]} accessibilityRole="alert">
      <Icon name="eye" size={18} color={colors.warn} />
      <View style={styles.flex}>
        <Text style={[styles.title, { color: colors.warnDark }]}>{nb.moderation.hiddenTitle}</Text>
        <Text style={[text.meta, styles.body]}>{m.reason ?? nb.moderation.hiddenBody}</Text>
        <TextLink label={nb.moderation.contact} icon="arrowur" onPress={() => openWebsite('hjelp')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  box: { flexDirection: 'row', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.m, borderWidth: 1 },
  hidden: { backgroundColor: colors.warnTint, borderColor: colors.vacBorder },
  pending: { backgroundColor: colors.cyanTint, borderColor: colors.infoBorder },
  title: { fontFamily: fonts.bodyBold, fontSize: 14.5, lineHeight: 19 },
  body: { marginTop: 2, color: colors.ink2 },
});
