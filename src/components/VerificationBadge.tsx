import { View, StyleSheet } from 'react-native';
import type { Verification } from '@/domain/types';
import nb from '@/i18n/nb';
import { tokens } from '@/theme';
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
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Icon name="shield" size={15} color={tone} />
        <AppText variant="meta" weight="bold">
          {labelFor(verification)}
        </AppText>
      </View>
      {showExplanation ? (
        <AppText variant="meta" color="navyMuted">
          {verification.explanation}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
