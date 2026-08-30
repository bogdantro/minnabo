import { View, Pressable, StyleSheet } from 'react-native';
import type { Verification } from '@/domain/types';
import nb from '@/i18n/nb';
import { tokens } from '@/theme';
import { toast } from '@/lib/toast';
import { AppText } from './ui/Text';
import { Icon } from './ui/Icon';

const labelFor = (v: Verification): string => {
  switch (v.kind) {
    case 'PHONE':
      return nb.verification.phone;
    case 'EMAIL':
      return nb.verification.email;
    case 'BUSINESS':
      return nb.verification.business;
  }
};

export function VerificationBadge({
  verification,
  showExplanation = false,
}: {
  verification: Verification;
  showExplanation?: boolean;
}) {
  const tone = verification.kind === 'BUSINESS' ? 'cyan' : 'shieldGreen';

  const body = (
    <>
      <View style={styles.row}>
        <Icon name="shield" size={15} color={tone} />
        <AppText variant="meta" weight="bold">
          {labelFor(verification)}
        </AppText>
        {!showExplanation ? <Icon name="info" size={12} color="navyMuted" /> : null}
      </View>
      {showExplanation ? (
        <AppText variant="meta" color="navyMuted">
          {verification.explanation}
        </AppText>
      ) : null}
    </>
  );

  // When the explanation isn't shown inline, tapping the badge surfaces it
  // (spec §16 — a badge must always be able to explain what was checked).
  if (showExplanation) return <View style={styles.wrap}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${labelFor(verification)}. ${verification.explanation}`}
      hitSlop={6}
      onPress={() => toast.info(verification.explanation)}
      style={styles.wrap}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
