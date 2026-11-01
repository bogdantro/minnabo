import { StyleSheet, Text, View } from 'react-native';
import { completenessPct, completenessSteps } from '@/domain/profileCompleteness';
import type { PublicProfile } from '@/domain/types';
import nb from '@/i18n/nb';
import { safePush } from '@/lib/nav';
import { useTrustedContacts } from '@/lib/trustedContacts';
import { colors, radius, screenPadding, shadow, text } from '@/theme/theme';
import { FadeUp, Icon, PressableScale } from '../ui';

/**
 * «Profilen din er 67 % ferdig · Neste: Legg til profilbilde». One tap goes straight to
 * that step; the full list is in Verifiseringssenter. Gone once everything is done.
 */
export function CompletenessCard({ profile, portfolioCount }: { profile: PublicProfile; portfolioCount: number }) {
  const { contacts } = useTrustedContacts();
  const steps = completenessSteps(profile, portfolioCount, contacts.length > 0);
  const next = steps.find((s) => !s.done);
  if (!next) return null;
  const pct = completenessPct(steps);
  return (
    <FadeUp delay={180} style={styles.wrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={nb.completeness.a11y(pct, next.label)}
        onPress={() => safePush(next.href)}
        style={[styles.card, shadow.card]}
        testID="profile-completeness"
      >
        <View style={styles.top}>
          <Text style={[text.label, styles.title]}>{nb.completeness.title(pct)}</Text>
          <Icon name="right" size={18} color={colors.mute} />
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
        <Text style={text.meta} numberOfLines={1}>
          {nb.completeness.next(next.label)}
        </Text>
      </PressableScale>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: screenPadding, marginTop: 18 },
  card: { gap: 8, padding: 16, borderRadius: radius.card, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.limeTint },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 15.5, flexShrink: 1 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.lime },
});
