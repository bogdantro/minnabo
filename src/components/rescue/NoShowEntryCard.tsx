import { StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { Attendance } from '@/domain/noShow';
import { colors, radius, shadow, text } from '@/theme/theme';
import { Button, FadeUp, Icon } from '@/components/ui';

/**
 * The way out on the job day (owner): «Kom ikke hjelperen?». Calm until it is used – a warm tone, the
 * agreed time and what we know (confirmed or not), and two equal choices: write first, or start the rescue.
 */
export function NoShowEntryCard({
  helperFirst,
  timeText,
  attendance,
  onWrite,
  onReport,
}: {
  helperFirst: string;
  /** "kl. 14:00" – the agreed time today, if known */
  timeText?: string;
  attendance: Attendance;
  onWrite: () => void;
  onReport: () => void;
}) {
  const status = attendance === 'none' ? nb.rescue.entryNotConfirmed : attendance === 'confirmed' ? nb.rescue.entryConfirmed : nb.rescue.entryOnTheWay;
  return (
    <FadeUp style={[styles.card, shadow.card]} testID="no-show-entry">
      <View style={styles.top}>
        <View style={styles.ic}>
          <Icon name="userX" size={22} color={colors.warn} />
        </View>
        <View style={styles.body}>
          <Text style={[text.h4, styles.title]}>{nb.rescue.entryTitle}</Text>
          <Text style={[text.meta, styles.sub]}>{nb.rescue.entrySub}</Text>
        </View>
      </View>
      <View style={styles.status}>
        <Icon name="clock" size={14} color={colors.ink2} />
        <Text style={styles.statusText} numberOfLines={1}>
          {[timeText ? nb.rescue.entryAgreed(timeText) : null, status].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={styles.btns}>
        <Button label={nb.rescue.entryCta} icon="userX" variant="danger" onPress={onReport} />
        <Button label={nb.rescue.write(helperFirst)} icon="msg" variant="ghost" onPress={onWrite} />
      </View>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, backgroundColor: colors.white, padding: 16, gap: 14, borderWidth: 1, borderColor: colors.warnTint },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ic: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.warnTint, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 17, lineHeight: 21 },
  sub: { fontSize: 13.5, lineHeight: 18.5 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
  statusText: { ...text.pill, color: colors.ink2 },
  // stacked full width: side by side the labels («Skriv til Martin», «Hjelperen kom ikke») got cut off
  btns: { gap: 8 },
});
